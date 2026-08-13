"""Tests for AiderRunner — invokes aider CLI on local files via Vertex AI."""
import pytest
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.aider_runner import AiderRunner, EditResult


class TestAiderRunner:
    """Tracer bullet 4: Aider file editing via Vertex AI."""

    def test_runner_accepts_config_and_edit_request(self):
        """Runner should store the config, file path, and edit instruction."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = AiderRunner(
            config=config,
            file_path="src/auth.py",
            edit_instruction="Add input validation to the login function",
        )
        assert runner.config is config
        assert runner.file_path == "src/auth.py"
        assert runner.edit_instruction == "Add input validation to the login function"

    def test_runner_exposes_aider_model_string(self):
        """Runner should expose the vertex_ai/ model string for Aider CLI."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = AiderRunner(config=config, file_path="x.py", edit_instruction="do")
        assert runner.model_string == "vertex_ai/gemini-2.5-pro"

    def test_runner_executes_edit_and_returns_result(self):
        """Runner should invoke a callable backend and return EditResult."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def fake_backend(file_path: str, edit_instruction: str, model_string: str) -> str:
            assert file_path == "src/auth.py"
            assert "validation" in edit_instruction
            assert model_string == "vertex_ai/gemini-2.5-pro"
            return "Applied edit: added 3 lines of input validation to login()"

        runner = AiderRunner(
            config=config,
            file_path="src/auth.py",
            edit_instruction="Add input validation to the login function",
        )
        result = runner.run(backend=fake_backend)

        assert isinstance(result, EditResult)
        assert result.success is True
        assert "3 lines" in result.summary
        assert result.error is None

    def test_runner_returns_failure_on_backend_error(self):
        """Runner should return a failed EditResult when the backend raises."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def failing_backend(file_path, edit_instruction, model_string):
            raise RuntimeError("Aider could not parse the file")

        runner = AiderRunner(config=config, file_path="bad.py", edit_instruction="fix it")
        result = runner.run(backend=failing_backend)

        assert result.success is False
        assert result.summary is None
        assert "parse" in result.error

    def test_runner_builds_cli_command(self):
        """Runner should produce the correct aider CLI command string."""
        config = VertexAIConfig(
            project_id="corp-proj", location="us-central1"
        )
        runner = AiderRunner(
            config=config,
            file_path="src/main.py",
            edit_instruction="Refactor the main loop",
        )
        cmd = runner.cli_command
        assert "aider" in cmd
        assert "vertex_ai/gemini-2.5-pro" in cmd
        assert "src/main.py" in cmd