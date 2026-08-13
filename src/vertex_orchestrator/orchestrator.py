"""Unified orchestrator — routes tasks between CrewAI, AutoGen, and Aider.

This is the central coordinator that accepts a task, determines which
agent framework should handle it, delegates to the appropriate runner,
and returns a unified result.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Callable, Optional

from vertex_orchestrator.config import VertexAIConfig


class TaskType(Enum):
    """The type of task determines which agent framework handles it."""

    ANALYSIS = "analysis"        # -> CrewAI (structured analysis, auditing)
    CONVERSATION = "conversation"  # -> AutoGen (multi-turn dialogue)
    EDIT = "edit"                # -> Aider (direct file editing)


class OrchestratorResult:
    """Unified result from any runner execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
        runner_used: str = "",
    ) -> None:
        self.success = success
        self.output = output
        self.error = error
        self.runner_used = runner_used

    def __repr__(self) -> str:
        if self.success:
            return (
                f"OrchestratorResult(success=True, runner={self.runner_used!r}, "
                f"output={self.output!r})"
            )
        return (
            f"OrchestratorResult(success=False, runner={self.runner_used!r}, "
            f"error={self.error!r})"
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
            task: The task description or instruction.
            backend: Optional callable that receives (runner_type, **kwargs)
                     and returns a string result. If None, uses the real
                     runner's default backend.
            **kwargs: Additional arguments passed to the runner
                      (e.g. system_message, file_path).

        Returns:
            OrchestratorResult with success/failure, output, and runner name.
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
        """Use the real runner's default backend (requires libraries installed)."""
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