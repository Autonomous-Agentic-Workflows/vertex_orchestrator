"""Tests for server extensions: Live API config, DevGate bridge, Autonomous Loops, and Vertex AI direct generation."""
import json
import os
import unittest
from unittest.mock import patch, MagicMock

from vertex_orchestrator.server import OrchestratorHandler


class FakeHandler:
    """Minimal helper for testing OrchestratorHandler HTTP methods."""
    def __init__(self, method: str, path: str, body: dict | None = None, headers: dict | None = None):
        self.method = method
        self.path = path
        self.body = body or {}
        self.headers = headers or {}
        self.response_code = None
        self.response_body = None
        self.client_address = ("127.0.0.1", 0)

    def _send_json(self, code, data):
        self.response_code = code
        self.response_body = data

    def _check_auth(self):
        return True

    def _read_body(self):
        return self.body

    def do_GET(self):
        handler_instance = OrchestratorHandler.__new__(OrchestratorHandler)
        handler_instance.path = self.path
        handler_instance.headers = self.headers
        handler_instance._read_body = self._read_body
        handler_instance._send_json = self._send_json
        handler_instance._check_auth = self._check_auth
        OrchestratorHandler.do_GET(handler_instance)

    def do_POST(self):
        handler_instance = OrchestratorHandler.__new__(OrchestratorHandler)
        handler_instance.path = self.path
        handler_instance.headers = self.headers
        handler_instance._read_body = self._read_body
        handler_instance._send_json = self._send_json
        handler_instance._check_auth = self._check_auth
        OrchestratorHandler.do_POST(handler_instance)


class TestServerExtensions(unittest.TestCase):
    def test_get_live_api_config(self):
        fake = FakeHandler("GET", "/ai/live/config")
        fake.do_GET()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        self.assertEqual(fake.response_body["protocol"], "wss")
        self.assertIn("Puck", fake.response_body["voices"])
        self.assertIn("models/gemini-2.0-flash-exp", fake.response_body["supported_models"])

    def test_get_devgate_status(self):
        fake = FakeHandler("GET", "/devgate/status")
        fake.do_GET()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        self.assertEqual(fake.response_body["client"], "HermesBridgeClient")
        self.assertIn("crewai", fake.response_body["supported_runners"])

    def test_post_devgate_verify(self):
        fake = FakeHandler("POST", "/devgate/verify", {"client_id": "Android-Pixel-9-Pro"})
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["verified"])
        self.assertEqual(fake.response_body["client_id"], "Android-Pixel-9-Pro")
        self.assertTrue(fake.response_body["session_token"].startswith("devgate-"))

    def test_get_loops_status(self):
        fake = FakeHandler("GET", "/loops/status")
        fake.do_GET()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        self.assertIn("loop_1", fake.response_body["loops"])
        self.assertEqual(fake.response_body["loops"]["loop_1"]["name"], "Recovery Scanning")

    def test_post_loops_trigger(self):
        fake = FakeHandler("POST", "/loops/trigger", {"loop_id": "loop_1", "dry_run": True})
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        self.assertTrue(fake.response_body["triggered"])
        self.assertEqual(fake.response_body["mode"], "dry_run")

    @patch("google.genai.Client")
    def test_ai_generate_vertex_ai(self, mock_client_cls):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "Vertex AI generated response"
        mock_client.models.generate_content.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        fake = FakeHandler("POST", "/ai/generate", {
            "prompt": "Summarize status",
            "provider": "vertex_ai",
            "model": "gemini-2.5-flash"
        })
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        self.assertEqual(fake.response_body["provider"], "vertex_ai")
        self.assertEqual(fake.response_body["content"], "Vertex AI generated response")

    def test_post_and_get_telemetry(self):
        fake_post = FakeHandler("POST", "/telemetry", {
            "source": "test_agent",
            "event": "audit_metric",
            "metric_value": 42
        })
        fake_post.do_POST()
        self.assertEqual(fake_post.response_code, 200)
        self.assertTrue(fake_post.response_body["success"])
        self.assertTrue(fake_post.response_body["recorded"])

        fake_get = FakeHandler("GET", "/telemetry/recent?limit=5")
        fake_get.do_GET()
        self.assertEqual(fake_get.response_code, 200)
        self.assertTrue(fake_get.response_body["success"])
        self.assertGreaterEqual(fake_get.response_body["count"], 1)

    def test_loops_start_stop_all(self):
        fake_start = FakeHandler("POST", "/loops/start-all")
        fake_start.do_POST()
        self.assertEqual(fake_start.response_code, 200)
        self.assertTrue(fake_start.response_body["success"])

        fake_stop = FakeHandler("POST", "/loops/stop-all")
        fake_stop.do_POST()
        self.assertEqual(fake_stop.response_code, 200)
        self.assertTrue(fake_stop.response_body["success"])

    def test_loops_trigger_by_name(self):
        fake_trigger = FakeHandler("POST", "/loops/trigger/recovery_scanning?dry=1")
        fake_trigger.do_POST()
        self.assertEqual(fake_trigger.response_code, 200)
        self.assertTrue(fake_trigger.response_body["success"])
        self.assertEqual(fake_trigger.response_body["loop_id"], "recovery_scanning")
        self.assertEqual(fake_trigger.response_body["mode"], "dry_run")


if __name__ == "__main__":
    unittest.main()

