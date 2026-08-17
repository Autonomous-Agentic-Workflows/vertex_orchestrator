"""Agents CLI manager — wraps the google-agents-cli tool for agent lifecycle ops.

google-agents-cli is Google's official CLI for scaffolding, evaluating,
deploying, and publishing ADK agents on Google Cloud. This module wraps
the CLI commands so the vertex_orchestrator can invoke them via REST/MCP
and the A2A router can route messages to agents-cli as a managed service.

Supported operations:
  - create:   Scaffold a new agent project from templates
  - deploy:    Deploy an agent to Agent Runtime / Cloud Run / GKE
  - eval:      Run evaluation (generate + grade + compare)
  - run:       Run an agent with a single prompt (non-interactive)
  - info:      Show project config and CLI version
  - lint:      Run code quality checks
  - playground: Start/stop the local agent playground server
  - list:      List deployed agents

Architecture:

    ┌─────────────────────────────────────────────────────────┐
    │  vertex_orchestrator  (Python, port 8000)               │
    │                                                         │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  AgentsCliManager                                 │  │
    │  │  • wraps agents-cli commands as subprocess calls  │  │
    │  │  • playground server lifecycle (port 8080)        │  │
    │  │  • A2A-compatible (agent card via deploy)         │  │
    │  └───────────────────────────────────────────────────┘  │
    │           │                                             │
    │           ▼                                             │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  agents-cli (google-agents-cli v1.3.1)            │  │
    │  │  • scaffold + create agent projects               │  │
    │  │  • deploy to Agent Runtime / Cloud Run / GKE      │  │
    │  │  • eval (generate, grade, compare, optimize)      │  │
    │  │  • publish to Agent Runtime / AI Studio           │  │
    │  │  • playground (local dev server)                  │  │
    │  └───────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────┘
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_PLAYGROUND_PORT = 8080


class AgentsCliManager:
    """Wraps the google-agents-cli CLI for agent lifecycle operations."""

    def __init__(self, cli_path: Optional[str] = None) -> None:
        self.cli_path = cli_path or shutil.which("agents-cli") or "agents-cli"
        self._playground_proc: Optional[subprocess.Popen] = None
        self._playground_port: int = DEFAULT_PLAYGROUND_PORT

    # --- helpers --------------------------------------------------

    def _run_cli(self, args: list[str], cwd: Optional[str] = None,
                 timeout: int = 120) -> dict[str, Any]:
        """Run agents-cli with the given args and capture output."""
        cmd = [self.cli_path] + args
        env = {**os.environ, "PATH": os.environ.get("PATH", "")}
        # Ensure uv/uvx is on PATH
        local_bin = str(Path.home() / ".local" / "bin")
        env["PATH"] = local_bin + ":" + env["PATH"]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd,
                env=env,
            )
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"command timed out after {timeout}s",
                    "command": " ".join(cmd)}
        except FileNotFoundError:
            return {"success": False, "error": "agents-cli not found on PATH",
                    "command": " ".join(cmd)}

    def version(self) -> dict[str, Any]:
        """Get the agents-cli version."""
        result = self._run_cli(["--version"])
        return result

    def info(self, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Show project configuration, paths, and CLI version."""
        args = ["info"]
        result = self._run_cli(args, cwd=project_dir)
        return result

    # --- scaffold / create ----------------------------------------

    def create(self, project_name: str, output_dir: str = ".",
               agent_template: Optional[str] = None,
               deployment_target: Optional[str] = None) -> dict[str, Any]:
        """Create a new agent project from templates."""
        args = ["create", project_name, "-o", output_dir]
        if agent_template:
            args.extend(["-a", agent_template])
        if deployment_target:
            args.extend(["-d", deployment_target])
        result = self._run_cli(args, timeout=180)
        return result

    def scaffold_enhance(self, project_dir: str) -> dict[str, Any]:
        """Add deployment/CI-CD to an existing project."""
        result = self._run_cli(["scaffold", "enhance", project_dir], cwd=project_dir)
        return result

    # --- deploy ---------------------------------------------------

    def deploy(self, project_dir: Optional[str] = None,
               deployment_target: Optional[str] = None,
               list_deployments: bool = False,
               no_wait: bool = False) -> dict[str, Any]:
        """Deploy an agent to Agent Runtime / Cloud Run / GKE."""
        args = ["deploy"]
        if list_deployments:
            args.append("--list")
        if deployment_target:
            args.extend(["--deployment-target", deployment_target])
        if no_wait:
            args.append("--no-wait")
        result = self._run_cli(args, cwd=project_dir, timeout=300)
        return result

    # --- eval -----------------------------------------------------

    def eval_run(self, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Run evaluation (generate + grade in one command)."""
        result = self._run_cli(["eval", "run"], cwd=project_dir, timeout=300)
        return result

    def eval_generate(self, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Run agent inference over eval cases."""
        result = self._run_cli(["eval", "generate"], cwd=project_dir, timeout=300)
        return result

    def eval_grade(self, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Grade generated eval traces."""
        result = self._run_cli(["eval", "grade"], cwd=project_dir, timeout=300)
        return result

    def eval_compare(self, file_a: str, file_b: str) -> dict[str, Any]:
        """Compare two eval result JSON files."""
        result = self._run_cli(["eval", "compare", file_a, file_b], timeout=120)
        return result

    # --- run ------------------------------------------------------

    def run_agent(self, prompt: str, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Run the agent with a single prompt (non-interactive)."""
        result = self._run_cli(["run", prompt], cwd=project_dir, timeout=180)
        return result

    # --- lint -----------------------------------------------------

    def lint(self, project_dir: Optional[str] = None) -> dict[str, Any]:
        """Run code quality checks."""
        result = self._run_cli(["lint"], cwd=project_dir)
        return result

    # --- publish --------------------------------------------------

    def publish(self, target: str = "agent_runtime",
                project_dir: Optional[str] = None) -> dict[str, Any]:
        """Publish an agent to a target (agent_runtime, ai_studio)."""
        args = ["publish", target]
        result = self._run_cli(args, cwd=project_dir, timeout=300)
        return result

    # --- playground (long-running) --------------------------------

    def start_playground(self, port: int = DEFAULT_PLAYGROUND_PORT,
                         project_dir: Optional[str] = None) -> dict[str, Any]:
        """Start the local agent playground server."""
        if self._playground_proc and self._playground_proc.poll() is None:
            return {"status": "already_running", "pid": self._playground_proc.pid,
                    "port": self._playground_port}

        env = {**os.environ}
        local_bin = str(Path.home() / ".local" / "bin")
        env["PATH"] = local_bin + ":" + env.get("PATH", "")

        cmd = [self.cli_path, "playground", "--port", str(port)]
        try:
            self._playground_proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=project_dir,
                env=env,
            )
            self._playground_port = port
            return {"status": "started", "pid": self._playground_proc.pid,
                    "port": port}
        except FileNotFoundError:
            return {"status": "error", "error": "agents-cli not found"}
        except OSError as exc:
            return {"status": "error", "error": str(exc)}

    def stop_playground(self) -> dict[str, Any]:
        """Stop the playground server."""
        if not self._playground_proc or self._playground_proc.poll() is not None:
            return {"status": "not_running"}
        self._playground_proc.terminate()
        try:
            self._playground_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self._playground_proc.kill()
            self._playground_proc.wait(timeout=5)
        pid = self._playground_proc.pid
        self._playground_proc = None
        return {"status": "stopped", "pid": pid}

    def playground_status(self) -> dict[str, Any]:
        """Check if the playground is running."""
        if self._playground_proc and self._playground_proc.poll() is None:
            return {"running": True, "pid": self._playground_proc.pid,
                    "port": self._playground_port}
        return {"running": False}


# Singleton
_cli_manager: Optional[AgentsCliManager] = None


def get_agents_cli() -> AgentsCliManager:
    """Get the singleton AgentsCliManager instance."""
    global _cli_manager
    if _cli_manager is None:
        _cli_manager = AgentsCliManager()
    return _cli_manager