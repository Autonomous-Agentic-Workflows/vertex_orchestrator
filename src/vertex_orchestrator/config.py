"""Vertex AI configuration for enterprise Google Cloud connections."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class VertexAIConfig:
    """Configuration for routing agent requests through Google Vertex AI.

    Holds the Google Cloud project boundary, model selection, and
    produces the model-string formats that CrewAI, AutoGen, and Aider
    each expect.
    """

    project_id: str = ""
    location: str = ""
    model: str = "gemini-2.5-pro"
    temperature: float = 0.2

    def __post_init__(self) -> None:
        if not self.project_id:
            raise ValueError("project_id is required")
        if not self.location:
            raise ValueError("location is required")

    @property
    def crewai_model_string(self) -> str:
        """Model string prefixed with vertex_ai/ for CrewAI's LLM class."""
        return f"vertex_ai/{self.model}"

    @property
    def aider_model_string(self) -> str:
        """Model string prefixed with vertex_ai/ for Aider CLI."""
        return f"vertex_ai/{self.model}"

    @property
    def autogen_config_entry(self) -> dict:
        """Config dict for AutoGen's config_list with google api_type."""
        return {
            "model": self.model,
            "api_type": "google",
        }