"""Tests for VertexAIConfig — the configuration object for Google Vertex AI connections."""
import os
import pytest
from vertex_orchestrator.config import VertexAIConfig


class TestVertexAIConfigCreation:
    """Tracer bullet 1: config creation and validation."""

    def test_creates_config_with_required_fields(self):
        """A config built with project_id and location should store those values."""
        config = VertexAIConfig(
            project_id="my-corporate-project",
            location="us-central1",
        )
        assert config.project_id == "my-corporate-project"
        assert config.location == "us-central1"

    def test_default_model_is_gemini_25_pro(self):
        """The default model should be gemini-2.5-pro for enterprise use."""
        config = VertexAIConfig(
            project_id="my-project",
            location="us-central1",
        )
        assert config.model == "gemini-2.5-pro"

    def test_custom_model_overrides_default(self):
        """A custom model should override the default."""
        config = VertexAIConfig(
            project_id="my-project",
            location="us-central1",
            model="gemini-2.5-flash",
        )
        assert config.model == "gemini-2.5-flash"

    def test_missing_project_id_raises(self):
        """Config without project_id should raise ValueError."""
        with pytest.raises(ValueError, match="project_id"):
            VertexAIConfig(project_id="", location="us-central1")

    def test_missing_location_raises(self):
        """Config without location should raise ValueError."""
        with pytest.raises(ValueError, match="location"):
            VertexAIConfig(project_id="my-project", location="")

    def test_temperature_defaults_to_0_2(self):
        """Default temperature should be 0.2 for controlled enterprise output."""
        config = VertexAIConfig(project_id="p", location="us-central1")
        assert config.temperature == 0.2

    def test_vertex_model_string_for_crewai(self):
        """Should produce the vertex_ai/ prefixed model string CrewAI expects."""
        config = VertexAIConfig(project_id="p", location="us-central1")
        assert config.crewai_model_string == "vertex_ai/gemini-2.5-pro"

    def test_aider_model_string(self):
        """Should produce the vertex_ai/ model string Aider expects."""
        config = VertexAIConfig(project_id="p", location="us-central1")
        assert config.aider_model_string == "vertex_ai/gemini-2.5-pro"

    def test_autogen_config_entry(self):
        """Should produce the config dict AutoGen expects with google api_type."""
        config = VertexAIConfig(project_id="p", location="us-central1")
        entry = config.autogen_config_entry
        assert entry["model"] == "gemini-2.5-pro"
        assert entry["api_type"] == "google"