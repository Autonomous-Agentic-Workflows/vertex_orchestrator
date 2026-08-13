"""Aider runner — invokes aider CLI on local files via Vertex AI."""
from __future__ import annotations

import shlex
from typing import Callable, Optional

from vertex_orchestrator.config import VertexAIConfig


class EditResult:
    """Result of an Aider file editing session."""

    def __init__(
        self,
        success: bool,
        summary: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        self.success = success
        self.summary = summary
        self.error = error

    def __repr__(self) -> str:
        if self.success:
            return f"EditResult(success=True, summary={self.summary!r})"
        return f"EditResult(success=False, error={self.error!r})"


# Type for the callable backend that simulates or wraps aider CLI
BackendFn = Callable[[str, str, str], str]


class AiderRunner:
    """Runs an Aider pair-programming session using a Vertex AI-backed model.

    The ``backend`` parameter on ``run()`` allows injecting a real Aider
    subprocess call or a test double. In production, the default backend
    shells out to the aider CLI with the Vertex AI model flag.
    """

    def __init__(
        self,
        config: VertexAIConfig,
        file_path: str,
        edit_instruction: str,
    ) -> None:
        self.config = config
        self.file_path = file_path
        self.edit_instruction = edit_instruction

    @property
    def model_string(self) -> str:
        """The vertex_ai/ prefixed model string for Aider CLI."""
        return self.config.aider_model_string

    @property
    def cli_command(self) -> str:
        """The full aider CLI command string for this edit session."""
        parts = [
            "aider",
            f"--model {self.model_string}",
            f"--message {shlex.quote(self.edit_instruction)}",
            shlex.quote(self.file_path),
        ]
        return " ".join(parts)

    def run(self, backend: Optional[BackendFn] = None) -> EditResult:
        """Execute the edit session and return an EditResult.

        If no backend is provided, uses the default Aider backend
        (requires aider-chat to be installed).
        """
        if backend is None:
            backend = self._default_backend

        try:
            summary = backend(self.file_path, self.edit_instruction, self.model_string)
            return EditResult(success=True, summary=summary)
        except Exception as exc:
            return EditResult(success=False, error=str(exc))

    def _default_backend(self, file_path: str, edit_instruction: str, model_string: str) -> str:
        """Production backend using real Aider CLI. Requires aider-chat installed."""
        import subprocess

        cmd = [
            "aider",
            "--model", model_string,
            "--message", edit_instruction,
            file_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout