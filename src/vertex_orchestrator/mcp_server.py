"""MCP server — exposes vertex_orchestrator endpoints via JSON-RPC 2.0 over stdio.

This module lets MCP-compatible clients (Claude, Cline, Hermes) call
the orchestrator's recovery analysis, task execution, and overseer
management tools through the standard Model Context Protocol.

Run standalone:
    python -m vertex_orchestrator.mcp_server

Or configure in an MCP client's config:
    {
      "mcpServers": {
        "vertex-orchestrator": {
          "command": "python",
          "args": ["-m", "vertex_orchestrator.mcp_server"]
        }
      }
    }
"""
from __future__ import annotations

import json
import os
import sys
import subprocess
import urllib.request
import urllib.error
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ORCHESTRATOR_HOST = os.environ.get("ORCHESTRATOR_HOST", "127.0.0.1")
ORCHESTRATOR_PORT = int(os.environ.get("ORCHESTRATOR_PORT", "8000"))
ORCHESTRATOR_API_KEY = os.environ.get("ORCHESTRATOR_API_KEY", "")
BASE_URL = f"http://{ORCHESTRATOR_HOST}:{ORCHESTRATOR_PORT}"


# ---------------------------------------------------------------------------
# Tool definitions (MCP "tools" capability)
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    {
        "name": "execute_task",
        "description": "Execute a single task via the orchestrator. Routes to CrewAI (ANALYSIS), AutoGen (CONVERSATION), or Aider (EDIT) with automatic Ollama fallback.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_type": {"type": "string", "enum": ["ANALYSIS", "CONVERSATION", "EDIT"], "description": "Type of task"},
                "task": {"type": "string", "description": "The task description or instructions"},
                "model": {"type": "string", "description": "Vertex AI model (default: gemini-2.5-pro)"},
                "system_message": {"type": "string", "description": "System message for CONVERSATION tasks"},
                "file_path": {"type": "string", "description": "File path for EDIT tasks (restricted to ConsolidatedDevelopment)"},
            },
            "required": ["task_type", "task"],
        },
    },
    {
        "name": "batch_execute",
        "description": "Execute multiple tasks in sequence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tasks": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["tasks"],
        },
    },
    {
        "name": "recovery_status",
        "description": "Get full recovery operation status: config validation, scanner log analysis, seed path coverage.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "recovery_targets",
        "description": "List all crypto recovery targets from ALL_TARGETS.txt. Returns 45 addresses (BTC, LTC, DOGE, PPC, SOL) with coin detection. Seeds/WIFs/YPRV redacted by default.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "include_sensitive": {"type": "boolean", "description": "Include seeds/WIFs/YPRV (default: false, use only in trusted contexts)"},
            },
        },
    },
    {
        "name": "recovery_analyze_seeds",
        "description": "AI analysis of seed derivation paths — suggests missed BIP paths, change address chains, and Electrum legacy routes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "seed_info": {"type": "object", "description": "Seed metadata (sanitized — no raw seeds)"},
            },
            "required": ["seed_info"],
        },
    },
    {
        "name": "recovery_passphrases",
        "description": "Generate passphrase variations for brute-force recovery.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "passphrases": {"type": "array", "items": {"type": "string"}, "description": "Base passphrases to generate variants from"},
            },
            "required": ["passphrases"],
        },
    },
    {
        "name": "recovery_analyze_log",
        "description": "Parse scanner logs for patterns, hits, errors, and missed addresses.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "log_path": {"type": "string", "description": "Path to scanner log file"},
            },
            "required": ["log_path"],
        },
    },
    {
        "name": "overseer_status",
        "description": "Check if recovery-overseer Node.js service is running and healthy.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "overseer_start",
        "description": "Start the recovery-overseer Node.js sub-service (Express + MCP + Google Workspace tools).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "overseer_stop",
        "description": "Stop the recovery-overseer sub-service.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "fallback_status",
        "description": "Check Ollama fallback configuration and model availability.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "health",
        "description": "Orchestrator health check — lists providers, project ID, and fallback status.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "webhook_register",
        "description": "Register a webhook callback URL to receive event notifications (e.g. task.complete).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Callback URL (must start with http)"},
                "events": {"type": "array", "items": {"type": "string"}, "description": "Event types to subscribe to (default: [\"*\"] for all)"},
                "secret": {"type": "string", "description": "Optional secret sent as X-Webhook-Secret header"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "webhook_unregister",
        "description": "Remove a registered webhook callback URL.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Callback URL to remove"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "webhook_list",
        "description": "List all registered webhook callbacks.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "a2a_list_agents",
        "description": "List all registered A2A agents in the routing harness (hub agents, fleet agents, managed services, external agents).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "a2a_route",
        "description": "Route a message to agents matching the given keywords. The router finds all agents whose keywords match and delivers the message.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sender": {"type": "string", "description": "ID of the sending agent"},
                "keywords": {"type": "array", "items": {"type": "string"}, "description": "Keywords to route by"},
                "content": {"type": "string", "description": "Message content to deliver"},
            },
            "required": ["keywords", "content"],
        },
    },
    {
        "name": "a2a_send",
        "description": "Send a message directly to a specific A2A agent by ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sender": {"type": "string", "description": "ID of the sending agent"},
                "recipient": {"type": "string", "description": "ID of the target agent"},
                "content": {"type": "string", "description": "Message content to deliver"},
            },
            "required": ["recipient", "content"],
        },
    },
    {
        "name": "a2a_messages",
        "description": "Get recent A2A message log.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max messages to return (default 50)"},
            },
        },
    },
    {
        "name": "a2a_tree",
        "description": "Get the hierarchical agent tree (Orchestrator → Managers → Workers).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "a2a_delegate",
        "description": "Delegate a task from a parent agent to a specific child agent.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sender": {"type": "string", "description": "ID of the parent agent"},
                "recipient": {"type": "string", "description": "ID of the child agent"},
                "content": {"type": "string", "description": "Task/message to delegate"},
                "keywords": {"type": "array", "items": {"type": "string"}, "description": "Optional keywords"},
            },
            "required": ["sender", "recipient", "content"],
        },
    },
    {
        "name": "a2a_report",
        "description": "Report results from a child agent up to its parent agent.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sender": {"type": "string", "description": "ID of the child agent"},
                "content": {"type": "string", "description": "Report content"},
                "keywords": {"type": "array", "items": {"type": "string"}, "description": "Optional keywords"},
            },
            "required": ["sender", "content"],
        },
    },
    {
        "name": "culina_status",
        "description": "Check if the Culina AI Studio Orchestrator service is running.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "culina_start",
        "description": "Start the Culina AI Studio Orchestrator service (Node.js on port 3001).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "culina_stop",
        "description": "Stop the Culina AI Studio Orchestrator service.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "agents_cli_version",
        "description": "Get the google-agents-cli version.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "agents_cli_create",
        "description": "Create a new agent project from templates using agents-cli.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_name": {"type": "string", "description": "Name for the new agent project"},
                "output_dir": {"type": "string", "description": "Output directory (default: current dir)"},
                "agent_template": {"type": "string", "description": "Template identifier (e.g. chat_agent)"},
                "deployment_target": {"type": "string", "enum": ["agent_runtime", "cloud_run", "gke", "none"]},
            },
            "required": ["project_name"],
        },
    },
    {
        "name": "agents_cli_deploy",
        "description": "Deploy an agent to Agent Runtime / Cloud Run / GKE using agents-cli.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_dir": {"type": "string", "description": "Project directory to deploy"},
                "deployment_target": {"type": "string", "enum": ["agent_runtime", "cloud_run", "gke"]},
                "list": {"type": "boolean", "description": "List existing deployments"},
            },
        },
    },
    {
        "name": "agents_cli_eval",
        "description": "Run evaluation on an agent project (generate + grade).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_dir": {"type": "string", "description": "Project directory to evaluate"},
                "sub_command": {"type": "string", "enum": ["run", "generate", "grade", "compare"],
                                "description": "Eval sub-command (default: run)"},
            },
        },
    },
    {
        "name": "agents_cli_run",
        "description": "Run an agent with a single prompt (non-interactive).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Prompt to send to the agent"},
                "project_dir": {"type": "string", "description": "Project directory"},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "agents_cli_playground",
        "description": "Check, start, or stop the agents-cli playground server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["status", "start", "stop"],
                           "description": "Action to perform (default: status)"},
                "port": {"type": "integer", "description": "Port for playground (default: 8080)"},
            },
        },
    },
]

RESOURCES: list[dict[str, Any]] = [
    {
        "uri": "orchestrator://health",
        "name": "Health",
        "description": "Orchestrator health and provider status",
        "mimeType": "application/json",
    },
    {
        "uri": "orchestrator://providers",
        "name": "Providers",
        "description": "Available agent frameworks and models",
        "mimeType": "application/json",
    },
    {
        "uri": "orchestrator://fallback",
        "name": "Fallback Status",
        "description": "Ollama fallback configuration",
        "mimeType": "application/json",
    },
]


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if ORCHESTRATOR_API_KEY:
        h["Authorization"] = f"Bearer {ORCHESTRATOR_API_KEY}"
    return h


def _get(path: str) -> dict[str, Any]:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET", headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}"}
    except urllib.error.URLError as e:
        return {"success": False, "error": f"Connection failed: {e.reason}. Is the orchestrator running on {BASE_URL}?"}


def _post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}"}
    except urllib.error.URLError as e:
        return {"success": False, "error": f"Connection failed: {e.reason}. Is the orchestrator running on {BASE_URL}?"}


# ---------------------------------------------------------------------------
# Tool dispatcher
# ---------------------------------------------------------------------------

def dispatch_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Execute a tool by name and return the result dict."""
    if name == "health":
        return _get("/health")
    elif name == "fallback_status":
        return _get("/fallback/status")
    elif name == "execute_task":
        return _post("/execute", args)
    elif name == "batch_execute":
        return _post("/batch", args)
    elif name == "recovery_status":
        return _post("/recovery/status", {**args, "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "")})
    elif name == "recovery_targets":
        qs = "?include_sensitive=true" if args.get("include_sensitive") else ""
        return _get(f"/recovery/targets{qs}")
    elif name == "recovery_analyze_seeds":
        return _post("/recovery/analyze-seeds", {**args, "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "")})
    elif name == "recovery_passphrases":
        return _post("/recovery/passphrases", {**args, "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "")})
    elif name == "recovery_analyze_log":
        return _post("/recovery/analyze-log", {**args, "project_id": os.environ.get("GOOGLE_CLOUD_PROJECT", "")})
    elif name == "overseer_status":
        return _get("/overseer/status")
    elif name == "overseer_start":
        return _post("/overseer/start", {})
    elif name == "overseer_stop":
        return _post("/overseer/stop", {})
    elif name == "webhook_register":
        return _post("/webhooks/register", args)
    elif name == "webhook_unregister":
        return _post("/webhooks/unregister", args)
    elif name == "webhook_list":
        return _get("/webhooks")
    elif name == "a2a_list_agents":
        return _get("/a2a/agents")
    elif name == "a2a_route":
        return _post("/a2a/route", args)
    elif name == "a2a_send":
        return _post("/a2a/send", args)
    elif name == "a2a_messages":
        limit = args.get("limit", 50)
        return _get(f"/a2a/messages?limit={limit}")
    elif name == "a2a_tree":
        return _get("/a2a/tree")
    elif name == "a2a_delegate":
        return _post("/a2a/delegate", args)
    elif name == "a2a_report":
        return _post("/a2a/report", args)
    elif name == "culina_status":
        return _get("/culina/status")
    elif name == "culina_start":
        return _post("/culina/start", {})
    elif name == "culina_stop":
        return _post("/culina/stop", {})
    elif name == "agents_cli_version":
        return _get("/agents-cli/version")
    elif name == "agents_cli_create":
        return _post("/agents-cli/create", args)
    elif name == "agents_cli_deploy":
        return _post("/agents-cli/deploy", args)
    elif name == "agents_cli_eval":
        return _post("/agents-cli/eval", args)
    elif name == "agents_cli_run":
        return _post("/agents-cli/run", args)
    elif name == "agents_cli_playground":
        action = args.get("action", "status")
        if action == "start":
            return _post("/agents-cli/playground/start", args)
        elif action == "stop":
            return _post("/agents-cli/playground/stop", {})
        else:
            return _get("/agents-cli/playground")
    else:
        return {"success": False, "error": f"Unknown tool: {name}"}


def dispatch_resource(uri: str) -> dict[str, Any]:
    """Read a resource by URI."""
    if uri == "orchestrator://health":
        return _get("/health")
    elif uri == "orchestrator://providers":
        return _get("/providers")
    elif uri == "orchestrator://fallback":
        return _get("/fallback/status")
    else:
        return {"error": f"Unknown resource: {uri}"}


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 protocol over stdio
# ---------------------------------------------------------------------------

def _send(msg: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def _handle(request: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Process a single JSON-RPC request. Returns response or None (for notifications)."""
    method = request.get("method", "")
    req_id = request.get("id")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"listChanged": False, "subscribe": False},
                },
                "serverInfo": {
                    "name": "vertex-orchestrator",
                    "version": "0.2.0",
                },
            },
        }
    elif method == "notifications/initialized":
        return None  # notification — no response
    elif method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    elif method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        result = dispatch_tool(tool_name, tool_args)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [{"type": "text", "text": json.dumps(result, indent=2)}],
            },
        }
    elif method == "resources/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"resources": RESOURCES}}
    elif method == "resources/read":
        uri = params.get("uri", "")
        result = dispatch_resource(uri)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "contents": [{"uri": uri, "mimeType": "application/json", "text": json.dumps(result, indent=2)}],
            },
        }
    elif method == "ping":
        return {"jsonrpc": "2.0", "id": req_id, "result": {}}
    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }


def main() -> None:
    """Run the MCP server, reading JSON-RPC messages from stdin."""
    # Log to stderr so it doesn't interfere with stdout JSON-RPC
    print("vertex-orchestrator MCP server starting (stdin/stdout JSON-RPC 2.0)", file=sys.stderr)
    print(f"  Backend: {BASE_URL}", file=sys.stderr)
    print(f"  Tools: {len(TOOLS)} | Resources: {len(RESOURCES)}", file=sys.stderr)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            _send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue

        response = _handle(request)
        if response is not None:
            _send(response)


if __name__ == "__main__":
    main()