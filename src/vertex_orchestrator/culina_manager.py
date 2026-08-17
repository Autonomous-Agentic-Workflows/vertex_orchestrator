"""Culina manager — supervises the culina-ai Node.js service.

Culina AI Studio Orchestrator is a TypeScript/React app (Express +
WebSocket + Gemini AI + Firebase + PostgreSQL) that provides
enterprise recovery orchestration, legacy contact management, Google
Keep notes, and Live API integration. This module lets the Python
vertex_orchestrator act as its parent, mirroring OverseerManager.

Architecture:

    ┌─────────────────────────────────────────────────────────┐
    │  vertex_orchestrator  (Python, port 8000)               │
    │                                                         │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  CulinaManager                                    │  │
    │  │  • starts culina-ai (Node, port 3001)             │  │
    │  │  • proxies /culina/proxy/* → localhost:3001       │  │
    │  │  • WebSocket relay at /culina/live                 │  │
    │  │  • health monitoring                              │  │
    │  └───────────────────────────────────────────────────┘  │
    │           │                                             │
    │           ▼                                             │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │  culina-ai  (Node/Express, port 3001)             │  │
    │  │  • Gemini AI (thinking, Veo, Live API)            │  │
    │  │  • WebSocket server at /live                       │  │
    │  │  • Firebase Auth + Firestore                       │  │
    │  │  • PostgreSQL (Drizzle ORM)                        │  │
    │  │  • Google Workspace integration                    │  │
    │  │  • Enterprise domain: 208fenceandgate.com          │  │
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

# Default port for the culina-ai Node.js service (offset from overseer's 3000)
DEFAULT_CULINA_PORT = 3001

# Where the culina-ai source lives
CULINA_DIR = Path(os.environ.get("CULINA_DIR", "/home/conor-ops/culina-ai"))


class CulinaProcess:
    """Manages the lifecycle of the culina-ai Node.js subprocess."""

    def __init__(
        self,
        port: int = DEFAULT_CULINA_PORT,
        working_dir: Optional[str] = None,
    ) -> None:
        self.port = port
        self.working_dir = working_dir or str(CULINA_DIR)
        self._proc: Optional[subprocess.Popen] = None

    # --- lifecycle --------------------------------------------------

    def start(self) -> dict[str, Any]:
        """Start the culina-ai service if not already running."""
        if self._proc and self._proc.poll() is None:
            return {
                "status": "already_running",
                "pid": self._proc.pid,
                "port": self.port,
            }

        wd = Path(self.working_dir)
        if not wd.exists():
            return {"status": "error", "error": f"culina-ai dir not found: {wd}"}

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
            start_new_session=True,
        )
        logger.info("culina-ai started (pid=%d, port=%d)", self._proc.pid, self.port)

        time.sleep(2)
        health = self.check_health()
        return {
            "status": "started" if health["reachable"] else "starting",
            "pid": self._proc.pid,
            "port": self.port,
            "health": health,
        }

    def stop(self) -> dict[str, Any]:
        """Stop the culina-ai service."""
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

        logger.info("culina-ai stopped (pid=%d)", pid)
        return {"status": "stopped", "pid": pid}

    # --- monitoring -------------------------------------------------

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def check_health(self) -> dict[str, Any]:
        """Probe the culina-ai health endpoint."""
        if not self.is_running():
            return {"reachable": False, "reason": "process not running"}

        try:
            req = Request(f"http://localhost:{self.port}/api/health")
            with urlopen(req, timeout=5) as resp:
                data = _json.loads(resp.read().decode())
                return {"reachable": True, "culina_health": data}
        except (URLError, HTTPError, TimeoutError, OSError) as exc:
            return {"reachable": False, "reason": str(exc)}

    def proxy_request(self, method: str, path: str, body: Optional[dict] = None) -> dict[str, Any]:
        """Generic proxy for any culina-ai API endpoint."""
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
            return {"success": False, "error": f"culina proxy failed: {exc}"}

    def _proxy_post(self, path: str, body: dict) -> dict[str, Any]:
        url = f"http://localhost:{self.port}{path}"
        try:
            data = _json.dumps(body).encode("utf-8")
            req = Request(url, data=data, headers={"Content-Type": "application/json"})
            with urlopen(req, timeout=30) as resp:
                return _json.loads(resp.read().decode())
        except (URLError, HTTPError, TimeoutError, OSError) as exc:
            return {"success": False, "error": f"culina proxy failed: {exc}"}


# Module-level singleton
_culina: Optional[CulinaProcess] = None


def get_culina() -> CulinaProcess:
    """Return the shared CulinaProcess singleton."""
    global _culina
    if _culina is None:
        _culina = CulinaProcess()
    return _culina