"""Tests for the A2A routing harness and Culina manager."""
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from vertex_orchestrator.a2a_router import A2ARouter, Agent, A2AMessage


# ---------------------------------------------------------------------------
# A2A Router — agent registry
# ---------------------------------------------------------------------------

class TestAgentRegistry:
    def _fresh_router(self):
        return A2ARouter()

    def test_register_and_list(self):
        r = self._fresh_router()
        agent = Agent(id="test-1", name="Test Agent", agent_type="external",
                      keywords=["test", "debug"])
        result = r.register_agent(agent)
        assert result["status"] == "registered"
        agents = r.list_agents()
        assert len(agents) == 1
        assert agents[0]["id"] == "test-1"

    def test_unregister(self):
        r = self._fresh_router()
        agent = Agent(id="test-2", name="Test", agent_type="external", keywords=[])
        r.register_agent(agent)
        result = r.unregister_agent("test-2")
        assert result["status"] == "unregistered"
        assert len(r.list_agents()) == 0

    def test_unregister_not_found(self):
        r = self._fresh_router()
        result = r.unregister_agent("nonexistent")
        assert result["status"] == "not_found"

    def test_get_agent(self):
        r = self._fresh_router()
        agent = Agent(id="test-3", name="Test", agent_type="hub", keywords=["health"])
        r.register_agent(agent)
        found = r.get_agent("test-3")
        assert found is not None
        assert found.name == "Test"
        assert r.get_agent("nope") is None


# ---------------------------------------------------------------------------
# A2A Router — keyword matching
# ---------------------------------------------------------------------------

class TestKeywordRouting:
    def test_matches_exact(self):
        agent = Agent(id="a", name="A", agent_type="hub", keywords=["recovery", "backup"])
        assert agent.matches("recovery")
        assert agent.matches("backup")

    def test_matches_case_insensitive(self):
        agent = Agent(id="a", name="A", agent_type="hub", keywords=["Recovery"])
        assert agent.matches("RECOVERY")
        assert agent.matches("recovery")

    def test_matches_partial(self):
        agent = Agent(id="a", name="A", agent_type="hub", keywords=["disaster-recovery"])
        assert agent.matches("disaster")

    def test_no_match(self):
        agent = Agent(id="a", name="A", agent_type="hub", keywords=["recovery"])
        assert not agent.matches("deploy")

    def test_route_by_keyword(self):
        r = A2ARouter()
        r.register_agent(Agent(id="dr", name="DR", agent_type="hub", keywords=["disaster", "recovery"]))
        r.register_agent(Agent(id="backup", name="Backup", agent_type="hub", keywords=["backup", "restore"]))
        r.register_agent(Agent(id="deploy", name="Deploy", agent_type="hub", keywords=["deploy", "cloud-run"]))

        matches = r.route_by_keyword("recovery")
        assert len(matches) == 1
        assert matches[0].id == "dr"

        matches = r.route_by_keyword("backup")
        assert len(matches) == 1
        assert matches[0].id == "backup"


# ---------------------------------------------------------------------------
# A2A Router — message routing
# ---------------------------------------------------------------------------

class TestMessageRouting:
    def test_broadcast_with_keywords(self):
        r = A2ARouter()
        r.register_agent(Agent(id="a1", name="A1", agent_type="hub", keywords=["scan"]))
        r.register_agent(Agent(id="a2", name="A2", agent_type="hub", keywords=["scan", "analyze"]))
        r.register_agent(Agent(id="a3", name="A3", agent_type="hub", keywords=["deploy"]))

        msg = A2AMessage(sender="external", recipient="*", content="run scan",
                         keywords=["scan"])
        result = r.route_message(msg)
        assert result["type"] == "broadcast"
        assert result["delivered_to"] == 2  # a1 and a2, not a3

    def test_broadcast_no_keywords_hits_all(self):
        r = A2ARouter()
        r.register_agent(Agent(id="a1", name="A1", agent_type="hub", keywords=[]))
        r.register_agent(Agent(id="a2", name="A2", agent_type="hub", keywords=[]))

        msg = A2AMessage(sender="external", recipient="*", content="hello all")
        result = r.route_message(msg)
        assert result["delivered_to"] == 2

    def test_direct_send(self):
        r = A2ARouter()
        r.register_agent(Agent(id="target", name="Target", agent_type="service",
                               keywords=[], endpoint=None))

        msg = A2AMessage(sender="external", recipient="target", content="direct msg")
        result = r.route_message(msg)
        assert result["type"] == "direct"
        assert result["delivered_to"] == 1
        assert result["agent_id"] == "target"

    def test_direct_send_not_found(self):
        r = A2ARouter()
        msg = A2AMessage(sender="external", recipient="nonexistent", content="msg")
        result = r.route_message(msg)
        assert result["type"] == "direct"
        assert "error" in result

    def test_broadcast_excludes_sender(self):
        r = A2ARouter()
        r.register_agent(Agent(id="a1", name="A1", agent_type="hub", keywords=["scan"]))
        r.register_agent(Agent(id="a2", name="A2", agent_type="hub", keywords=["scan"]))

        msg = A2AMessage(sender="a1", recipient="*", content="scan request", keywords=["scan"])
        result = r.route_message(msg)
        # a1 is the sender, so only a2 should receive
        assert result["delivered_to"] == 1

    def test_in_process_agent_queued(self):
        r = A2ARouter()
        r.register_agent(Agent(id="local", name="Local", agent_type="hub", keywords=["test"]))

        msg = A2AMessage(sender="ext", recipient="local", content="test")
        result = r.route_message(msg)
        assert result["result"]["status"] == "queued"

    def test_message_log(self):
        r = A2ARouter()
        r.register_agent(Agent(id="a", name="A", agent_type="hub", keywords=[]))
        msg = A2AMessage(sender="ext", recipient="a", content="logged")
        r.route_message(msg)
        log = r.get_message_log()
        assert len(log) == 1
        assert log[0]["content"] == "logged"

    def test_message_log_limit(self):
        r = A2ARouter()
        r.register_agent(Agent(id="a", name="A", agent_type="hub", keywords=[]))
        for i in range(10):
            r.route_message(A2AMessage(sender="ext", recipient="a", content=f"msg-{i}"))
        log = r.get_message_log(limit=5)
        assert len(log) == 5
        # Should be most recent first
        assert log[0]["content"] == "msg-9"


# ---------------------------------------------------------------------------
# A2A Router — fleet loading
# ---------------------------------------------------------------------------

class TestFleetLoading:
    def test_load_hub_agents_with_mock(self, tmp_path):
        state_file = tmp_path / "state.json"
        state_data = {
            "agents": {
                "dr-agent": {"status": "healthy"},
                "backup": {"status": "degraded"},
            }
        }
        state_file.write_text(json.dumps(state_data))

        r = A2ARouter()
        with patch("vertex_orchestrator.a2a_router.HUB_STATE_FILE", state_file):
            count = r.load_hub_agents()

        assert count == 2
        agents = r.list_agents()
        ids = [a["id"] for a in agents]
        assert "dr-agent" in ids
        assert "backup" in ids

    def test_load_fleet_agents_with_mock(self, tmp_path):
        config_file = tmp_path / "agents.json"
        config_data = {
            "agents": {
                "project_manager": {
                    "provider": "google",
                    "model": "gemini-pro",
                    "purpose": "Oversee inventory and architecture.",
                    "script": "pm.py",
                },
                "researcher": {
                    "provider": "openrouter",
                    "model": "perplexity/sonar",
                    "purpose": "Deep forensic research and intelligence gathering.",
                    "script": "researcher.py",
                },
            }
        }
        config_file.write_text(json.dumps(config_data))

        r = A2ARouter()
        with patch("vertex_orchestrator.a2a_router.FLEET_CONFIG_FILE", config_file):
            count = r.load_fleet_agents()

        assert count == 2
        agents = r.list_agents()
        ids = [a["id"] for a in agents]
        assert "fleet:project_manager" in ids
        assert "fleet:researcher" in ids

    def test_register_service_agents(self):
        r = A2ARouter()
        count = r.register_service_agents()
        agents = r.list_agents()
        ids = [a["id"] for a in agents]
        assert "overseer" in ids
        assert "culina" in ids
        assert "vertex-orchestrator" in ids
        assert "openclaw" in ids
        assert "hermes" in ids
        assert "ollama-router" in ids
        assert "cline" in ids
        assert count == 7

    def test_load_hub_agents_missing_file(self):
        r = A2ARouter()
        with patch("vertex_orchestrator.a2a_router.HUB_STATE_FILE", Path("/nonexistent/path.json")):
            count = r.load_hub_agents()
        assert count == 0


# ---------------------------------------------------------------------------
# A2A Message
# ---------------------------------------------------------------------------

class TestA2AMessage:
    def test_message_id_auto_generated(self):
        msg = A2AMessage(sender="a", recipient="b", content="test")
        assert msg.id.startswith("a2a-")

    def test_message_id_preserved(self):
        msg = A2AMessage(sender="a", recipient="b", content="test", id="custom-id")
        assert msg.id == "custom-id"

    def test_message_timestamp_auto(self):
        msg = A2AMessage(sender="a", recipient="b", content="test")
        assert msg.timestamp > 0


# ---------------------------------------------------------------------------
# Culina Manager
# ---------------------------------------------------------------------------

class TestCulinaManager:
    def test_culina_status_not_running(self):
        from vertex_orchestrator.culina_manager import CulinaProcess
        cp = CulinaProcess()
        assert cp.is_running() is False
        health = cp.check_health()
        assert health["reachable"] is False
        assert "not running" in health["reason"]

    def test_culina_start_missing_dir(self):
        from vertex_orchestrator.culina_manager import CulinaProcess
        cp = CulinaProcess(working_dir="/nonexistent/culina")
        result = cp.start()
        assert result["status"] == "error"
        assert "not found" in result["error"]

    def test_culina_singleton(self):
        from vertex_orchestrator.culina_manager import get_culina
        c1 = get_culina()
        c2 = get_culina()
        assert c1 is c2