"""Tests for orchestrator Ollama fallback — retry on Vertex AI errors."""
import pytest
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import (
    Orchestrator,
    TaskType,
    OrchestratorResult,
)


class TestOrchestratorFallbackDetection:
    """The orchestrator should detect retryable Vertex AI errors."""

    def test_is_vertex_retryable_resource_exhausted(self):
        """ResourceExhausted should be detected as retryable."""
        from google.api_core.exceptions import ResourceExhausted
        exc = ResourceExhausted("quota exceeded")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_service_unavailable(self):
        """ServiceUnavailable should be detected as retryable."""
        from google.api_core.exceptions import ServiceUnavailable
        exc = ServiceUnavailable("temporarily unavailable")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_deadline_exceeded(self):
        """DeadlineExceeded should be detected as retryable."""
        from google.api_core.exceptions import DeadlineExceeded
        exc = DeadlineExceeded("timed out")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_permission_denied(self):
        """PermissionDenied should be detected as retryable."""
        from google.api_core.exceptions import PermissionDenied
        exc = PermissionDenied("no access")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_runtime_error_with_quota_message(self):
        """RuntimeError with 'quota' in message should be detected as retryable."""
        exc = RuntimeError("Vertex AI quota exceeded")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_runtime_error_with_rate_limit(self):
        """RuntimeError with 'rate limit' in message should be detected as retryable."""
        exc = RuntimeError("rate limit hit")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_runtime_error_with_service_unavailable(self):
        """RuntimeError with 'service unavailable' should be retryable."""
        exc = RuntimeError("Vertex AI service unavailable")
        assert Orchestrator._is_vertex_retryable(exc) is True

    def test_is_vertex_retryable_generic_error(self):
        """A generic RuntimeError should NOT be retryable."""
        exc = RuntimeError("something broke")
        assert Orchestrator._is_vertex_retryable(exc) is False

    def test_is_vertex_retryable_chained_exception(self):
        """Should walk the exception chain to find a retryable cause."""
        from google.api_core.exceptions import ResourceExhausted
        try:
            try:
                raise ResourceExhausted("429 quota")
            except ResourceExhausted as e:
                raise RuntimeError("CrewAI task failed") from e
        except RuntimeError as exc:
            assert Orchestrator._is_vertex_retryable(exc) is True


class TestOrchestratorFallbackExecution:
    """The orchestrator should fall back to Ollama on retryable errors."""

    def test_fallback_succeeds_on_quota_error(self):
        """When Vertex raises quota error, orchestrator should retry on Ollama."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        # Patch _run_ollama_fallback to return a fake success
        from vertex_orchestrator.ollama_runner import OllamaResult

        def fake_fallback(task_type, task, **kwargs):
            return OllamaResult(
                success=True,
                output="Ollama fallback response",
                model="gemma4:31b",
            )

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("ResourceExhausted: quota exceeded")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze something",
            backend=failing_backend,
        )

        assert result.success is True
        assert result.output == "Ollama fallback response"
        assert result.fallback_used is True
        assert "quota" in result.fallback_error

    def test_fallback_succeeds_on_resource_exhausted_exception(self):
        """Direct ResourceExhausted exception should trigger fallback."""
        from google.api_core.exceptions import ResourceExhausted
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        from vertex_orchestrator.ollama_runner import OllamaResult

        def fake_fallback(task_type, task, **kwargs):
            return OllamaResult(
                success=True,
                output="fallback ok",
                model="gemma4:31b",
            )

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise ResourceExhausted("429 Too Many Requests")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze",
            backend=failing_backend,
        )

        assert result.success is True
        assert result.fallback_used is True

    def test_fallback_disabled_does_not_fallback(self):
        """When fallback_enabled is False, should not retry on Ollama."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=False
        )
        orch = Orchestrator(config=config)

        fallback_called = False

        def fake_fallback(task_type, task, **kwargs):
            nonlocal fallback_called
            fallback_called = True
            return None

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("quota exceeded")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze",
            backend=failing_backend,
        )

        assert result.success is False
        assert result.fallback_used is False
        assert fallback_called is False
        assert "quota" in result.error

    def test_fallback_fails_both_vertex_and_ollama(self):
        """If both Vertex and Ollama fail, should return failure with both errors."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        from vertex_orchestrator.ollama_runner import OllamaResult

        def fake_fallback(task_type, task, **kwargs):
            return OllamaResult(
                success=False,
                error="Ollama also failed",
                model="gemma4:31b",
            )

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("Resource exhausted: quota exceeded")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze",
            backend=failing_backend,
        )

        assert result.success is False
        assert result.fallback_used is True
        assert "quota" in result.error
        assert "Ollama also failed" in (result.fallback_error or "")

    def test_non_retryable_error_does_not_fallback(self):
        """Non-retryable errors should not trigger fallback."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        fallback_called = False

        def fake_fallback(task_type, task, **kwargs):
            nonlocal fallback_called
            fallback_called = True
            return None

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("syntax error in task prompt")

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze",
            backend=failing_backend,
        )

        assert result.success is False
        assert result.fallback_used is False
        assert fallback_called is False
        assert "syntax error" in result.error

    def test_fallback_for_conversation_task(self):
        """Fallback should work for CONVERSATION tasks too."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        from vertex_orchestrator.ollama_runner import OllamaResult

        def fake_fallback(task_type, task, **kwargs):
            assert task_type == TaskType.CONVERSATION
            return OllamaResult(
                success=True,
                output="conversation fallback",
                model="gemma4:26b",
            )

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("Service Unavailable")

        result = orch.execute(
            task_type=TaskType.CONVERSATION,
            task="discuss something",
            backend=failing_backend,
        )

        assert result.success is True
        assert result.output == "conversation fallback"
        assert result.fallback_used is True

    def test_fallback_for_edit_task(self):
        """Fallback should work for EDIT tasks too."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        from vertex_orchestrator.ollama_runner import OllamaResult

        def fake_fallback(task_type, task, **kwargs):
            assert task_type == TaskType.EDIT
            return OllamaResult(
                success=True,
                output="edit fallback applied",
                model="gemma4:26b",
            )

        orch._run_ollama_fallback = fake_fallback

        def failing_backend(runner_type, **kwargs):
            raise RuntimeError("Deadline Exceeded")

        result = orch.execute(
            task_type=TaskType.EDIT,
            task="fix the code",
            file_path="src/main.py",
            backend=failing_backend,
        )

        assert result.success is True
        assert result.output == "edit fallback applied"
        assert result.fallback_used is True

    def test_successful_task_does_not_use_fallback(self):
        """A successful task should not set fallback_used."""
        config = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=True
        )
        orch = Orchestrator(config=config)

        def ok_backend(runner_type, **kwargs):
            return "vertex success"

        result = orch.execute(
            task_type=TaskType.ANALYSIS,
            task="analyze",
            backend=ok_backend,
        )

        assert result.success is True
        assert result.fallback_used is False
        assert result.fallback_error is None