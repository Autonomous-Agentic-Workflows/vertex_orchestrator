"""Tests for OllamaRunner — local Ollama fallback backend via litellm."""
import pytest
from vertex_orchestrator.config import OllamaConfig
from vertex_orchestrator.ollama_runner import OllamaRunner, OllamaResult


class TestOllamaRunner:
    """OllamaRunner — local fallback execution via litellm."""

    def test_runner_accepts_config_and_task(self):
        """Runner should store config and task."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="analyze something", task_type_value="analysis")
        assert runner.config is cfg
        assert runner.task == "analyze something"

    def test_model_name_for_analysis(self):
        """Runner should select gemma4:31b for ANALYSIS tasks."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="do", task_type_value="analysis")
        assert runner.model_name == "gemma4:31b"

    def test_model_name_for_conversation(self):
        """Runner should select gemma4:26b for CONVERSATION tasks."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="do", task_type_value="conversation")
        assert runner.model_name == "gemma4:26b"

    def test_model_name_for_edit(self):
        """Runner should select gemma4:26b for EDIT tasks."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="do", task_type_value="edit")
        assert runner.model_name == "gemma4:26b"

    def test_litellm_model_string(self):
        """Runner should produce the ollama/ prefixed litellm model string."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="do", task_type_value="analysis")
        assert runner.litellm_model_string == "ollama/gemma4:31b"

    def test_api_base(self):
        """Runner should expose the Ollama API base URL."""
        cfg = OllamaConfig()
        runner = OllamaRunner(config=cfg, task="do", task_type_value="analysis")
        assert runner.api_base == "http://127.0.0.1:11434"

    def test_runner_executes_and_returns_result(self):
        """Runner should execute via a callable backend and return OllamaResult."""
        cfg = OllamaConfig()

        def fake_backend(model_string, messages, temperature, api_base):
            assert model_string == "ollama/gemma4:31b"
            assert isinstance(messages, list)
            assert messages[0]["role"] == "system"
            assert temperature == 0.2
            assert api_base == "http://127.0.0.1:11434"
            return "Analysis complete from Ollama"

        runner = OllamaRunner(config=cfg, task="analyze code", task_type_value="analysis")
        result = runner.run(backend=fake_backend)

        assert isinstance(result, OllamaResult)
        assert result.success is True
        assert result.output == "Analysis complete from Ollama"
        assert result.model == "gemma4:31b"
        assert result.error is None

    def test_runner_returns_failure_on_backend_error(self):
        """Runner should return a failed OllamaResult when the backend raises."""
        cfg = OllamaConfig()

        def failing_backend(model_string, messages, temperature, api_base):
            raise RuntimeError("Ollama connection refused")

        runner = OllamaRunner(config=cfg, task="do", task_type_value="analysis")
        result = runner.run(backend=failing_backend)

        assert result.success is False
        assert result.output is None
        assert "connection refused" in result.error

    def test_runner_with_custom_system_message(self):
        """Runner should pass the custom system message into messages."""
        cfg = OllamaConfig()
        captured = {}

        def capturing_backend(model_string, messages, temperature, api_base):
            captured["system"] = messages[0]["content"]
            return "ok"

        runner = OllamaRunner(
            config=cfg,
            task="do",
            task_type_value="conversation",
            system_message="You are a code architect.",
        )
        runner.run(backend=capturing_backend)
        assert captured["system"] == "You are a code architect."

    def test_runner_with_custom_message(self):
        """Runner should pass a custom message instead of the task string."""
        cfg = OllamaConfig()

        def fake_backend(model_string, messages, temperature, api_base):
            # messages[0] is system, messages[1] is the user message
            return messages[1]["content"]

        runner = OllamaRunner(
            config=cfg,
            task="original task",
            task_type_value="conversation",
            message="custom message text",
        )
        result = runner.run(backend=fake_backend)
        assert result.output == "custom message text"

    def test_runner_with_list_message(self):
        """Runner should support a list of messages for multi-turn."""
        cfg = OllamaConfig()

        def fake_backend(model_string, messages, temperature, api_base):
            # Count user messages (skip system)
            user_msgs = [m for m in messages if m["role"] == "user"]
            return f"{len(user_msgs)} user messages"

        runner = OllamaRunner(
            config=cfg,
            task="task",
            task_type_value="conversation",
            message=["first", "second"],
        )
        result = runner.run(backend=fake_backend)
        assert result.output == "2 user messages"

    def test_runner_uses_custom_temperature(self):
        """Runner should pass the config temperature to the backend."""
        cfg = OllamaConfig(temperature=0.8)
        captured = {}

        def capturing_backend(model_string, messages, temperature, api_base):
            captured["temperature"] = temperature
            return "ok"

        runner = OllamaRunner(config=cfg, task="do", task_type_value="analysis")
        runner.run(backend=capturing_backend)
        assert captured["temperature"] == 0.8