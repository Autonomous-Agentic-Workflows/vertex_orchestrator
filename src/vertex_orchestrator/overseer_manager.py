"""Overseer manager — supervises the recovery-overseer Node.js service.

The recovery-overseer is a TypeScript/React app (Express + Vite) that
provides an MCP (Model Context Protocol) server, Google Workspace
integrations (Gmail, Slides, Tasks, Keep, Drive), and a Spark
analytics dashboard.  This module lets the Python vertex_orchestrator
act as its parent: start/stop the subprocess, proxy HTTP requests,
and expose a unified health surface.

Architecture:

    ┌─────────────────────────────────────────────────────────┐
    │  vertex_orchestrator  (Python, port 8000)               │
    │                                                         │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  OverseerManager                                  │  │
    │  │  • starts recovery-overseer (Node, port 3000)     │  │
    │  │  • proxies /overseer/proxy/* → localhost:3000     │  │
    │  │  • proxies /overseer/mcp → localhost:3000/api/mcp │  │
    │  │  • health monitoring                              │  │
    │  └───────────────────────────────────────────────────┘  │
    │           │                                             │
    │           ▼                                             │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  recovery-overseer  (Node/Express, port 3000)     │  │
    │  │  • MCP JSON-RPC 2.0 server                        │  │
    │  │  • Google Workspace tools (Gmail, Slides, etc.)   │  │
    │  │  • Spark engine + AI optimization (Gemini)        │  │
    │  │  • Cloud SQL / Firebase / Firestore               │  │
    │  └───────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────┘
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json as _json

logger = logging.getLogger(__name__)

# Default port for the recovery-overseer Node.js service
DEFAULT_OVERSEER_PORT = 3000

# Where the recovery-overseer source lives relative to the repo root
OVERSEER_DIR = Path(__file__).resolve().parent.parent.parent / "recovery_overseer"


class OverseerProcess:
    """Manages the lifecycle of the recovery-overseer Node.js subprocess."""

    def __init__(
        self,
        port: int = DEFAULT_OVERSEER_PORT,
        working_dir: Optional[str] = None,
    ) -> None:
        self.port = port
        self.working_dir = working_dir or str(OVERSEER_DIR)
        self._proc: Optional[subprocess.Popen] = None

    # --- lifecycle --------------------------------------------------

    def start(self) -> dict[str, Any]:
        """Start the recovery-overseer service if not already running."""
        if self._proc and self._proc.poll() is None:
            return {
                "status": "already_running",
                "pid": self._proc.pid,
                "port": self.port,
            }

        wd = Path(self.working_dir)
        if not wd.exists():
            return {"status": "error", "error": f"recovery_overseer dir not found: {wd}"}

        # Check for node_modules; run npm install if missing
        node_modules = wd / "node_modules"
        if not node_modules.exists():
            logger.info("node_modules missing — running npm install in %s", wd)
            install = subprocess.run(
                ["npm", "install", "--prefix", str(wd)],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if install.returncode != 0:
                return {
                    "status": "error",
                    "error": "npm install failed",
                    "stderr": install.stderr[-500:],
                }

        env = os.environ.copy()
        env["PORT"] = str(self.port)

        self._proc = subprocess.Popen(
            ["npm", "run", "dev", "--prefix", str(wd)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            # Put the subprocess in its own process group so we can
            # clean it up reliably.
            start_new_session=True,
        )
        logger.info("recovery-overseer started (pid=%d, port=%d)", self._proc.pid, self.port)

        # Give it a moment to boot, then check health
        time.sleep(2)
        health = self.check_health()
        return {
            "status": "started" if health["reachable"] else "starting",
            "pid": self._proc.pid,
            "port": self.port,
            "health": health,
        }

    def stop(self) -> dict[str, Any]:
        """Stop the recovery-overseer service."""
        if not self._proc or self._proc.poll() is not None:
            self._proc = None
            return {"status": "not_running"}

        pid = self._proc.pid
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            self._proc.wait(timeout=10)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
            self._proc.wait(timeout=5)
        finally:
            self._proc = None

        logger.info("recovery-overseer stopped (pid=%d)", pid)
        return {"status": "stopped", "pid": pid}

    # --- monitoring -------------------------------------------------

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def check_health(self) -> dict[str, Any]:
        """Probe the recovery-overseer /api/health endpoint."""
        if not self.is_running():
            return {"reachable": False, "reason": "process not running"}

        try:
            req = Request(f"http://localhost:{self.port}/api/health")
            with urlopen(req, timeout=5) as resp:
                data = _json.loads(resp.read().decode())
                return {"reachable": True, "overseer_health": data}
        except (URLError, HTTPError, TimeoutError, OSError) as exc:
            return {"reachable": False, "reason": str(exc)}

    def get_mcp_info(self) -> dict[str, Any]:
        """Fetch MCP server info from recovery-overseer."""
        return self._proxy_get("/api/mcp/info")

    def proxy_mcp(self, body: dict) -> dict[str, Any]:
        """Forward an MCP JSON-RPC 2.0 request to recovery-overseer."""
        return self._proxy_post("/api/mcp", body)

    def proxy_request(self, method: str, path: str, body: Optional[dict] = None) -> dict[str, Any]:
        """Generic proxy for any recovery-overseer API endpoint."""
        if method.upper() == "GET":
            return self._proxy_get(path)
        return self._proxy_post(path, body or {})

    # --- internal helpers -------------------------------------------

    def _proxy_get(self, path: str) -> dict[str, Any]:
        url = f"http://localhost:{self.port}{path}"
        try:
            req = Request(url)
            with urlopen(req, timeout=30) as resp:
                return _json.loads(resp.read().decode())
        except (URLError, HTTPError, TimeoutError, OSError) as exc:
            return {"success": False, "error": f"overseer proxy failed: {exc}"}

    def _proxy_post(self, path: str, body: dict) -> dict[str, Any]:
        url = f"http://localhost:{self.port}{path}"
        try:
            data = _json.dumps(body).encode("utf-8")
            req = Request(url, data=data, headers={"Content-Type": "application/json"})
            with urlopen(req, timeout=30) as resp:
                return _json.loads(resp.read().decode())
        except (URLError, HTTPError, TimeoutError, OSError) as exc:
            return {"success": False, "error": f"overseer proxy failed: {exc}"}


# Module-level singleton so the subprocess persists across HTTP requests
_overseer: Optional[OverseerProcess] = None


def get_overseer() -> OverseerProcess:
    """Return the shared OverseerProcess singleton."""
    global _overseer
    if _overseer is None:
        _overseer = OverseerProcess()
    return _overseer