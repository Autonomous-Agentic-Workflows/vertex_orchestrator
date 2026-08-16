"""Unified orchestrator — routes tasks between CrewAI, AutoGen, and Aider.

This is the central coordinator that accepts a task, determines which
agent framework should handle it, delegates to the appropriate runner,
and returns a unified result.

When ``VertexAIConfig.fallback_enabled`` is True (the default) and a
Vertex AI request fails with a recoverable error
(ResourceExhausted, ServiceUnavailable, DeadlineExceeded,
PermissionDenied), the orchestrator automatically retries the task on
a local Ollama instance via the ``OllamaRunner``.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Optional

from vertex_orchestrator.config import OllamaConfig, VertexAIConfig

if TYPE_CHECKING:
    from vertex_orchestrator.ollama_runner import OllamaResult

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """The type of task determines which agent framework handles it."""

    ANALYSIS = "analysis"        # -> CrewAI (structured analysis, auditing)
    CONVERSATION = "conversation"  # -> AutoGen (multi-turn dialogue)
    EDIT = "edit"                # -> Aider (direct file editing)


# Vertex AI error types that should trigger an Ollama fallback retry.
# Imported lazily so the module remains importable even if
# google-cloud-aiplatform is not installed (tests inject backends).
def _vertex_retryable_exceptions() -> tuple[type[Exception], ...]:
    """Return the tuple of Vertex AI exceptions that trigger fallback.

    Imported lazily from ``google.api_core.exceptions`` so that the
    orchestrator module can be imported in environments where the
    Google Cloud libraries are not installed (e.g. minimal test envs).
    """
    try:
        from google.api_core import exceptions as gexc  # type: ignore[import-untyped]
        return (
            gexc.ResourceExhausted,
            gexc.ServiceUnavailable,
            gexc.DeadlineExceeded,
            gexc.PermissionDenied,
        )
    except ImportError:  # pragma: no cover - google-api-core is a dep
        return ()


class OrchestratorResult:
    """Unified result from any runner execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
        runner_used: str = "",
        fallback_used: bool = False,
        fallback_error: Optional[str] = None,
    ) -> None:
        self.success = success
        self.output = output
        self.error = error
        self.runner_used = runner_used
        self.fallback_used = fallback_used
        self.fallback_error = fallback_error

    def __repr__(self) -> str:
        if self.success:
            fb = " [fallback]" if self.fallback_used else ""
            return (
                f"OrchestratorResult(success=True, runner={self.runner_used!r}{fb}, "
                f"output={self.output!r})"
            )
        fb = f" fallback_error={self.fallback_error!r}" if self.fallback_error else ""
        return (
            f"OrchestratorResult(success=False, runner={self.runner_used!r}, "
            f"error={self.error!r}{fb})"
        )


# Maps TaskType to the runner name used in routing
_TASK_RUNNER_MAP = {
    TaskType.ANALYSIS: "crewai",
    TaskType.CONVERSATION: "autogen",
    TaskType.EDIT: "aider",
}


class Orchestrator:
    """Unified orchestrator for CrewAI, AutoGen, and Aider via Vertex AI.

    Routes tasks to the appropriate agent framework based on task type,
    using a shared VertexAIConfig for all Google Cloud connections.
    """

    def __init__(self, config: VertexAIConfig) -> None:
        self.config = config

    def execute(
        self,
        task_type: TaskType,
        task: str,
        backend: Optional[Callable[..., str]] = None,
        **kwargs: Any,
    ) -> OrchestratorResult:
        """Execute a single task on the appropriate runner.

        Args:
            task_type: Which framework to route to.
            task: The task description or instructions.
            backend: Optional callable that receives (runner_type, **kwargs)
                     and returns a string result. If None, uses the real
                     runner's default backend.
            **kwargs: Additional arguments passed to the runner
                      (e.g. system_message, file_path).

        Returns:
            OrchestratorResult with success/failure, output, runner name,
            and fallback metadata.
        """
        if not isinstance(task_type, TaskType):
            raise ValueError(
                f"task_type must be a TaskType enum, got {type(task_type).__name__}"
            )

        runner_name = _TASK_RUNNER_MAP[task_type]

        try:
            if backend is not None:
                output = backend(
                    runner_name,
                    task=task,
                    **kwargs,
                )
            else:
                output = self._run_with_real_backend(task_type, task, **kwargs)

            return OrchestratorResult(
                success=True,
                output=output,
                runner_used=runner_name,
            )
        except Exception as exc:
            # If fallback is enabled and this is a retryable Vertex AI error,
            # attempt the task on the local Ollama runner.
            if self.config.fallback_enabled and self._is_vertex_retryable(exc):
                logger.warning(
                    "Vertex AI error (%s) for task_type=%s — "
                    "falling back to Ollama",
                    type(exc).__name__,
                    task_type.value,
                )
                fallback_result = self._run_ollama_fallback(
                    task_type, task, **kwargs
                )
                if fallback_result.success:
                    return OrchestratorResult(
                        success=True,
                        output=fallback_result.output,
                        runner_used=runner_name,
                        fallback_used=True,
                        fallback_error=str(exc),
                    )
                # Both Vertex and Ollama failed — return the combined failure
                return OrchestratorResult(
                    success=False,
                    error=str(exc),
                    runner_used=runner_name,
                    fallback_used=True,
                    fallback_error=fallback_result.error,
                )

            return OrchestratorResult(
                success=False,
                error=str(exc),
                runner_used=runner_name,
            )

    def execute_batch(
        self,
        tasks: list[dict[str, Any]],
        backend: Optional[Callable[..., str]] = None,
    ) -> list[OrchestratorResult]:
        """Execute multiple tasks in sequence.

        Args:
            tasks: List of dicts, each with 'task_type' and 'task' keys,
                   plus any additional runner-specific kwargs.
            backend: Optional shared backend callable.

        Returns:
            List of OrchestratorResult, one per task.
        """
        results = []
        for task_spec in tasks:
            spec = dict(task_spec)  # shallow copy
            tt = spec.pop("task_type")
            t = spec.pop("task")
            result = self.execute(
                task_type=tt,
                task=t,
                backend=backend,
                **spec,
            )
            results.append(result)
        return results

    def _run_with_real_backend(
        self, task_type: TaskType, task: str, **kwargs: Any
    ) -> str:
        """Use the real runner's default backend (requires libraries installed).

        If the Vertex AI backend raises a retryable error (quota, service
        unavailable, etc.) and ``config.fallback_enabled`` is True, the
        caller (``execute``) catches it and retries via Ollama.  This
        method itself simply delegates to the appropriate Vertex-backed
        runner and lets exceptions propagate.
        """
        if task_type == TaskType.ANALYSIS:
            from vertex_orchestrator.crewai_runner import CrewAIRunner
            runner = CrewAIRunner(config=self.config, task=task)
            result = runner.run()
            if not result.success:
                raise RuntimeError(result.error or "CrewAI task failed")
            return result.output or ""

        elif task_type == TaskType.CONVERSATION:
            from vertex_orchestrator.autogen_runner import AutoGenRunner
            system_message = kwargs.get("system_message", "You are a helpful assistant.")
            message = kwargs.get("message", task)
            runner = AutoGenRunner(
                config=self.config,
                system_message=system_message,
                message=message,
            )
            result = runner.run()
            if not result.success:
                raise RuntimeError(result.error or "AutoGen conversation failed")
            return result.output or ""

        elif task_type == TaskType.EDIT:
            from vertex_orchestrator.aider_runner import AiderRunner
            file_path = kwargs.get("file_path", "")
            if not file_path:
                raise ValueError("file_path is required for EDIT tasks")
            runner = AiderRunner(
                config=self.config,
                file_path=file_path,
                edit_instruction=task,
            )
            result = runner.run()
            if not result.success:
                raise RuntimeError(result.error or "Aider edit failed")
            return result.summary or ""

        raise ValueError(f"Unknown task type: {task_type}")

    # ------------------------------------------------------------------
    # Ollama fallback support
    # ------------------------------------------------------------------

    @staticmethod
    def _is_vertex_retryable(exc: Exception) -> bool:
        """Return True if *exc* is a retryable Vertex AI / Google API error.

        Checks against ``google.api_core.exceptions.ResourceExhausted``,
        ``ServiceUnavailable``, ``DeadlineExceeded``, and
        ``PermissionDenied``.  Also catches the case where the error is
        wrapped in a ``RuntimeError`` by a runner (the runner stores the
        original error message in the exception string).
        """
        retryable_types = _vertex_retryable_exceptions()
        if retryable_types and isinstance(exc, retryable_types):
            return True
        # Runners wrap errors as RuntimeError(message); inspect the
        # original exception chain and the message for known patterns.
        exc_str = str(exc).lower()
        retryable_markers = (
            "resource exhausted",
            "resourceexhausted",
            "quota",
            "rate limit",
            "rate_limit",
            "service unavailable",
            "serviceunavailable",
            "deadline exceeded",
            "deadlineexceeded",
            "permission denied",
            "permissiondenied",
        )
        if any(m in exc_str for m in retryable_markers):
            return True
        # Walk the exception chain (PEP 678 / __cause__ / __context__)
        cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
        if cause is not None and cause is not exc:
            return Orchestrator._is_vertex_retryable(cause)
        return False

    def _run_ollama_fallback(
        self, task_type: TaskType, task: str, **kwargs: Any
    ) -> OllamaResult:
        """Retry a failed task on the local Ollama runner.

        Builds an ``OllamaConfig`` from the current Vertex config and
        delegates to ``OllamaRunner``.  Returns the runner's result
        object (has ``.success``, ``.output``, ``.error``).
        """
        from vertex_orchestrator.ollama_runner import OllamaRunner

        ollama_config = OllamaConfig.from_vertex_config(self.config)
        system_message = kwargs.get("system_message")
        message = kwargs.get("message")

        runner = OllamaRunner(
            config=ollama_config,
            task=task,
            task_type_value=task_type.value,
            system_message=system_message,
            message=message,
        )
        return runner.run()