"""Tests for AutoGenRunner — runs multi-agent conversations via Vertex AI."""
import pytest
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.autogen_runner import AutoGenRunner, ConversationResult


class TestAutoGenRunner:
    """Tracer bullet 3: AutoGen conversation execution via Vertex AI."""

    def test_runner_accepts_config_and_message(self):
        """Runner should store the config and the initial message."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = AutoGenRunner(
            config=config,
            system_message="You generate highly secure proprietary object models.",
            message="Design a secure data model for user auth.",
        )
        assert runner.config is config
        assert runner.system_message == "You generate highly secure proprietary object models."
        assert runner.message == "Design a secure data model for user auth."

    def test_runner_exposes_autogen_config(self):
        """Runner should expose the AutoGen config_list entry."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")
        runner = AutoGenRunner(config=config, system_message="hi", message="do something")
        entry = runner.config_entry
        assert entry["model"] == "gemini-2.5-pro"
        assert entry["api_type"] == "google"

    def test_runner_executes_conversation_and_returns_result(self):
        """Runner should execute via a callable backend and return ConversationResult."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def fake_backend(system_message: str, message: str, config_entry: dict) -> str:
            assert "secure" in system_message
            assert "auth" in message
            assert config_entry["api_type"] == "google"
            return "Here is the proposed model: User(id, hashed_password, salt)"

        runner = AutoGenRunner(
            config=config,
            system_message="You generate highly secure proprietary object models.",
            message="Design a secure data model for user auth.",
        )
        result = runner.run(backend=fake_backend)

        assert isinstance(result, ConversationResult)
        assert result.success is True
        assert "User(id" in result.output
        assert result.error is None

    def test_runner_returns_failure_on_backend_error(self):
        """Runner should return a failed ConversationResult when the backend raises."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def failing_backend(system_message, message, config_entry):
            raise RuntimeError("Model overloaded")

        runner = AutoGenRunner(config=config, system_message="sys", message="msg")
        result = runner.run(backend=failing_backend)

        assert result.success is False
        assert result.output is None
        assert "overloaded" in result.error

    def test_runner_with_multiple_messages(self):
        """Runner should support passing a list of messages for multi-turn conversations."""
        config = VertexAIConfig(project_id="corp-proj", location="us-central1")

        def fake_backend(system_message, message, config_entry):
            assert isinstance(message, list)
            assert len(message) == 2
            return "Multi-turn complete"

        runner = AutoGenRunner(
            config=config,
            system_message="You are a code architect.",
            message=["First message", "Second message"],
        )
        result = runner.run(backend=fake_backend)

        assert result.success is True
        assert result.output == "Multi-turn complete"