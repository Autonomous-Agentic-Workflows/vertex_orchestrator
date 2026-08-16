"""Tests for webhook registration, listing, unregistration, and event firing."""
import json
import os
import sys
import unittest
from io import BytesIO
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Ensure no API key so auth is open
os.environ.pop("ORCHESTRATOR_API_KEY", None)

from vertex_orchestrator.server import (
    OrchestratorHandler,
    _webhooks,
    _webhooks_lock,
    _fire_webhooks,
)


class FakeHandler:
    """Minimal stand-in to call handler methods without a real socket."""

    def __init__(self, method: str, path: str, body: dict | None = None,
                 headers: dict | None = None):
        self.method = method
        self.path = path
        self.body = body or {}
        self.headers = headers or {}
        self.response_code = None
        self.response_body = None
        self.client_address = ("127.0.0.1", 0)

    # Mimic BaseHTTPRequestHandler interface
    def _send_json(self, code, data):
        self.response_code = code
        self.response_body = data

    def _check_auth(self):
        return True

    def _read_body(self):
        return self.body

    def do_GET(self):
        # Use the real handler's do_GET but with our overrides
        handler = self._make_handler()
        handler.do_GET()

    def do_POST(self):
        handler = self._make_handler()
        handler.do_POST()

    def _make_handler(self):
        handler = OrchestratorHandler.__new__(OrchestratorHandler)
        handler.path = self.path
        handler.headers = MagicMock()
        handler.headers.get = lambda k, d="": self.headers.get(k, d)
        handler.client_address = self.client_address
        body_bytes = json.dumps(self.body).encode() if self.body else b""
        handler.rfile = BytesIO(body_bytes)
        handler.headers = MagicMock()
        handler.headers.get = lambda k, d="": (
            str(len(body_bytes)) if k == "Content-Length" else self.headers.get(k, d)
        )
        handler._send_json = self._send_json
        handler._check_auth = self._check_auth
        handler._read_body = self._read_body
        return handler


class TestWebhookRegister(unittest.TestCase):

    def setUp(self):
        with _webhooks_lock:
            _webhooks.clear()

    def tearDown(self):
        with _webhooks_lock:
            _webhooks.clear()

    def test_register_webhook(self):
        """POST /webhooks/register stores URL + events."""
        fake = FakeHandler("POST", "/webhooks/register", {
            "url": "http://localhost:9999/callback",
            "events": ["task.complete"],
        })
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        with _webhooks_lock:
            self.assertIn("http://localhost:9999/callback", _webhooks)
            self.assertEqual(
                _webhooks["http://localhost:9999/callback"]["events"],
                ["task.complete"],
            )

    def test_register_webhook_default_events(self):
        """If no events specified, defaults to ['*'] (all events)."""
        fake = FakeHandler("POST", "/webhooks/register", {
            "url": "http://localhost:9999/cb",
        })
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        with _webhooks_lock:
            self.assertEqual(_webhooks["http://localhost:9999/cb"]["events"], ["*"])

    def test_register_webhook_with_secret(self):
        """Secret is stored and can be used for auth."""
        fake = FakeHandler("POST", "/webhooks/register", {
            "url": "http://localhost:9999/cb",
            "secret": "my-secret",
        })
        fake.do_POST()
        with _webhooks_lock:
            self.assertEqual(_webhooks["http://localhost:9999/cb"]["secret"], "my-secret")

    def test_register_invalid_url(self):
        """Non-http URL should be rejected."""
        fake = FakeHandler("POST", "/webhooks/register", {"url": "ftp://bad"})
        fake.do_POST()
        self.assertEqual(fake.response_code, 400)
        self.assertFalse(fake.response_body["success"])

    def test_register_missing_url(self):
        """Missing URL should return 400."""
        fake = FakeHandler("POST", "/webhooks/register", {})
        fake.do_POST()
        self.assertEqual(fake.response_code, 400)


class TestWebhookList(unittest.TestCase):

    def setUp(self):
        with _webhooks_lock:
            _webhooks.clear()
            _webhooks["http://a/cb"] = {"events": ["task.complete"], "secret": ""}
            _webhooks["http://b/cb"] = {"events": ["*"], "secret": "s"}

    def tearDown(self):
        with _webhooks_lock:
            _webhooks.clear()

    def test_list_webhooks(self):
        """GET /webhooks returns all registered webhooks."""
        fake = FakeHandler("GET", "/webhooks")
        fake.do_GET()
        self.assertEqual(fake.response_code, 200)
        urls = [h["url"] for h in fake.response_body["webhooks"]]
        self.assertIn("http://a/cb", urls)
        self.assertIn("http://b/cb", urls)
        self.assertEqual(len(fake.response_body["webhooks"]), 2)

    def test_list_webhooks_empty(self):
        """GET /webhooks returns empty list when no webhooks registered."""
        with _webhooks_lock:
            _webhooks.clear()
        fake = FakeHandler("GET", "/webhooks")
        fake.do_GET()
        self.assertEqual(fake.response_code, 200)
        self.assertEqual(fake.response_body["webhooks"], [])


class TestWebhookUnregister(unittest.TestCase):

    def setUp(self):
        with _webhooks_lock:
            _webhooks.clear()
            _webhooks["http://a/cb"] = {"events": ["*"], "secret": ""}

    def tearDown(self):
        with _webhooks_lock:
            _webhooks.clear()

    def test_unregister_existing(self):
        """POST /webhooks/unregister removes an existing webhook."""
        fake = FakeHandler("POST", "/webhooks/unregister", {"url": "http://a/cb"})
        fake.do_POST()
        self.assertEqual(fake.response_code, 200)
        self.assertTrue(fake.response_body["success"])
        with _webhooks_lock:
            self.assertNotIn("http://a/cb", _webhooks)

    def test_unregister_nonexistent(self):
        """POST /webhooks/unregister returns 404 for unknown URL."""
        fake = FakeHandler("POST", "/webhooks/unregister", {"url": "http://nope/cb"})
        fake.do_POST()
        self.assertEqual(fake.response_code, 404)
        self.assertFalse(fake.response_body["success"])


class TestFireWebhooks(unittest.TestCase):

    def setUp(self):
        with _webhooks_lock:
            _webhooks.clear()

    def tearDown(self):
        with _webhooks_lock:
            _webhooks.clear()

    @patch("vertex_orchestrator.server._post_webhook")
    def test_fire_matching_webhooks(self, mock_post):
        """_fire_webhooks calls _post_webhook for matching event subscriptions."""
        with _webhooks_lock:
            _webhooks["http://a/cb"] = {"events": ["task.complete"], "secret": ""}
            _webhooks["http://b/cb"] = {"events": ["recovery.found"], "secret": ""}
        _fire_webhooks("task.complete", {"task_id": 1})
        # Only http://a/cb should be called (matches task.complete)
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertEqual(call_args[0][0], "http://a/cb")

    @patch("vertex_orchestrator.server._post_webhook")
    def test_fire_wildcard_webhooks(self, mock_post):
        """Webhooks with ['*'] events receive all notifications."""
        with _webhooks_lock:
            _webhooks["http://wild/cb"] = {"events": ["*"], "secret": ""}
        _fire_webhooks("recovery.found", {"match": "BTC"})
        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args[0][0], "http://wild/cb")

    @patch("vertex_orchestrator.server._post_webhook")
    def test_fire_no_matching_webhooks(self, mock_post):
        """No matching webhooks = no calls."""
        with _webhooks_lock:
            _webhooks["http://a/cb"] = {"events": ["recovery.found"], "secret": ""}
        _fire_webhooks("task.complete", {})
        mock_post.assert_not_called()


if __name__ == "__main__":
    unittest.main()