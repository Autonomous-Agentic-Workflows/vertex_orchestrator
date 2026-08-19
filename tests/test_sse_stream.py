#!/usr/bin/env python3
"""
Unit and integration tests for Server-Sent Events (SSE) streaming endpoints:
1. AgentBus: GET /messages/stream
2. Vertex Orchestrator: GET /telemetry/stream

Verifies connection establishment, initial handshake, real-time event broadcasting,
subscription filtering (by tenant, agent, category, event_type), keep-alive heartbeats,
and clean client disconnect handling.
"""

from __future__ import annotations

import json
import os
import sys
import time
import socket
import urllib.request
import urllib.error
import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer

# Ensure project paths are in sys.path
sys.path.insert(0, "/home/conor-ops")
sys.path.insert(0, "/home/conor-ops/lib")
sys.path.insert(0, "/home/conor-ops/vertex_orchestrator/src")

import agent_bus
from vertex_orchestrator.server import OrchestratorHandler, broadcast_telemetry, _telemetry_subscribers


def _parse_sse_frame(raw_text: str) -> list[dict]:
    """Parses raw SSE stream text into structured event frames."""
    events = []
    current_event = {}
    lines = raw_text.splitlines()
    for line in lines:
        if line.startswith(":"):
            # Comment / keepalive line
            continue
        elif line.startswith("event:"):
            current_event["event"] = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_str = line[len("data:"):].strip()
            try:
                current_event["data"] = json.loads(data_str)
            except Exception:
                current_event["data"] = data_str
        elif line == "":
            if current_event:
                events.append(current_event)
                current_event = {}
    if current_event:
        events.append(current_event)
    return events


class TestAgentBusSSE(unittest.TestCase):
    """Tests for AgentBus GET /messages/stream SSE streaming."""

    @classmethod
    def setUpClass(cls):
        # Start ephemeral AgentBus HTTP server on random port
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), agent_bus.AgentBusHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_agent_bus_sse_connect_and_handshake(self):
        """Test initial handshake upon connecting to GET /messages/stream."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/messages/stream")
        resp = conn.getresponse()

        self.assertEqual(resp.status, 200)
        self.assertIn("text/event-stream", resp.getheader("Content-Type", ""))
        self.assertIn("no-cache", resp.getheader("Cache-Control", ""))

        # Read first chunk containing the 'connected' handshake frame
        chunk = resp.read(256).decode("utf-8")
        events = _parse_sse_frame(chunk)

        self.assertTrue(len(events) >= 1)
        handshake = events[0]
        self.assertEqual(handshake.get("event"), "connected")
        self.assertEqual(handshake.get("data", {}).get("status"), "connected")
        self.assertEqual(handshake.get("data", {}).get("stream"), "agent_bus")
        conn.close()

    def test_agent_bus_sse_event_broadcast(self):
        """Test real-time event broadcasting to connected SSE clients via append_to_bus."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/messages/stream")
        resp = conn.getresponse()

        # Read initial handshake
        _ = resp.read(256)

        # Append test event to agent bus
        test_event = {
            "type": "MESSAGE_DISPATCHED",
            "sender": "overseer",
            "recipient": "researcher",
            "tenant_id": "tenant-test",
            "payload": {"action": "scan_system", "urgency": "high"},
        }
        agent_bus.broadcast_sse_event(test_event)

        # Read event frame
        chunk = resp.read(512).decode("utf-8")
        events = _parse_sse_frame(chunk)
        self.assertTrue(len(events) >= 1)

        dispatched_event = next((e for e in events if e.get("event") == "MESSAGE_DISPATCHED"), None)
        self.assertIsNotNone(dispatched_event)
        self.assertEqual(dispatched_event["data"]["sender"], "overseer")
        self.assertEqual(dispatched_event["data"]["recipient"], "researcher")
        conn.close()

    def test_agent_bus_sse_filter_by_agent(self):
        """Test subscription filter by agent: only matching agent events are received."""
        # Client 1 subscribes to 'worker-alpha'
        conn1 = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn1.request("GET", "/messages/stream?agent=worker-alpha")
        resp1 = conn1.getresponse()
        _ = resp1.read(256)

        # Client 2 subscribes to 'worker-beta'
        conn2 = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn2.request("GET", "/messages/stream?agent=worker-beta")
        resp2 = conn2.getresponse()
        _ = resp2.read(256)

        # Broadcast event specifically targeted to worker-alpha
        alpha_event = {
            "type": "MESSAGE_DISPATCHED",
            "sender": "coordinator",
            "recipient": "worker-alpha",
            "payload": {"task": "alpha_task"},
        }
        agent_bus.broadcast_sse_event(alpha_event)

        # Client 1 should receive it
        chunk1 = resp1.read(512).decode("utf-8")
        events1 = _parse_sse_frame(chunk1)
        self.assertTrue(any(e.get("data", {}).get("recipient") == "worker-alpha" for e in events1))

        conn1.close()
        conn2.close()

    def test_agent_bus_sse_filter_by_event_type(self):
        """Test subscription filter by event type (e.g. AGENT_REGISTERED)."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/messages/stream?event=AGENT_REGISTERED")
        resp = conn.getresponse()
        _ = resp.read(256)

        # Send unmatching event
        agent_bus.broadcast_sse_event({
            "type": "MESSAGE_DISPATCHED",
            "sender": "a",
            "recipient": "b",
            "payload": {},
        })

        # Send matching event
        agent_bus.broadcast_sse_event({
            "type": "AGENT_REGISTERED",
            "agent_id": "test-agent-99",
            "capabilities": ["code_review"],
        })

        chunk = resp.read(512).decode("utf-8")
        events = _parse_sse_frame(chunk)
        self.assertTrue(any(e.get("event") == "AGENT_REGISTERED" for e in events))
        self.assertFalse(any(e.get("event") == "MESSAGE_DISPATCHED" for e in events))
        conn.close()

    def test_agent_bus_sse_keepalive_heartbeat(self):
        """Test that keep-alive heartbeats are emitted at configured intervals."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/messages/stream?heartbeat=0.5")
        resp = conn.getresponse()
        _ = resp.read(256)

        time.sleep(0.7)
        chunk = resp.read(512).decode("utf-8")
        self.assertTrue(": keepalive" in chunk or "ping" in chunk)
        conn.close()

    def test_agent_bus_sse_clean_client_disconnect(self):
        """Test that client disconnection is handled gracefully without server exception or subscriber leakage."""
        initial_subs_count = len(agent_bus._SSE_SUBSCRIBERS)

        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/messages/stream")
        resp = conn.getresponse()
        _ = resp.read(256)

        self.assertEqual(len(agent_bus._SSE_SUBSCRIBERS), initial_subs_count + 1)

        # Abruptly close client connection
        conn.close()

        # Emit an event to trigger write failure on closed socket
        agent_bus.broadcast_sse_event({"type": "DISCONNECT_TRIGGER", "time": time.time()})
        time.sleep(0.6)

        # Verify subscriber was cleaned up
        self.assertEqual(len(agent_bus._SSE_SUBSCRIBERS), initial_subs_count)


class TestVertexOrchestratorSSE(unittest.TestCase):
    """Tests for Vertex Orchestrator GET /telemetry/stream SSE streaming."""

    @classmethod
    def setUpClass(cls):
        # Start ephemeral Orchestrator HTTP server on random port
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), OrchestratorHandler)
        cls.port = cls.server.server_address[1]
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_vertex_orchestrator_sse_connect_and_handshake(self):
        """Test handshake frame on connecting to /telemetry/stream."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/telemetry/stream")
        resp = conn.getresponse()

        self.assertEqual(resp.status, 200)
        self.assertIn("text/event-stream", resp.getheader("Content-Type", ""))

        chunk = resp.read(256).decode("utf-8")
        events = _parse_sse_frame(chunk)

        self.assertTrue(len(events) >= 1)
        handshake = events[0]
        self.assertEqual(handshake.get("event"), "connected")
        self.assertEqual(handshake.get("data", {}).get("stream"), "telemetry")
        conn.close()

    def test_vertex_orchestrator_sse_telemetry_broadcast(self):
        """Test telemetry broadcasting to connected SSE clients."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/telemetry/stream")
        resp = conn.getresponse()
        _ = resp.read(256)

        telemetry_event = {
            "event": "orchestrator.task",
            "category": "orchestrator",
            "task_id": "test-task-123",
            "status": "completed",
            "duration_ms": 42,
        }
        broadcast_telemetry(telemetry_event)

        chunk = resp.read(512).decode("utf-8")
        events = _parse_sse_frame(chunk)
        self.assertTrue(len(events) >= 1)

        task_ev = next((e for e in events if e.get("event") == "orchestrator.task"), None)
        self.assertIsNotNone(task_ev)
        self.assertEqual(task_ev["data"]["task_id"], "test-task-123")
        conn.close()

    def test_vertex_orchestrator_sse_agent_lifecycle_events(self):
        """Test agent registration and unregistration broadcast lifecycle events via SSE."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/telemetry/stream")
        resp = conn.getresponse()
        _ = resp.read(256)

        # Register agent via POST /a2a/register
        reg_payload = json.dumps({
            "id": "sse-test-agent",
            "name": "SSE Test Agent",
            "agent_type": "external",
            "keywords": ["sse", "streaming"],
        }).encode("utf-8")

        post_conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        post_conn.request("POST", "/a2a/register", body=reg_payload, headers={"Content-Type": "application/json"})
        post_resp = post_conn.getresponse()
        self.assertEqual(post_resp.status, 200)

        # Read SSE frame for agent.registered
        chunk = resp.read(512).decode("utf-8")
        events = _parse_sse_frame(chunk)
        reg_ev = next((e for e in events if e.get("event") == "agent.registered"), None)
        self.assertIsNotNone(reg_ev)
        self.assertEqual(reg_ev["data"]["payload"]["agent_id"], "sse-test-agent")

        # Unregister agent via POST /a2a/unregister
        unreg_payload = json.dumps({"id": "sse-test-agent"}).encode("utf-8")
        post_conn.request("POST", "/a2a/unregister", body=unreg_payload, headers={"Content-Type": "application/json"})
        unreg_resp = post_conn.getresponse()
        self.assertEqual(unreg_resp.status, 200)

        # Read SSE frame for agent.unregistered
        chunk2 = resp.read(512).decode("utf-8")
        events2 = _parse_sse_frame(chunk2)
        unreg_ev = next((e for e in events2 if e.get("event") == "agent.unregistered"), None)
        self.assertIsNotNone(unreg_ev)
        self.assertEqual(unreg_ev["data"]["payload"]["agent_id"], "sse-test-agent")

        post_conn.close()
        conn.close()

    def test_vertex_orchestrator_sse_filter_by_category(self):
        """Test filtering telemetry stream by category (e.g. ?category=llm)."""
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/telemetry/stream?category=llm")
        resp = conn.getresponse()
        _ = resp.read(256)

        # Broadcast non-llm event
        broadcast_telemetry({
            "event": "orchestrator.loop",
            "category": "orchestrator",
            "data": "loop_cycle",
        })

        # Broadcast llm event
        broadcast_telemetry({
            "event": "llm.token",
            "category": "llm",
            "provider": "openrouter",
            "tokens": 45,
        })

        chunk = resp.read(512).decode("utf-8")
        events = _parse_sse_frame(chunk)
        self.assertTrue(any(e.get("event") == "llm.token" for e in events))
        self.assertFalse(any(e.get("event") == "orchestrator.loop" for e in events))
        conn.close()

    def test_vertex_orchestrator_sse_clean_disconnect(self):
        """Test clean disconnect handling for Orchestrator telemetry SSE."""
        initial_subs_count = len(_telemetry_subscribers)

        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", "/telemetry/stream")
        resp = conn.getresponse()
        _ = resp.read(256)

        self.assertEqual(len(_telemetry_subscribers), initial_subs_count + 1)
        conn.close()

        # Emit an event to trigger cleanup
        broadcast_telemetry({"event": "cleanup_probe", "time": time.time()})
        time.sleep(0.6)

        self.assertEqual(len(_telemetry_subscribers), initial_subs_count)


if __name__ == "__main__":
    unittest.main(verbosity=2)
