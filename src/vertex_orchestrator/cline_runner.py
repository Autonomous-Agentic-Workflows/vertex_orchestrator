"""Cline runner — wraps the Cline CLI as a 4th task provider.

Cline is an autonomous coding agent CLI that can edit files, run
commands, and analyze code. This runner invokes it via subprocess
for tasks that benefit from agentic file editing with local Ollama
models.

The runner expects the Cline CLI to be available on PATH (or at
the configured binary path). It delegates to Cline's non-interactive
mode: ``cline -P <provider> -m <model> "<prompt>"``.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ClineConfig:
    """Configuration for the Cline CLI runner."""

    binary: str = field(default_factory=lambda: shutil.which("cline") or os.path.expanduser("~/.local/bin/cline-oss"))
    provider: str = "ollama"
    model: str = "gemma4:26b"
    timeout: int = 120  # seconds
    working_dir: str = ""


class ClineResult:
    """Result of a Cline CLI execution."""

    def __init__(
        self,
        success: bool,
        output: Optional[str] = None,
        error: Optional[str] = None,
        exit_code: int = 0,
    ) -> None:
        self.success = success
        self.output = output
        self.error = error
        self.exit_code = exit_code

    def __repr__(self) -> str:
        if self.success:
            return f"ClineResult(success=True, output={self.output!r})"
        return f"ClineResult(success=False, error={self.error!r}, exit_code={self.exit_code})"


class ClineRunner:
    """Runs a task through the Cline CLI as a subprocess.

    Example::

        config = ClineConfig(model="gemma4:31b")
        runner = ClineRunner(config=config, task="fix the failing tests")
        result = runner.run()
    """

    def __init__(
        self,
        config: ClineConfig,
        task: str,
        working_dir: Optional[str] = None,
    ) -> None:
        self.config = config
        self.task = task
        self.working_dir = working_dir or config.working_dir or os.getcwd()

    def _build_command(self) -> list[str]:
        """Build the Cline CLI command."""
        cmd = [self.config.binary, "-P", self.config.provider, "-m", self.config.model, self.task]
        return cmd

    def run(self, mock_exec: Optional[callable] = None) -> ClineResult:
        """Execute the Cline CLI and return a ClineResult.

        Args:
            mock_exec: Optional callable that receives (cmd, cwd, timeout)
                       and returns (exit_code, stdout, stderr). For testing.
        """
        cmd = self._build_command()

        if mock_exec is not None:
            exit_code, stdout, stderr = mock_exec(cmd, self.working_dir, self.config.timeout)
        elif not os.path.isfile(self.config.binary):
            return ClineResult(
                success=False,
                error=f"Cline binary not found at {self.config.binary}. Install with: npm install -g cline",
            )
        else:
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=self.working_dir,
                    capture_output=True,
                    text=True,
                    timeout=self.config.timeout,
                )
                exit_code = proc.returncode
                stdout = proc.stdout
                stderr = proc.stderr
            except subprocess.TimeoutExpired:
                return ClineResult(
                    success=False,
                    error=f"Cline timed out after {self.config.timeout}s",
                    exit_code=-1,
                )
            except FileNotFoundError:
                return ClineResult(
                    success=False,
                    error=f"Cline binary not found at {self.config.binary}",
                )

        if exit_code == 0:
            return ClineResult(success=True, output=stdout.strip(), exit_code=exit_code)
        else:
            return ClineResult(
                success=False,
                output=stdout.strip() if stdout else None,
                error=stderr.strip() or f"Cline exited with code {exit_code}",
                exit_code=exit_code,
            )