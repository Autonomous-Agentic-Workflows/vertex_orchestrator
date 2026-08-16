"""Vertex AI configuration for enterprise Google Cloud connections.

Also provides ``OllamaConfig`` — a local fallback configuration that
mirrors the Vertex AI config but routes requests to a local Ollama
instance when Vertex AI is unavailable or rate-limited.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class VertexAIConfig:
    """Configuration for routing agent requests through Google Vertex AI.

    Holds the Google Cloud project boundary, model selection, and
    produces the model-string formats that CrewAI, AutoGen, and Aider
    each expect.

    ``fallback_enabled`` (default True) controls whether the
    orchestrator automatically retries failed Vertex AI requests on a
    local Ollama instance.
    """

    project_id: str = ""
    location: str = ""
    model: str = "gemini-2.5-pro"
    temperature: float = 0.2
    fallback_enabled: bool = True

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

    @property
    def ollama_fallback(self) -> "OllamaConfig":
        """Convenience property: build the corresponding OllamaConfig."""
        return OllamaConfig.from_vertex_config(self)


@dataclass
class OllamaConfig:
    """Configuration for routing agent requests through a local Ollama instance.

    Used as a fallback when Vertex AI is unavailable or rate-limited.
    Each ``TaskType`` maps to a local Ollama model name, so the
    orchestrator can select a model appropriate to the task without
    re-negotiating the Vertex AI model string.
    """

    endpoint: str = "127.0.0.1:11434"
    temperature: float = 0.2
    # Maps the string value of TaskType to a local Ollama model name.
    # ANALYSIS -> gemma4:31b (larger model for structured analysis)
    # CONVERSATION -> gemma4:26b (balanced for multi-turn dialogue)
    # EDIT -> gemma4:26b (balanced for code editing)
    model_mapping: dict = field(default_factory=lambda: {
        "analysis": "gemma4:31b",
        "conversation": "gemma4:26b",
        "edit": "gemma4:26b",
    })

    def __post_init__(self) -> None:
        if not self.endpoint:
            raise ValueError("endpoint is required")
        if not self.model_mapping:
            raise ValueError("model_mapping is required")

    @classmethod
    def from_vertex_config(cls, vertex_config: VertexAIConfig) -> "OllamaConfig":
        """Build an OllamaConfig that mirrors a VertexAIConfig's settings.

        Inherits ``temperature`` from the Vertex config and uses the
        default local endpoint and model mapping.
        """
        return cls(
            temperature=vertex_config.temperature,
        )

    def model_for(self, task_type_value: str) -> str:
        """Return the Ollama model name for a given TaskType string value."""
        key = task_type_value.lower()
        if key not in self.model_mapping:
            raise ValueError(
                f"No Ollama model mapped for task type {task_type_value!r}; "
                f"available: {list(self.model_mapping)}"
            )
        return self.model_mapping[key]

    @property
    def api_base(self) -> str:
        """The Ollama OpenAI-compatible API base URL."""
        # Ensure scheme present
        ep = self.endpoint
        if not ep.startswith("http://") and not ep.startswith("https://"):
            ep = f"http://{ep}"
        return ep

    @property
    def litellm_model_prefix(self) -> str:
        """The litellm model prefix for Ollama (``ollama/``)."""
        return "ollama"