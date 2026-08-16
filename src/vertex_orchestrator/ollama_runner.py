"""Ollama runner — local fallback backend using litellm with Ollama.

When Vertex AI is unavailable (quota exhausted, service down, auth
failure), the orchestrator retries the task on a local Ollama instance
via litellm's ``ollama/`` provider.  This runner mirrors the interface
of the three Vertex-backed runners (CrewAI, AutoGen, Aider) but routes
through ``litellm.completion(model="ollama/<model>", api_base=...)``
instead of ``vertex_ai/``.
"""
from __future__ import annotations

from typing import Callable, Optional, Union

from vertex_orchestrator.config import OllamaConfig


class OllamaResult:
    """Result of an Ollama fallback execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.success = success
        self.output = output
        self.error = error
        self.model = model

    def __repr__(self) -> str:
        if self.success:
            return f"OllamaResult(success=True, model={self.model!r}, output={self.output!r})"
        return f"OllamaResult(success=False, model={self.model!r}, error={self.error!r})"


# Type for the callable backend: (model_string, messages, temperature, api_base) -> str
BackendFn = Callable[[str, list, float, str], str]


class OllamaRunner:
    """Runs a single task through a local Ollama instance via litellm.

    The ``backend`` parameter on ``run()`` allows injecting a test
    double.  In production, the default backend calls
    ``litellm.completion`` with the ``ollama/`` provider and the
    Ollama HTTP endpoint as ``api_base``.
    """

    def __init__(
        self,
        config: OllamaConfig,
        task: str,
        task_type_value: str = "analysis",
        system_message: Optional[str] = None,
        message: Optional[Union[str, list]] = None,
    ) -> None:
        self.config = config
        self.task = task
        self.task_type_value = task_type_value
        self.system_message = system_message or "You are a helpful assistant."
        self.message = message if message is not None else task

    @property
    def model_name(self) -> str:
        """The local Ollama model name for this task type."""
        return self.config.model_for(self.task_type_value)

    @property
    def litellm_model_string(self) -> str:
        """Full litellm model string: ``ollama/<model>``."""
        return f"ollama/{self.model_name}"

    @property
    def api_base(self) -> str:
        """The Ollama OpenAI-compatible API base URL."""
        return self.config.api_base

    def run(self, backend: Optional[BackendFn] = None) -> OllamaResult:
        """Execute the task on Ollama and return an OllamaResult.

        If no backend is provided, uses the default litellm backend
        (requires litellm installed and Ollama running).
        """
        if backend is None:
            backend = self._default_backend

        messages = self._build_messages()

        try:
            output = backend(
                self.litellm_model_string,
                messages,
                self.config.temperature,
                self.api_base,
            )
            return OllamaResult(
                success=True,
                output=output,
                model=self.model_name,
            )
        except Exception as exc:
            return OllamaResult(
                success=False,
                error=str(exc),
                model=self.model_name,
            )

    def _build_messages(self) -> list[dict]:
        """Build the litellm messages list from system_message and message."""
        messages: list[dict] = [{"role": "system", "content": self.system_message}]
        if isinstance(self.message, list):
            for msg in self.message:
                messages.append({"role": "user", "content": msg})
        else:
            messages.append({"role": "user", "content": str(self.message)})
        return messages

    def _default_backend(
        self,
        model_string: str,
        messages: list,
        temperature: float,
        api_base: str,
    ) -> str:
        """Production backend using litellm with the Ollama provider.

        Routes through ``litellm.completion`` with ``model="ollama/<name>"``
        and ``api_base`` pointing at the local Ollama instance's
        OpenAI-compatible endpoint.
        """
        try:
            import litellm  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "litellm is not installed. Install with: pip install litellm"
            ) from exc

        response = litellm.completion(
            model=model_string,
            messages=messages,
            temperature=temperature,
            api_base=api_base,
            max_tokens=4096,
        )
        return response.choices[0].message.content


def check_ollama_available(config: OllamaConfig) -> tuple[bool, list[str]]:
    """Check whether the Ollama endpoint is reachable and list available models.

    Returns ``(reachable, model_names)``.  Uses a lightweight HTTP GET
    to ``<endpoint>/api/tags`` — does not import litellm.
    """
    import json
    import urllib.request
    import urllib.error

    api_base = config.api_base
    url = f"{api_base}/api/tags"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        models = [m.get("name", "") for m in data.get("models", [])]
        return True, models
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return False, []