"""Tests for OllamaConfig — the local Ollama fallback configuration."""
import pytest
from vertex_orchestrator.config import OllamaConfig, VertexAIConfig


class TestOllamaConfigCreation:
    """OllamaConfig creation, defaults, and validation."""

    def test_creates_config_with_defaults(self):
        """OllamaConfig should create with sensible defaults."""
        cfg = OllamaConfig()
        assert cfg.endpoint == "127.0.0.1:11434"
        assert cfg.temperature == 0.2

    def test_default_model_mapping(self):
        """Default model mapping should map task types to Ollama models."""
        cfg = OllamaConfig()
        assert cfg.model_mapping["analysis"] == "gemma4:31b"
        assert cfg.model_mapping["conversation"] == "gemma4:26b"
        assert cfg.model_mapping["edit"] == "gemma4:26b"

    def test_custom_endpoint(self):
        """Custom endpoint should be stored."""
        cfg = OllamaConfig(endpoint="192.168.1.100:11434")
        assert cfg.endpoint == "192.168.1.100:11434"

    def test_missing_endpoint_raises(self):
        """Empty endpoint should raise ValueError."""
        with pytest.raises(ValueError, match="endpoint"):
            OllamaConfig(endpoint="")

    def test_empty_model_mapping_raises(self):
        """Empty model_mapping should raise ValueError."""
        with pytest.raises(ValueError, match="model_mapping"):
            OllamaConfig(model_mapping={})

    def test_api_base_adds_scheme(self):
        """api_base should prepend http:// if no scheme present."""
        cfg = OllamaConfig(endpoint="127.0.0.1:11434")
        assert cfg.api_base == "http://127.0.0.1:11434"

    def test_api_base_preserves_scheme(self):
        """api_base should not double-prefix an existing scheme."""
        cfg = OllamaConfig(endpoint="https://ollama.example.com:11434")
        assert cfg.api_base == "https://ollama.example.com:11434"


class TestOllamaConfigFromVertexConfig:
    """from_vertex_config factory should mirror Vertex settings."""

    def test_inherits_temperature(self):
        """from_vertex_config should inherit temperature from Vertex config."""
        vertex = VertexAIConfig(
            project_id="p", location="us-central1", temperature=0.7
        )
        ollama = OllamaConfig.from_vertex_config(vertex)
        assert ollama.temperature == 0.7

    def test_uses_default_endpoint(self):
        """from_vertex_config should use the default Ollama endpoint."""
        vertex = VertexAIConfig(project_id="p", location="us-central1")
        ollama = OllamaConfig.from_vertex_config(vertex)
        assert ollama.endpoint == "127.0.0.1:11434"

    def test_uses_default_model_mapping(self):
        """from_vertex_config should use the default model mapping."""
        vertex = VertexAIConfig(project_id="p", location="us-central1")
        ollama = OllamaConfig.from_vertex_config(vertex)
        assert ollama.model_mapping["analysis"] == "gemma4:31b"

    def test_vertex_config_ollama_fallback_property(self):
        """VertexAIConfig.ollama_fallback should produce an OllamaConfig."""
        vertex = VertexAIConfig(project_id="p", location="us-central1", temperature=0.5)
        ollama = vertex.ollama_fallback
        assert isinstance(ollama, OllamaConfig)
        assert ollama.temperature == 0.5


class TestOllamaConfigModelFor:
    """model_for() should return the correct Ollama model for a task type."""

    def test_analysis_returns_gemma4_31b(self):
        cfg = OllamaConfig()
        assert cfg.model_for("analysis") == "gemma4:31b"

    def test_conversation_returns_gemma4_26b(self):
        cfg = OllamaConfig()
        assert cfg.model_for("conversation") == "gemma4:26b"

    def test_edit_returns_gemma4_26b(self):
        cfg = OllamaConfig()
        assert cfg.model_for("edit") == "gemma4:26b"

    def test_case_insensitive(self):
        """model_for should accept uppercase task type values."""
        cfg = OllamaConfig()
        assert cfg.model_for("ANALYSIS") == "gemma4:31b"

    def test_unknown_task_type_raises(self):
        """Unknown task type should raise ValueError."""
        cfg = OllamaConfig()
        with pytest.raises(ValueError, match="No Ollama model mapped"):
            cfg.model_for("unknown")


class TestVertexAIConfigFallbackFlag:
    """VertexAIConfig should support fallback_enabled flag."""

    def test_fallback_defaults_to_true(self):
        """fallback_enabled should default to True."""
        cfg = VertexAIConfig(project_id="p", location="us-central1")
        assert cfg.fallback_enabled is True

    def test_fallback_can_be_disabled(self):
        """fallback_enabled should be settable to False."""
        cfg = VertexAIConfig(
            project_id="p", location="us-central1", fallback_enabled=False
        )
        assert cfg.fallback_enabled is False