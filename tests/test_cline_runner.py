"""Tests for the Cline runner module."""
from __future__ import annotations

import os
import tempfile

from vertex_orchestrator.cline_runner import ClineConfig, ClineResult, ClineRunner


def _mock_exec_success(cmd, cwd, timeout):
    return (0, "Task completed successfully", "")


def _mock_exec_failure(cmd, cwd, timeout):
    return (1, "", "Error: model not found")


def test_cline_config_defaults():
    config = ClineConfig()
    assert config.provider == "ollama"
    assert config.model == "gemma4:26b"
    assert config.timeout == 120


def test_cline_runner_success():
    config = ClineConfig(binary="/usr/bin/cline")
    runner = ClineRunner(config=config, task="fix the tests")
    result = runner.run(mock_exec=_mock_exec_success)
    assert result.success is True
    assert "Task completed" in result.output
    assert result.exit_code == 0


def test_cline_runner_failure():
    config = ClineConfig(binary="/usr/bin/cline")
    runner = ClineRunner(config=config, task="fix the tests")
    result = runner.run(mock_exec=_mock_exec_failure)
    assert result.success is False
    assert "model not found" in result.error
    assert result.exit_code == 1


def test_cline_runner_binary_not_found():
    config = ClineConfig(binary="/nonexistent/cline")
    runner = ClineRunner(config=config, task="test")
    result = runner.run()
    assert result.success is False
    assert "not found" in result.error


def test_cline_runner_builds_correct_command():
    config = ClineConfig(binary="/usr/bin/cline", provider="ollama", model="gemma4:31b")

    captured_cmd = []

    def capture(cmd, cwd, timeout):
        captured_cmd.extend(cmd)
        return (0, "ok", "")

    runner = ClineRunner(config=config, task="analyze code")
    runner.run(mock_exec=capture)

    assert captured_cmd[0] == "/usr/bin/cline"
    assert "-P" in captured_cmd
    assert "ollama" in captured_cmd
    assert "-m" in captured_cmd
    assert "gemma4:31b" in captured_cmd
    assert "analyze code" in captured_cmd


def test_cline_result_repr():
    ok = ClineResult(success=True, output="done")
    assert "success=True" in repr(ok)
    fail = ClineResult(success=False, error="boom")
    assert "success=False" in repr(fail)