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
    production, the default backend constructs AutoGen agents with the
    Vertex AI config and initiates the conversation.
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
        """Production backend using real AutoGen. Requires pyautogen installed."""
        try:
            import autogen  # type: ignore[import-untyped]
        except ImportError:
            try:
                from autogen_agentchat import AssistantAgent, UserProxyAgent  # type: ignore[import-untyped]
                from autogen_core import CancellationToken  # type: ignore[import-untyped]
            except ImportError as exc:
                raise ImportError(
                    "pyautogen is not installed. Install with: pip install pyautogen"
                ) from exc

        config_list = [config_entry]
        assistant = autogen.AssistantAgent(
            name="Vertex_Agent",
            llm_config={"config_list": config_list},
            system_message=system_message,
        )
        user_proxy = autogen.UserProxyAgent(
            name="User",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
        )
        messages = message if isinstance(message, list) else [message]
        user_proxy.initiate_chat(assistant, message=messages[0])
        return str(user_proxy.last_message()["content"])