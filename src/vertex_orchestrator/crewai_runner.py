"""CrewAI runner — executes tasks via CrewAI backed by Google Vertex AI."""
from __future__ import annotations

from typing import Callable, Optional

from vertex_orchestrator.config import VertexAIConfig


class TaskResult:
    """Result of a single agent task execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        self.success = success
        self.output = output
        self.error = error

    def __repr__(self) -> str:
        if self.success:
            return f"TaskResult(success=True, output={self.output!r})"
        return f"TaskResult(success=False, error={self.error!r})"


# Type for the callable backend that simulates or wraps crew.kickoff()
BackendFn = Callable[[str, str, float], str]


class CrewAIRunner:
    """Runs a single task through CrewAI using a Vertex AI-backed LLM.

    The ``backend`` parameter on ``run()`` allows injecting a real CrewAI
    crew.kickoff() call or a test double. In production, the default
    backend constructs a CrewAI Agent and Crew with the Vertex AI LLM.
    """

    def __init__(self, config: VertexAIConfig, task: str) -> None:
        self.config = config
        self.task = task

    @property
    def model_string(self) -> str:
        """The vertex_ai/ prefixed model string for CrewAI's LLM class."""
        return self.config.crewai_model_string

    def run(self, backend: Optional[BackendFn] = None) -> TaskResult:
        """Execute the task and return a TaskResult.

        If no backend is provided, uses the default CrewAI backend
        (requires crewai to be installed).
        """
        if backend is None:
            backend = self._default_backend

        try:
            output = backend(self.task, self.model_string, self.config.temperature)
            return TaskResult(success=True, output=output)
        except Exception as exc:
            return TaskResult(success=False, error=str(exc))

    def _default_backend(self, task: str, model_string: str, temperature: float) -> str:
        """Production backend using real CrewAI. Requires crewai installed."""
        try:
            from crewai import Agent, Crew, LLM  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "crewai is not installed. Install with: pip install crewai"
            ) from exc

        llm = LLM(model=model_string, temperature=temperature)
        agent = Agent(
            role="AI Agent",
            goal=task,
            backstory="An autonomous agent running inside local enterprise memory.",
            llm=llm,
            verbose=True,
        )
        crew = Crew(agents=[agent], tasks=[task])  # type: ignore[arg-type]
        return str(crew.kickoff())