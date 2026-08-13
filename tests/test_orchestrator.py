"""Tests for the Unified Orchestrator — routes tasks between CrewAI, AutoGen, and Aider."""
import pytest
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import (
    Orchestrator,
    TaskType,
    OrchestratorResult,
)


class TestOrchestratorRouting:
    """Tracer bullet 5: unified task routing across all three systems."""

    def test_orchestrator_accepts_config(self):
        """Orchestrator should store the shared VertexAIConfig."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)
        assert orch.config is config

    def test_routes_analysis_task_to_crewai(self):
        """ANALYSIS tasks should route to the CrewAI runner."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="Scan repository for unsafe license leakage",
            backend=lambda runner_type, **kwargs: f"crewai:{kwargs.get('task', '')}",
        )

        assert result.success is True
        assert "crewai" in result.output
        assert result.runner_used == "crewai"

    def test_routes_conversation_task_to_autogen(self):
        """CONVERSATION tasks should route to the AutoGen runner."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        result = orch.execute(
            task_type=TaskType.CONVERSATION,
            task="Discuss the architecture with the code architect agent",
            system_message="You are a code architect.",
            backend=lambda runner_type, **kwargs: f"autogen:{kwargs.get('message', '')}",
        )

        assert result.success is True
        assert "autogen" in result.output
        assert result.runner_used == "autogen"

    def test_routes_edit_task_to_aider(self):
        """EDIT tasks should route to the Aider runner."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        result = orch.execute(
            task_type=TaskType.EDIT,
            task="Add input validation to login()",
            file_path="src/auth.py",
            backend=lambda runner_type, **kwargs: f"aider:{kwargs.get('file_path', '')}",
        )

        assert result.success is True
        assert "aider" in result.output
        assert result.runner_used == "aider"

    def test_unknown_task_type_raises(self):
        """Invalid task type should raise ValueError."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        with pytest.raises(ValueError, match="task_type"):
            orch.execute(task_type="INVALID", task="something")  # type: ignore[arg-type]

    def test_orchestrator_handles_backend_failure(self):
        """Orchestrator should return a failed result if the backend errors."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("Vertex AI unavailable")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze something",
            backend=failing_backend,
        )

        assert result.success is False
        assert "unavailable" in result.error
        assert result.runner_used == "crewai"

    def test_execute_multiple_tasks_in_sequence(self):
        """Orchestrator should handle multiple tasks of different types."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        orch = Orchestrator(config=config)

        def fake_backend(runner_type, **kwargs):
            return f"{runner_type}:done"

        results = orch.execute_batch(
            tasks=[
                {"task_type": TaskType.ANALYSIS, "task": "analyze code"},
                {"task_type": TaskType.CONVERSATION, "task": "discuss design",
                 "system_message": "You are an architect."},
                {"task_type": TaskType.EDIT, "task": "fix bug",
                 "file_path": "src/main.py"},
            ],
            backend=fake_backend,
        )

        assert len(results) == 3
        assert all(r.success for r in results)
        assert results[0].runner_used == "crewai"
        assert results[1].runner_used == "autogen"
        assert results[2].runner_used == "aider"