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