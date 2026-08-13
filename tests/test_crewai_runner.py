"""Tests for CrewAIRunner — executes tasks via CrewAI backed by Vertex AI."""
import pytest
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.crewai_runner import CrewAIRunner, TaskResult


class TestCrewAIRunner:
    """Tracer bullet 2: CrewAI task execution via Vertex AI."""

    def test_runner_accepts_config_and_task(self):
        """Runner should store the config and task description."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = CrewAIRunner(config=config, task="Analyze repo for license leakage")
        assert runner.config is config
        assert runner.task == "Analyze repo for license leakage"

    def test_runner_builds_crewai_model_string(self):
        """Runner should expose the Vertex AI model string for CrewAI."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = CrewAIRunner(config=config, task="do something")
        assert runner.model_string == "vertex_ai/gemini-2.5-pro"

    def test_runner_executes_task_and_returns_result(self):
        """Runner should execute the task via a callable backend and return TaskResult."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        # Fake backend simulates CrewAI's crew.kickoff() without needing the library
        def fake_backend(task: str, model_string: str, temperature: float) -> str:
            assert "license" in task
            assert model_string == "vertex_ai/gemini-2.5-pro"
            assert temperature == 0.2
            return "No license issues found."

        runner = CrewAIRunner(config=config, task="Analyze repo for license leakage")
        result = runner.run(backend=fake_backend)

        assert isinstance(result, TaskResult)
        assert result.success is True
        assert result.output == "No license issues found."
        assert result.error is None

    def test_runner_returns_failure_on_backend_error(self):
        """Runner should return a failed TaskResult when the backend raises."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def failing_backend(task: str, model_string: str, temperature: float) -> str:
            raise RuntimeError("Vertex AI quota exceeded")

        runner = CrewAIRunner(config=config, task="some task")
        result = runner.run(backend=failing_backend)

        assert result.success is False
        assert result.output is None
        assert "quota exceeded" in result.error

    def test_runner_uses_custom_temperature(self):
        """Runner should pass the config's temperature to the backend."""
        config = VertexAIConfig(
            project_id="corp-proj", location="us-central1", temperature=0.7
        )
        captured = {}

        def capturing_backend(task: str, model_string: str, temperature: float) -> str:
            captured["temperature"] = temperature
            return "done"

        runner = CrewAIRunner(config=config, task="creative task")
        runner.run(backend=capturing_backend)

        assert captured["temperature"] == 0.7