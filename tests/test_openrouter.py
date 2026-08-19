"""Tests for OpenRouter configuration and direct /ai/generate routing."""
import os
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO

from vertex_orchestrator.config import OpenRouterConfig, VertexAIConfig
from vertex_orchestrator.server import OrchestratorHandler


class FakeHandler:
    """Minimal stand-in for testing OrchestratorHandler endpoints."""
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

    def do_POST(self):
        handler_instance = OrchestratorHandler.__new__(OrchestratorHandler)
        handler_instance.path = self.path
        handler_instance.headers = self.headers
        handler_instance._read_body = lambda: self.body
        handler_instance._send_json = self._send_json
        handler_instance._check_auth = self._check_auth
        OrchestratorHandler.do_POST(handler_instance)


class TestOpenRouterConfig(unittest.TestCase):
    def test_openrouter_config_defaults(self):
        cfg = OpenRouterConfig(api_key="test-key-123")
        self.assertEqual(cfg.api_key, "test-key-123")
        self.assertEqual(cfg.base_url, "https://openrouter.ai/api/v1")
        self.assertEqual(cfg.crewai_model_string, "openrouter/google/gemma-4-31b-it:free")
        self.assertEqual(cfg.aider_model_string, "openrouter/google/gemma-4-31b-it:free")
        self.assertEqual(cfg.autogen_config_entry["api_type"], "openai")
        self.assertIn("Bearer test-key-123", cfg.headers["Authorization"])

    def test_ai_generate_missing_prompt(self):
        fake = FakeHandler("POST", "/ai/generate", {})
        fake.do_POST()
        self.assertEqual(fake.response_code, 400)
        self.assertIn("prompt is required", fake.response_body["error"])

    @patch("urllib.request.urlopen")
    def test_ai_generate_openrouter_success(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"choices": [{"message": {"content": "Test completion response"}}], "usage": {"total_tokens": 42}}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-or-test-key"}):
            fake = FakeHandler("POST", "/ai/generate", {
                "prompt": "Hello AI",
                "provider": "openrouter",
                "model": "google/gemma-4-31b-it:free"
            })
            fake.do_POST()
            self.assertEqual(fake.response_code, 200)
            self.assertTrue(fake.response_body["success"])
            self.assertEqual(fake.response_body["content"], "Test completion response")
            self.assertEqual(fake.response_body["usage"]["total_tokens"], 42)


if __name__ == "__main__":
    unittest.main()
