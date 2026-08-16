"""Tests for the MCP server module."""
from __future__ import annotations

import json

from vertex_orchestrator.mcp_server import TOOLS, RESOURCES, _handle, dispatch_tool, dispatch_resource


def test_tools_list_has_expected_tools():
    tool_names = [t["name"] for t in TOOLS]
    assert "execute_task" in tool_names
    assert "recovery_status" in tool_names
    assert "recovery_targets" in tool_names
    assert "overseer_status" in tool_names
    assert "fallback_status" in tool_names
    assert "health" in tool_names
    assert len(TOOLS) >= 10


def test_resources_list():
    uris = [r["uri"] for r in RESOURCES]
    assert "orchestrator://health" in uris
    assert "orchestrator://providers" in uris
    assert "orchestrator://fallback" in uris


def test_initialize_response():
    req = {"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}}
    resp = _handle(req)
    assert resp is not None
    assert resp["jsonrpc"] == "2.0"
    assert resp["id"] == 0
    result = resp["result"]
    assert "protocolVersion" in result
    assert "capabilities" in result
    assert "tools" in result["capabilities"]
    assert result["serverInfo"]["name"] == "vertex-orchestrator"


def test_tools_list_response():
    req = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
    resp = _handle(req)
    assert resp is not None
    assert "result" in resp
    assert "tools" in resp["result"]
    assert len(resp["result"]["tools"]) == len(TOOLS)


def test_resources_list_response():
    req = {"jsonrpc": "2.0", "id": 2, "method": "resources/list", "params": {}}
    resp = _handle(req)
    assert resp is not None
    assert "resources" in resp["result"]


def test_notification_no_response():
    req = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    resp = _handle(req)
    assert resp is None


def test_unknown_method_error():
    req = {"jsonrpc": "2.0", "id": 3, "method": "unknown/method", "params": {}}
    resp = _handle(req)
    assert resp is not None
    assert "error" in resp
    assert resp["error"]["code"] == -32601


def test_ping():
    req = {"jsonrpc": "2.0", "id": 4, "method": "ping", "params": {}}
    resp = _handle(req)
    assert resp is not None
    assert resp["id"] == 4
    assert "result" in resp


def test_dispatch_unknown_tool():
    result = dispatch_tool("nonexistent", {})
    assert result["success"] is False
    assert "Unknown tool" in result["error"]


def test_dispatch_unknown_resource():
    result = dispatch_resource("unknown://resource")
    assert "error" in result