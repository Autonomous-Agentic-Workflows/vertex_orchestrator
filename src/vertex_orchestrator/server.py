"""REST API server for the vertex_orchestrator backend.

Exposes a simple HTTP API that the DevGate Android app connects to
via the HermesBridgeClient. This allows the mobile app to route tasks
to CrewAI, AutoGen, and Aider running on the host machine with
Google Cloud Vertex AI credentials.

When Vertex AI is unavailable or rate-limited, the server falls back
to local Ollama models automatically (see ``/fallback/status``).

Endpoints:
  GET  /health          — health check (includes fallback status)
  GET  /fallback/status — Ollama fallback configuration & model availability
  POST /execute         — execute a single task
  POST /batch           — execute multiple tasks
  GET  /providers       — list available providers/models
  GET  /webhooks        — list registered webhook callbacks
  POST /webhooks/register   — register a callback URL for event notifications
  POST /webhooks/unregister — remove a registered callback URL
  GET  /recovery/*      — recovery integration endpoints
  GET  /a2a/agents      — list all registered A2A agents
  GET  /a2a/messages    — recent A2A message log
  POST /a2a/route       — route a message by keyword(s)
  POST /a2a/send        — send a message to a specific agent
  POST /a2a/broadcast   — broadcast to all matching agents
  POST /a2a/register    — register a new A2A agent
  POST /a2a/unregister  — unregister an A2A agent
  GET  /a2a/tree        — hierarchical agent tree
  POST /a2a/delegate    — parent delegates task to child
  POST /a2a/report      — child reports to parent
  POST /a2a/escalate    — escalate to grandparent (skip level)
  POST /a2a/broadcast-down — broadcast to all descendants
  POST /a2a/broadcast-up   — broadcast to all ancestors
  GET  /agents-cli/version — get agents-cli version
  POST /agents-cli/create  — scaffold a new agent project
  POST /agents-cli/deploy  — deploy an agent
  POST /agents-cli/eval    — run evaluation
  POST /agents-cli/run     — run agent with a prompt
  POST /agents-cli/publish — publish an agent
  GET  /agents-cli/playground — playground status
  POST /agents-cli/playground/start — start playground
  POST /agents-cli/playground/stop  — stop playground
  GET  /culina/status   — culina-ai service status
  POST /culina/start    — start culina-ai service
  POST /culina/stop     — stop culina-ai service
  POST /culina/proxy/*  — proxy to culina-ai API
"""
from __future__ import annotations

import json
import os
import sys
import time
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Ensure parent directory is in sys.path for standalone script execution
_src_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from vertex_orchestrator.config import OllamaConfig, VertexAIConfig
from vertex_orchestrator.orchestrator import Orchestrator, TaskType
from vertex_orchestrator.event_log import (
    log_request, log_recovery, log_overseer, log_security,
)


# In-process webhook registry (thread-safe). Persisted to disk in future.
_webhooks: dict[str, dict] = {}
_webhooks_lock = threading.Lock()


def _fire_webhooks(event_type: str, payload: dict) -> None:
    """Fire all registered webhook callbacks for the given event type.

    Calls each matching webhook synchronously (called after response is sent).
    """
    with _webhooks_lock:
        matching = [
            (url, cfg) for url, cfg in _webhooks.items()
            if "*" in cfg.get("events", ["*"]) or event_type in cfg.get("events", ["*"])
        ]
    for url, cfg in matching:
        _post_webhook(url, cfg, event_type, payload)


def _post_webhook(url: str, cfg: dict, event_type: str, payload: dict) -> None:
    """POST event notification to a single webhook URL."""
    body = json.dumps({"event": event_type, "payload": payload}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    secret = cfg.get("secret")
    if secret:
        headers["X-Webhook-Secret"] = secret
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except Exception as e:
        log_security("webhook_failure", f"url={url} event={event_type} error={e}")


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

    def _check_auth(self) -> bool:
        """Check API key auth. Returns True if authorized or no key configured."""
        api_key = os.environ.get("ORCHESTRATOR_API_KEY", "")
        if not api_key:
            return True  # No key set = open (local dev only)
        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {api_key}":
            log_security("auth_failure", f"path={self.path} ip={self.client_address[0]}")
            return False
        return True

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
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        if path in ("/", "/dashboard"):
            static_html = os.path.join(os.path.dirname(__file__), "static", "index.html")
            if os.path.exists(static_html):
                with open(static_html, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return
            self._send_json(200, {"status": "Vertex Orchestrator running", "endpoints": ["/health", "/fallback/status", "/a2a/agents"]})
            return

        elif path == "/health":
            fallback_enabled = os.environ.get(
                "ORCHESTRATOR_FALLBACK", "true"
            ).lower() in ("true", "1", "yes")
            ollama_reachable = False
            ollama_models: list[str] = []
            if fallback_enabled:
                from vertex_orchestrator.ollama_runner import check_ollama_available
                ollama_cfg = OllamaConfig()
                ollama_reachable, ollama_models = check_ollama_available(ollama_cfg)
            self._send_json(200, {
                "status": "healthy",
                "providers": ["crewai", "autogen", "aider"],
                "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "not-set"),
                "fallback_enabled": fallback_enabled,
                "fallback_ollama_reachable": ollama_reachable,
                "fallback_ollama_models": ollama_models,
            })
        elif path == "/fallback/status":
            # Report whether fallback is enabled and which Ollama models are available.
            fallback_enabled = os.environ.get(
                "ORCHESTRATOR_FALLBACK", "true"
            ).lower() in ("true", "1", "yes")
            ollama_cfg = OllamaConfig()
            from vertex_orchestrator.ollama_runner import check_ollama_available
            reachable, available_models = check_ollama_available(ollama_cfg)

            # Determine which mapped models are actually present on the Ollama host.
            mapped_models = ollama_cfg.model_mapping
            model_status = {}
            for task_type_value, model_name in mapped_models.items():
                model_status[task_type_value] = {
                    "model": model_name,
                    "available": model_name in available_models,
                }

            self._send_json(200, {
                "fallback_enabled": fallback_enabled,
                "ollama_endpoint": ollama_cfg.endpoint,
                "ollama_api_base": ollama_cfg.api_base,
                "ollama_reachable": reachable,
                "model_mapping": mapped_models,
                "model_status": model_status,
                "available_models": available_models,
            })
        elif path == "/providers":
            self._send_json(200, {
                "providers": [
                    {
                        "name": "vertex_ai",
                        "models": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
                        "project": os.environ.get("GOOGLE_CLOUD_PROJECT", "master-recovery-hub-2026"),
                    },
                    {
                        "name": "openrouter",
                        "models": [
                            "google/gemma-4-31b-it:free",
                            "anthropic/claude-sonnet-4.5",
                            "deepseek/deepseek-r1",
                            "deepseek/deepseek-chat",
                            "meta-llama/llama-3.3-70b-instruct",
                            "google/gemini-2.5-flash",
                        ],
                        "active": bool(os.environ.get("OPENROUTER_API_KEY")),
                    },
                    {"name": "crewai", "task_type": "ANALYSIS", "models": ["gemini-2.5-pro", "gemini-2.5-flash"]},
                    {"name": "autogen", "task_type": "CONVERSATION", "models": ["gemini-2.5-pro"]},
                    {"name": "aider", "task_type": "EDIT", "models": ["vertex_ai/gemini-2.5-pro"]},
                ]
            })
        elif path == "/overseer/status":
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            self._send_json(200, {
                "running": overseer.is_running(),
                "port": overseer.port,
                "health": overseer.check_health() if overseer.is_running() else None,
            })
        elif path == "/overseer/mcp/info":
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            if not overseer.is_running():
                self._send_json(503, {"success": False, "error": "overseer not running — POST /overseer/start first"})
                return
            self._send_json(200, overseer.get_mcp_info())
        elif path == "/webhooks":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            with _webhooks_lock:
                hooks = [
                    {"url": url, "events": cfg.get("events", ["*"])}
                    for url, cfg in _webhooks.items()
                ]
            self._send_json(200, {"success": True, "webhooks": hooks})
        elif path == "/recovery/targets":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.recovery import RecoveryIntegration
            include_sensitive = query_params.get("include_sensitive", "false").lower() == "true"
            ri = RecoveryIntegration(config=VertexAIConfig(project_id="recovery", location="us-central1"), recovery_repo_path=".")
            result = ri.load_targets(include_sensitive=include_sensitive)
            status = 200 if result.get("success") else 404
            self._send_json(status, result)
        elif path == "/a2a/agents":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            self._send_json(200, {"agents": router.list_agents()})
        elif path == "/a2a/messages":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            limit = int(query_params.get("limit", "50"))
            self._send_json(200, {"messages": router.get_message_log(limit=limit)})
        elif path == "/a2a/tree":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            self._send_json(200, router.get_tree())
        elif path == "/culina/status":
            from vertex_orchestrator.culina_manager import get_culina
            culina = get_culina()
            self._send_json(200, {
                "running": culina.is_running(),
                "port": culina.port,
                "health": culina.check_health() if culina.is_running() else None,
            })
        elif path == "/agents-cli/version":
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            self._send_json(200, cli.version())
        elif path == "/agents-cli/playground":
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            self._send_json(200, cli.playground_status())
        elif path == "/ai/live/config":
            self._send_json(200, {
                "success": True,
                "protocol": "wss",
                "default_model": "models/gemini-2.0-flash-exp",
                "supported_models": [
                    "models/gemini-2.0-flash-exp",
                    "models/gemini-robotics-er-2-streaming-preview",
                    "gemini-2.5-flash",
                ],
                "voices": ["Puck", "Charon", "Kore", "Fenrir", "Aoede"],
                "modalities": ["TEXT", "AUDIO"],
                "sample_rates": {
                    "send_pcm": 16000,
                    "receive_pcm": 24000
                },
                "api_key_configured": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
            })
        elif path == "/devgate/status":
            self._send_json(200, {
                "success": True,
                "client": "HermesBridgeClient",
                "server_version": "1.4.0",
                "active_project": os.environ.get("GOOGLE_CLOUD_PROJECT", "master-recovery-hub-2026"),
                "port": 8000,
                "supported_runners": ["crewai", "autogen", "aider", "cline", "openrouter", "ollama", "vertex_ai"],
                "a2a_bus_active": True,
                "endpoints": {
                    "health": "/health",
                    "execute": "/execute",
                    "ai_generate": "/ai/generate",
                    "a2a_route": "/a2a/route",
                    "loops_status": "/loops/status"
                }
            })
        elif path == "/loops/status":
            loops_info = {
                "loop_1": {"name": "Recovery Scanning", "interval": "15m", "status": "active"},
                "loop_2": {"name": "Code Review", "interval": "30m", "status": "active"},
                "loop_3": {"name": "Filesystem Monitoring", "interval": "1h", "status": "active"},
                "loop_4": {"name": "Deployment Pipeline", "interval": "2h", "status": "active"},
                "loop_5": {"name": "Research & Knowledge Base", "interval": "4h", "status": "active"}
            }
            self._send_json(200, {"success": True, "loops": loops_info})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_body()

        # A2A routes don't need VertexAI config
        if path == "/a2a/route":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.a2a_router import get_router, A2AMessage
            router = get_router()
            sender = body.get("sender", "external")
            keywords = body.get("keywords", [])
            content = body.get("content", "")
            if not content or not keywords:
                self._send_json(400, {"success": False, "error": "content and keywords are required"})
                return
            msg = A2AMessage(sender=sender, recipient="*", content=content, msg_type="broadcast", keywords=keywords)
            result = router.route_message(msg)
            self._send_json(200, {"success": True, **result})
            _fire_webhooks("a2a.route", result)
            return

        if path == "/a2a/send":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.a2a_router import get_router, A2AMessage
            router = get_router()
            sender = body.get("sender", "external")
            recipient = body.get("recipient", "")
            content = body.get("content", "")
            if not content or not recipient:
                self._send_json(400, {"success": False, "error": "content and recipient are required"})
                return
            msg = A2AMessage(sender=sender, recipient=recipient, content=content,
                             msg_type="request", keywords=body.get("keywords", []))
            result = router.route_message(msg)
            self._send_json(200, {"success": True, **result})
            _fire_webhooks("a2a.send", result)
            return

        if path == "/a2a/broadcast":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.a2a_router import get_router, A2AMessage
            router = get_router()
            sender = body.get("sender", "external")
            content = body.get("content", "")
            if not content:
                self._send_json(400, {"success": False, "error": "content is required"})
                return
            msg = A2AMessage(sender=sender, recipient="*", content=content,
                             msg_type="broadcast", keywords=body.get("keywords", []))
            result = router.route_message(msg)
            self._send_json(200, {"success": True, **result})
            _fire_webhooks("a2a.broadcast", result)
            return

        if path == "/a2a/register":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.a2a_router import get_router, Agent
            router = get_router()
            agent_id = body.get("id", "")
            if not agent_id:
                self._send_json(400, {"success": False, "error": "id is required"})
                return
            agent = Agent(
                id=agent_id,
                name=body.get("name", agent_id),
                agent_type=body.get("agent_type", "external"),
                keywords=body.get("keywords", []),
                endpoint=body.get("endpoint"),
                capabilities=body.get("capabilities", []),
                metadata=body.get("metadata", {}),
            )
            result = router.register_agent(agent)
            self._send_json(200, {"success": True, **result})
            return

        if path == "/a2a/unregister":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            agent_id = body.get("id", "")
            result = router.unregister_agent(agent_id)
            status = 200 if result["status"] == "unregistered" else 404
            self._send_json(status, {"success": result["status"] == "unregistered", **result})
            return

        if path == "/a2a/delegate":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            sender_id = body.get("sender", "")
            child_id = body.get("recipient", "")
            content = body.get("content", "")
            keywords = body.get("keywords", [])
            if not sender_id or not child_id or not content:
                self._send_json(400, {"success": False, "error": "sender, recipient, and content are required"})
                return
            result = router.delegate(sender_id, child_id, content, keywords)
            self._send_json(200, result)
            _fire_webhooks("a2a.delegate", result)
            return

        if path == "/a2a/report":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            sender_id = body.get("sender", "")
            content = body.get("content", "")
            keywords = body.get("keywords", [])
            if not sender_id or not content:
                self._send_json(400, {"success": False, "error": "sender and content are required"})
                return
            result = router.report(sender_id, content, keywords)
            self._send_json(200, result)
            _fire_webhooks("a2a.report", result)
            return

        if path == "/a2a/escalate":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            sender_id = body.get("sender", "")
            content = body.get("content", "")
            keywords = body.get("keywords", [])
            if not sender_id or not content:
                self._send_json(400, {"success": False, "error": "sender and content are required"})
                return
            result = router.escalate(sender_id, content, keywords)
            self._send_json(200, result)
            _fire_webhooks("a2a.escalate", result)
            return

        if path == "/a2a/broadcast-down":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            sender_id = body.get("sender", "")
            content = body.get("content", "")
            keywords = body.get("keywords", [])
            if not sender_id or not content:
                self._send_json(400, {"success": False, "error": "sender and content are required"})
                return
            result = router.broadcast_down(sender_id, content, keywords)
            self._send_json(200, result)
            _fire_webhooks("a2a.broadcast_down", result)
            return

        if path == "/a2a/broadcast-up":
            from vertex_orchestrator.a2a_router import get_router
            router = get_router()
            sender_id = body.get("sender", "")
            content = body.get("content", "")
            keywords = body.get("keywords", [])
            if not sender_id or not content:
                self._send_json(400, {"success": False, "error": "sender and content are required"})
                return
            result = router.broadcast_up(sender_id, content, keywords)
            self._send_json(200, result)
            _fire_webhooks("a2a.broadcast_up", result)
            return

        # Culina service routes don't need VertexAI config
        if path == "/culina/start":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.culina_manager import get_culina
            culina = get_culina()
            result = culina.start()
            self._send_json(200, result)
            return

        if path == "/culina/stop":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.culina_manager import get_culina
            culina = get_culina()
            result = culina.stop()
            self._send_json(200, result)
            return

        if path.startswith("/culina/proxy/"):
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.culina_manager import get_culina
            culina = get_culina()
            if not culina.is_running():
                self._send_json(503, {"success": False, "error": "culina not running — POST /culina/start first"})
                return
            culina_path = "/" + path[len("/culina/proxy/"):]
            result = culina.proxy_request("POST", culina_path, body)
            self._send_json(200, result)
            return

        # Agents CLI routes don't need VertexAI config
        if path == "/agents-cli/version":
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            result = cli.version()
            self._send_json(200, result)
            return

        if path == "/agents-cli/create":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            project_name = body.get("project_name", "")
            output_dir = body.get("output_dir", ".")
            agent_template = body.get("agent_template")
            deployment_target = body.get("deployment_target")
            if not project_name:
                self._send_json(400, {"success": False, "error": "project_name is required"})
                return
            result = cli.create(project_name, output_dir, agent_template, deployment_target)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.create", result)
            return

        if path == "/agents-cli/deploy":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            project_dir = body.get("project_dir")
            deployment_target = body.get("deployment_target")
            list_deployments = body.get("list", False)
            no_wait = body.get("no_wait", False)
            result = cli.deploy(project_dir, deployment_target, list_deployments, no_wait)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.deploy", result)
            return

        if path == "/agents-cli/eval":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            project_dir = body.get("project_dir")
            sub_command = body.get("sub_command", "run")
            if sub_command == "generate":
                result = cli.eval_generate(project_dir)
            elif sub_command == "grade":
                result = cli.eval_grade(project_dir)
            elif sub_command == "compare":
                file_a = body.get("file_a", "")
                file_b = body.get("file_b", "")
                if not file_a or not file_b:
                    self._send_json(400, {"success": False, "error": "file_a and file_b required for compare"})
                    return
                result = cli.eval_compare(file_a, file_b)
            else:
                result = cli.eval_run(project_dir)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.eval", result)
            return

        if path == "/agents-cli/run":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            prompt = body.get("prompt", "")
            project_dir = body.get("project_dir")
            if not prompt:
                self._send_json(400, {"success": False, "error": "prompt is required"})
                return
            result = cli.run_agent(prompt, project_dir)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.run", result)
            return

        if path == "/agents-cli/publish":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            target = body.get("target", "agent_runtime")
            project_dir = body.get("project_dir")
            result = cli.publish(target, project_dir)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.publish", result)
            return

        if path == "/agents-cli/playground":
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            result = cli.playground_status()
            self._send_json(200, result)
            return

        if path == "/agents-cli/playground/start":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            port = body.get("port", 8080)
            project_dir = body.get("project_dir")
            result = cli.start_playground(port, project_dir)
            self._send_json(200, result)
            _fire_webhooks("agents_cli.playground_start", result)
            return

        if path == "/agents-cli/playground/stop":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.agents_cli_manager import get_agents_cli
            cli = get_agents_cli()
            result = cli.stop_playground()
            self._send_json(200, result)
            _fire_webhooks("agents_cli.playground_stop", result)
            return

        # Webhook routes don't need VertexAI config
        if path == "/webhooks/register":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            url = body.get("url", "")
            if not url or not url.startswith("http"):
                self._send_json(400, {"success": False, "error": "valid url is required"})
                return
            events = body.get("events", ["*"])
            secret = body.get("secret", "")
            with _webhooks_lock:
                _webhooks[url] = {"events": events, "secret": secret}
            self._send_json(200, {"success": True, "url": url, "events": events})
            return

        if path == "/webhooks/unregister":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            url = body.get("url", "")
            with _webhooks_lock:
                existed = url in _webhooks
                _webhooks.pop(url, None)
            if existed:
                self._send_json(200, {"success": True, "url": url})
            else:
                self._send_json(404, {"success": False, "url": url, "error": "webhook not found"})
            return

        if path in ("/ai/generate", "/api/v1/ai/generate"):
            prompt = body.get("prompt", "")
            system_instruction = body.get("system_instruction", "You are an expert AI assistant for ContractorOS and Vertex Orchestrator.")
            provider = body.get("provider", "openrouter" if os.environ.get("OPENROUTER_API_KEY") else "vertex_ai")
            model = body.get("model", "google/gemma-4-31b-it:free" if provider == "openrouter" else "gemini-2.5-flash")

            if not prompt:
                self._send_json(400, {"success": False, "error": "prompt is required"})
                return

            if provider == "openrouter":
                api_key = os.environ.get("OPENROUTER_API_KEY", "")
                if not api_key:
                    for env_path in ["/home/conor-ops/.env", os.path.expanduser("~/.env"), ".env"]:
                        if os.path.exists(env_path):
                            with open(env_path, "r") as ef:
                                for line in ef:
                                    if line.startswith("OPENROUTER_API_KEY="):
                                        api_key = line.strip().split("=", 1)[1].strip('"\'')
                                        break
                        if api_key:
                            break
                if not api_key:
                    self._send_json(400, {"success": False, "error": "OPENROUTER_API_KEY is not set"})
                    return

                req_payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": body.get("temperature", 0.2),
                }
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://208fenceandgate.com",
                    "X-Title": "ContractorOS-VertexOrchestrator",
                    "Content-Type": "application/json",
                }
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    data=json.dumps(req_payload).encode("utf-8"),
                    headers=headers,
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        res_data = json.loads(resp.read().decode("utf-8"))
                        content = ""
                        choices = res_data.get("choices", [])
                        if choices:
                            content = choices[0].get("message", {}).get("content", "")
                        self._send_json(200, {
                            "success": True,
                            "provider": "openrouter",
                            "model": model,
                            "content": content,
                            "raw": res_data,
                            "usage": res_data.get("usage", {}),
                        })
                        return
                except urllib.error.HTTPError as e:
                    err_msg = e.read().decode("utf-8") if e.fp else str(e)
                    self._send_json(e.code, {"success": False, "error": f"OpenRouter error ({e.code}): {err_msg}"})
                    return
                except Exception as e:
                    self._send_json(500, {"success": False, "error": f"OpenRouter connection error: {str(e)}"})
                    return

            elif provider in ("ollama", "local"):
                try:
                    ollama_model = model if model not in ("google/gemma-4-31b-it:free", "gemini-2.5-flash") else "gemma4:26b"
                    ollama_payload = {
                        "model": ollama_model,
                        "messages": [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": prompt},
                        ],
                        "stream": False,
                    }
                    req = urllib.request.Request(
                        "http://127.0.0.1:11434/api/chat",
                        data=json.dumps(ollama_payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        res_data = json.loads(resp.read().decode("utf-8"))
                        content = res_data.get("message", {}).get("content", "")
                        self._send_json(200, {
                            "success": True,
                            "provider": "ollama",
                            "model": ollama_model,
                            "content": content,
                        })
                        return
                except Exception as e:
                    self._send_json(500, {"success": False, "error": f"Ollama error: {str(e)}"})
                    return

            elif provider in ("vertex_ai", "google", "gemini"):
                try:
                    from google import genai
                    from google.genai import types

                    gemini_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "master-recovery-hub-2026")
                    location = os.environ.get("VERTEXAI_LOCATION", "us-central1")

                    if gemini_api_key:
                        client = genai.Client(api_key=gemini_api_key)
                    else:
                        client = genai.Client(vertexai=True, project=project_id, location=location)

                    v_model = model if model.startswith("gemini") or "/" in model else "gemini-2.5-flash"
                    config = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=float(body.get("temperature", 0.2)),
                    )
                    resp = client.models.generate_content(
                        model=v_model,
                        contents=prompt,
                        config=config,
                    )
                    content = resp.text if hasattr(resp, "text") else str(resp)
                    self._send_json(200, {
                        "success": True,
                        "provider": "vertex_ai",
                        "model": v_model,
                        "content": content,
                    })
                    return
                except Exception as e:
                    self._send_json(500, {"success": False, "error": f"Vertex AI generation error: {str(e)}"})
                    return
            else:
                self._send_json(400, {"success": False, "error": f"Unknown provider: {provider}"})
                return

        if path == "/devgate/verify":
            client_id = body.get("client_id", "HermesBridgeClient-Android")
            device_info = body.get("device_info", {})
            self._send_json(200, {
                "success": True,
                "verified": True,
                "client_id": client_id,
                "session_token": f"devgate-{os.urandom(8).hex()}",
                "server_version": "1.4.0",
                "active_project": os.environ.get("GOOGLE_CLOUD_PROJECT", "master-recovery-hub-2026"),
            })
            return

        if path == "/loops/trigger":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            loop_id = body.get("loop_id", "loop_1")
            dry_run = body.get("dry_run", True)
            self._send_json(200, {
                "success": True,
                "loop_id": loop_id,
                "triggered": True,
                "mode": "dry_run" if dry_run else "live",
                "timestamp": time.time(),
            })
            _fire_webhooks("loop.triggered", {"loop_id": loop_id, "dry_run": dry_run})
            return


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
            fallback_enabled=body.get(
                "fallback_enabled",
                os.environ.get("ORCHESTRATOR_FALLBACK", "true").lower()
                in ("true", "1", "yes"),
            ),
        )
        orch = Orchestrator(config=config)

        if path == "/execute":
            # Auth check
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return

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
                # Security: restrict file_path to ConsolidatedDevelopment only
                file_path = body["file_path"]
                allowed_base = os.environ.get("ORCHESTRATOR_ALLOWED_BASE", "")
                if not allowed_base:
                    # Default to ConsolidatedDevelopment
                    home = os.environ.get("USERPROFILE", os.environ.get("HOME", ""))
                    allowed_base = os.path.join(home, "OneDrive", "ConsolidatedDevelopment")
                # Normalize both paths for comparison
                norm_file = os.path.normpath(os.path.abspath(file_path))
                norm_base = os.path.normpath(os.path.abspath(allowed_base))
                if not norm_file.startswith(norm_base):
                    self._send_json(403, {
                        "success": False,
                        "error": f"file_path must be within {norm_base}"
                    })
                    return
                kwargs["file_path"] = file_path

            result = orch.execute(task_type=task_type, task=task, **kwargs)
            response = {
                "success": result.success,
                "output": result.output,
                "error": result.error,
                "runner_used": result.runner_used,
            }
            self._send_json(200, response)
            _fire_webhooks("task.complete", response)

        elif path == "/batch":
            # Auth check
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return

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

        elif path == "/recovery/status":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.recovery import RecoveryIntegration
            home = os.environ.get("USERPROFILE", os.environ.get("HOME", ""))
            # Try MasterRecovery3 first, then MasterRecovery2 in FoundRepos
            mr3 = os.path.join(home, "OneDrive", "ConsolidatedDevelopment", "MasterRecovery3")
            mr2 = os.path.join(home, "Documents", "JayLang085MR4", "OneDrive", "ConsolidatedDevelopment", "FoundRepos", "MasterRecovery2")
            recovery_repo = mr3 if os.path.exists(mr3) else mr2
            ri = RecoveryIntegration(config=config, recovery_repo_path=recovery_repo)
            report = ri.full_status_report()
            self._send_json(200, {"success": True, "report": report})

        elif path == "/recovery/analyze-seeds":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.recovery import RecoveryIntegration
            home = os.environ.get("USERPROFILE", os.environ.get("HOME", ""))
            # Try MasterRecovery3 first, then MasterRecovery2 in FoundRepos
            mr3 = os.path.join(home, "OneDrive", "ConsolidatedDevelopment", "MasterRecovery3")
            mr2 = os.path.join(home, "Documents", "JayLang085MR4", "OneDrive", "ConsolidatedDevelopment", "FoundRepos", "MasterRecovery2")
            recovery_repo = mr3 if os.path.exists(mr3) else mr2
            ri = RecoveryIntegration(config=config, recovery_repo_path=recovery_repo)
            seed_info = body.get("seed_info", {})
            result = ri.analyze_seed_paths(seed_info)
            self._send_json(200, result)

        elif path == "/recovery/passphrases":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.recovery import RecoveryIntegration
            ri = RecoveryIntegration(config=config, recovery_repo_path=".")
            base_passphrases = body.get("passphrases", [])
            result = ri.generate_passphrase_variants(base_passphrases)
            self._send_json(200, result)

        elif path == "/overseer/start":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            result = overseer.start()
            self._send_json(200, result)

        elif path == "/overseer/stop":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            result = overseer.stop()
            self._send_json(200, result)

        elif path == "/overseer/mcp":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            if not overseer.is_running():
                self._send_json(503, {"success": False, "error": "overseer not running — POST /overseer/start first"})
                return
            result = overseer.proxy_mcp(body)
            self._send_json(200, result)

        elif path.startswith("/overseer/proxy/"):
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.overseer_manager import get_overseer
            overseer = get_overseer()
            if not overseer.is_running():
                self._send_json(503, {"success": False, "error": "overseer not running — POST /overseer/start first"})
                return
            # Strip /overseer/proxy prefix and forward to recovery-overseer
            overseer_path = "/" + path[len("/overseer/proxy/"):]
            result = overseer.proxy_request("POST", overseer_path, body)
            self._send_json(200, result)

        elif path == "/recovery/analyze-log":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.recovery import RecoveryIntegration
            ri = RecoveryIntegration(config=config, recovery_repo_path=".")
            log_path = body.get("log_path", "")
            result = ri.analyze_scanner_log(log_path)
            self._send_json(200, result)

        elif path == "/cline/execute":
            if not self._check_auth():
                self._send_json(401, {"success": False, "error": "Unauthorized"})
                return
            from vertex_orchestrator.cline_runner import ClineConfig, ClineRunner
            task = body.get("task", "")
            if not task:
                self._send_json(400, {"success": False, "error": "task is required"})
                return
            cline_config = ClineConfig(
                model=body.get("model", "gemma4:26b"),
                provider=body.get("provider", "ollama"),
                timeout=body.get("timeout", 120),
                working_dir=body.get("working_dir", ""),
            )
            runner = ClineRunner(config=cline_config, task=task)
            result = runner.run()
            self._send_json(200, {
                "success": result.success,
                "output": result.output,
                "error": result.error,
                "exit_code": result.exit_code,
            })

        else:
            self._send_json(404, {"error": "not found"})


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """Start the orchestrator REST API server."""
    server = HTTPServer((host, port), OrchestratorHandler)
    fallback_enabled = os.environ.get("ORCHESTRATOR_FALLBACK", "true").lower() in ("true", "1", "yes")
    print(f"Vertex Orchestrator backend running on http://{host}:{port}")
    print(f"  Project: {os.environ.get('GOOGLE_CLOUD_PROJECT', 'NOT SET')}")
    print(f"  Auth: {'ENABLED (ORCHESTRATOR_API_KEY set)' if os.environ.get('ORCHESTRATOR_API_KEY') else 'OPEN (no key set — local dev only)'}")
    print(f"  Fallback: {'ENABLED' if fallback_enabled else 'DISABLED'} (Ollama at 127.0.0.1:11434)")
    print(f"  File access: restricted to {os.environ.get('ORCHESTRATOR_ALLOWED_BASE', '<ConsolidatedDevelopment>')}")
    print(f"  Endpoints: /health, /fallback/status, /execute, /batch, /providers, /recovery/*, /overseer/*, /culina/*, /cline/execute, /webhooks/*, /a2a/*")
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