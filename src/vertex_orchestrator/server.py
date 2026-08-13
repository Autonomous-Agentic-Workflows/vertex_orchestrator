"""REST API server for the vertex_orchestrator backend.

Exposes a simple HTTP API that the DevGate Android app connects to
via the HermesBridgeClient. This allows the mobile app to route tasks
to CrewAI, AutoGen, and Aider running on the host machine with
Google Cloud Vertex AI credentials.

Endpoints:
  GET  /health         — health check
  POST /execute        — execute a single task
  POST /batch          — execute multiple tasks
  GET  /providers      — list available providers/models
"""
from __future__ import annotations

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import Orchestrator, TaskType


class OrchestratorHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the vertex_orchestrator backend."""

    def _send_json(self, code: int, data: dict) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"status": "ok"})

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/health":
            self._send_json(200, {
                "status": "healthy",
                "providers": ["crewai", "autogen", "aider"],
                "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "not-set"),
            })
        elif path == "/providers":
            self._send_json(200, {
                "providers": [
                    {"name": "crewai", "task_type": "ANALYSIS", "models": ["gemini-2.5-pro", "gemini-2.5-flash"]},
                    {"name": "autogen", "task_type": "CONVERSATION", "models": ["gemini-2.5-pro"]},
                    {"name": "aider", "task_type": "EDIT", "models": ["vertex_ai/gemini-2.5-pro"]},
                ]
            })
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        body = self._read_body()

        # Build config from environment
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", body.get("project_id", ""))
        location = os.environ.get("VERTEXAI_LOCATION", body.get("location", "us-central1"))
        model = body.get("model", "gemini-2.5-pro")

        if not project_id:
            self._send_json(400, {
                "success": False,
                "error": "GOOGLE_CLOUD_PROJECT not set. Run: gcloud auth application-default login"
            })
            return

        config = VertexAIConfig(
            project_id=project_id,
            location=location,
            model=model,
            temperature=body.get("temperature", 0.2),
        )
        orch = Orchestrator(config=config)

        if path == "/execute":
            task_type_str = body.get("task_type", "ANALYSIS").upper()
            try:
                task_type = TaskType[task_type_str]
            except KeyError:
                self._send_json(400, {"success": False, "error": f"Unknown task_type: {task_type_str}"})
                return

            task = body.get("task", "")
            if not task:
                self._send_json(400, {"success": False, "error": "task is required"})
                return

            kwargs = {}
            if "system_message" in body:
                kwargs["system_message"] = body["system_message"]
            if "file_path" in body:
                kwargs["file_path"] = body["file_path"]

            result = orch.execute(task_type=task_type, task=task, **kwargs)

            self._send_json(200, {
                "success": result.success,
                "output": result.output,
                "error": result.error,
                "runner_used": result.runner_used,
            })

        elif path == "/batch":
            tasks = body.get("tasks", [])
            if not tasks:
                self._send_json(400, {"success": False, "error": "tasks list is required"})
                return

            results = orch.execute_batch(tasks=tasks)
            self._send_json(200, {
                "success": True,
                "results": [
                    {
                        "success": r.success,
                        "output": r.output,
                        "error": r.error,
                        "runner_used": r.runner_used,
                    }
                    for r in results
                ],
            })

        else:
            self._send_json(404, {"error": "not found"})


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """Start the orchestrator REST API server."""
    server = HTTPServer((host, port), OrchestratorHandler)
    print(f"Vertex Orchestrator backend running on http://{host}:{port}")
    print(f"  Project: {os.environ.get('GOOGLE_CLOUD_PROJECT', 'NOT SET')}")
    print(f"  Endpoints: /health, /execute, /batch, /providers")
    print(f"  Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port=port)