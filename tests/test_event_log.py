"""Tests for the event logging integration."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from vertex_orchestrator.event_log import log_event, log_request, log_recovery, log_overseer, log_security


def test_log_event_writes_json_line(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_event("agent", "test event", "test details")

    log_files = [f for f in tmp_path.glob("*.log") if not f.is_symlink()]
    assert len(log_files) == 1

    line = log_files[0].read_text().strip()
    entry = json.loads(line)
    assert entry["category"] == "agent"
    assert entry["message"] == "test event"
    assert entry["details"] == "test details"
    assert "timestamp" in entry


def test_log_event_no_details(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_event("recovery", "scan complete")

    log_files = list(tmp_path.glob("*.log"))
    line = log_files[0].read_text().strip()
    entry = json.loads(line)
    assert entry["category"] == "recovery"
    assert "details" not in entry


def test_log_request(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_request("GET", "/health", 200, 5.2)

    entry = json.loads(list(tmp_path.glob("*.log"))[0].read_text().strip())
    assert "GET /health" in entry["message"]
    assert "200" in entry["message"]


def test_log_recovery(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_recovery("seed_analysis", True, "5 paths checked")

    entry = json.loads(list(tmp_path.glob("*.log"))[0].read_text().strip())
    assert entry["category"] == "recovery"
    assert "seed_analysis" in entry["message"]
    assert "✓" in entry["message"]


def test_log_overseer(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_overseer("start", True)

    entry = json.loads(list(tmp_path.glob("*.log"))[0].read_text().strip())
    assert entry["category"] == "infra"
    assert "overseer" in entry["message"]


def test_log_security(tmp_path):
    os.environ["ORCHESTRATOR_EVENT_DIR"] = str(tmp_path)
    log_security("auth_failure", "ip=127.0.0.1")

    entry = json.loads(list(tmp_path.glob("*.log"))[0].read_text().strip())
    assert entry["category"] == "security"
    assert entry["message"] == "auth_failure"