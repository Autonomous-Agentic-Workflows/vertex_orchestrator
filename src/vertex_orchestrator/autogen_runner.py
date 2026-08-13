"""AutoGen runner — runs multi-agent conversations via Vertex AI."""
from __future__ import annotations

from typing import Callable, Optional, Union

from vertex_orchestrator.config import VertexAIConfig


class ConversationResult:
    """Result of an AutoGen conversation execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        self.success = success
        self.output = output
        self.error = error

    def __repr__(self) -> str:
        if self.success:
            return f"ConversationResult(success=True, output={self.output!r})"
        return f"ConversationResult(success=False, error={self.error!r})"


# Type for the callable backend that simulates or wraps AutoGen's conversation
BackendFn = Callable[[str, Union[str, list], dict], str]


class AutoGenRunner:
    """Runs a multi-agent conversation through AutoGen using Vertex AI.

    The ``backend`` parameter on ``run()`` allows injecting a real AutoGen
    AssistantAgent + UserProxyAgent interaction or a test double. In
    production, the default backend uses litellm (the same engine AutoGen
    and CrewAI use internally) to route through Vertex AI.
    """

    def __init__(
        self,
        config: VertexAIConfig,
        system_message: str,
        message: Union[str, list[str]],
    ) -> None:
        self.config = config
        self.system_message = system_message
        self.message = message

    @property
    def config_entry(self) -> dict:
        """The AutoGen config_list entry with google api_type."""
        return self.config.autogen_config_entry

    def run(self, backend: Optional[BackendFn] = None) -> ConversationResult:
        """Execute the conversation and return a ConversationResult.

        If no backend is provided, uses the default AutoGen backend
        (requires pyautogen to be installed).
        """
        if backend is None:
            backend = self._default_backend

        try:
            output = backend(self.system_message, self.message, self.config_entry)
            return ConversationResult(success=True, output=output)
        except Exception as exc:
            return ConversationResult(success=False, error=str(exc))

    def _default_backend(
        self, system_message: str, message: Union[str, list], config_entry: dict
    ) -> str:
        """Production backend using litellm for Vertex AI access.

        AutoGen 0.7+ uses litellm internally for model calls. We use the
        same litellm engine to route through Vertex AI with ADC credentials,
        which provides the same enterprise IP protection.
        """
        try:
            import litellm  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "litellm is not installed. Install with: pip install litellm"
            ) from exc

        model_name = config_entry.get("model", "gemini-2.5-pro")
        messages_list = message if isinstance(message, list) else [message]

        # Build the message list for litellm
        messages = [{"role": "system", "content": system_message}]
        for msg in messages_list:
            messages.append({"role": "user", "content": msg})

        response = litellm.completion(
            model=f"vertex_ai/{model_name}",
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=2048,
        )
        return response.choices[0].message.content