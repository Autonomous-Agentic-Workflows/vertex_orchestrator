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
        assert "compliance-legal" in ids
        assert "gdpr-compliance" in ids
        assert "backup" in ids
        assert "git-profiles" in ids
        assert "agents-cli" in ids
        assert count == 13

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


# ---------------------------------------------------------------------------
# Agents CLI Manager
# ---------------------------------------------------------------------------

class TestAgentsCliManager:
    def test_singleton(self):
        from vertex_orchestrator.agents_cli_manager import get_agents_cli
        c1 = get_agents_cli()
        c2 = get_agents_cli()
        assert c1 is c2

    def test_version(self):
        from vertex_orchestrator.agents_cli_manager import AgentsCliManager
        cli = AgentsCliManager()
        result = cli.version()
        assert result["success"] is True
        assert "1.3" in result["stdout"]

    def test_playground_not_running(self):
        from vertex_orchestrator.agents_cli_manager import AgentsCliManager
        cli = AgentsCliManager()
        status = cli.playground_status()
        assert status["running"] is False

    def test_stop_playground_not_running(self):
        from vertex_orchestrator.agents_cli_manager import AgentsCliManager
        cli = AgentsCliManager()
        result = cli.stop_playground()
        assert result["status"] == "not_running"

    def test_create_missing_project_name(self):
        from vertex_orchestrator.agents_cli_manager import AgentsCliManager
        cli = AgentsCliManager()
        # create with empty name will fail
        result = cli.create("", output_dir="/tmp")
        assert result["success"] is False

    def test_agents_cli_in_a2a_registry(self):
        r = A2ARouter()
        r.register_service_agents()
        agent = r.get_agent("agents-cli")
        assert agent is not None
        assert agent.level == 1
        assert agent.parent_id == "vertex-orchestrator"
        assert "scaffold" in agent.keywords
        assert "deploy" in agent.keywords


# ---------------------------------------------------------------------------
# Hierarchical routing
# ---------------------------------------------------------------------------

class TestHierarchicalRouting:
    """Test the 3-tier hierarchy: Orchestrator → Managers → Workers."""

    def _build_test_hierarchy(self):
        """Build a small test hierarchy:
        vertex-orchestrator (L0)
        ├── dr-agent (L1)
        │   ├── fleet:seed_finder (L2)
        │   └── fleet:researcher (L2)
        ├── overseer (L1)
        │   └── fleet:gemini_analyst (L2)
        └── hermes (L1)
            └── cline (L2)
        """
        r = A2ARouter()
        r.register_agent(Agent(id="vertex-orchestrator", name="Orchestrator",
                               agent_type="service", keywords=[], level=0))
        r.register_agent(Agent(id="dr-agent", name="DR Agent", agent_type="hub",
                               keywords=[], parent_id="vertex-orchestrator", level=1))
        r.register_agent(Agent(id="overseer", name="Overseer", agent_type="service",
                               keywords=[], parent_id="vertex-orchestrator", level=1))
        r.register_agent(Agent(id="hermes", name="Hermes", agent_type="external",
                               keywords=[], parent_id="vertex-orchestrator", level=1))
        r.register_agent(Agent(id="fleet:seed_finder", name="Seed Finder",
                               agent_type="fleet", keywords=[],
                               parent_id="dr-agent", level=2))
        r.register_agent(Agent(id="fleet:researcher", name="Researcher",
                               agent_type="fleet", keywords=[],
                               parent_id="dr-agent", level=2))
        r.register_agent(Agent(id="fleet:gemini_analyst", name="Gemini Analyst",
                               agent_type="fleet", keywords=[],
                               parent_id="overseer", level=2))
        r.register_agent(Agent(id="cline", name="Cline", agent_type="external",
                               keywords=[], parent_id="hermes", level=2))
        return r

    def test_get_children(self):
        r = self._build_test_hierarchy()
        children = r.get_children("dr-agent")
        ids = {c.id for c in children}
        assert ids == {"fleet:seed_finder", "fleet:researcher"}

    def test_get_descendants_recursive(self):
        r = self._build_test_hierarchy()
        descendants = r.get_descendants("vertex-orchestrator")
        ids = {d.id for d in descendants}
        assert ids == {"dr-agent", "overseer", "hermes", "fleet:seed_finder",
                       "fleet:researcher", "fleet:gemini_analyst", "cline"}

    def test_get_ancestors(self):
        r = self._build_test_hierarchy()
        ancestors = r.get_ancestors("fleet:seed_finder")
        ids = [a.id for a in ancestors]
        assert ids == ["dr-agent", "vertex-orchestrator"]

    def test_get_tree(self):
        r = self._build_test_hierarchy()
        tree = r.get_tree()
        assert tree["total_agents"] == 8
        assert len(tree["roots"]) == 1
        root = tree["roots"][0]
        assert root["id"] == "vertex-orchestrator"
        assert root["level"] == 0
        assert len(root["children"]) == 3  # dr-agent, overseer, hermes

    def test_delegate_parent_to_child(self):
        r = self._build_test_hierarchy()
        result = r.delegate("dr-agent", "fleet:seed_finder", "scan for seeds")
        assert result["success"] is True
        assert result["action"] == "delegate"
        assert result["type"] == "direct"
        assert result["agent_id"] == "fleet:seed_finder"

    def test_delegate_non_descendant_fails(self):
        r = self._build_test_hierarchy()
        # dr-agent cannot delegate to fleet:gemini_analyst (under overseer)
        result = r.delegate("dr-agent", "fleet:gemini_analyst", "do something")
        assert result["success"] is False
        assert "not a descendant" in result["error"]

    def test_report_child_to_parent(self):
        r = self._build_test_hierarchy()
        result = r.report("fleet:seed_finder", "found 3 seeds")
        assert result["success"] is True
        assert result["action"] == "report"
        assert result["parent_id"] == "dr-agent"
        assert result["type"] == "direct"
        assert result["agent_id"] == "dr-agent"

    def test_report_no_parent_fails(self):
        r = self._build_test_hierarchy()
        result = r.report("vertex-orchestrator", "status update")
        assert result["success"] is False
        assert "no parent" in result["error"]

    def test_escalate_skips_level(self):
        r = self._build_test_hierarchy()
        # cline (L2) → hermes (L1) → vertex-orchestrator (L0)
        # escalate from cline should go to vertex-orchestrator (skip hermes)
        result = r.escalate("cline", "need help from the top")
        assert result["success"] is True
        assert result["action"] == "escalate"
        assert result["escalated_to"] == "vertex-orchestrator"
        assert result["type"] == "direct"
        assert result["agent_id"] == "vertex-orchestrator"

    def test_escalate_no_grandparent_falls_back_to_report(self):
        r = self._build_test_hierarchy()
        # dr-agent (L1) → vertex-orchestrator (L0, no parent)
        # escalate from dr-agent should fall back to reporting to parent
        result = r.escalate("dr-agent", "need help")
        assert result["success"] is True
        assert result["action"] == "report"
        assert result["parent_id"] == "vertex-orchestrator"

    def test_broadcast_down(self):
        r = self._build_test_hierarchy()
        result = r.broadcast_down("dr-agent", "run full scan")
        assert result["success"] is True
        assert result["action"] == "broadcast_down"
        assert result["delivered_to"] == 2  # seed_finder + researcher

    def test_broadcast_down_from_supreme(self):
        r = self._build_test_hierarchy()
        result = r.broadcast_down("vertex-orchestrator", "system-wide alert")
        assert result["success"] is True
        assert result["delivered_to"] == 7  # all descendants

    def test_broadcast_up(self):
        r = self._build_test_hierarchy()
        result = r.broadcast_up("fleet:seed_finder", "status report")
        assert result["success"] is True
        assert result["action"] == "broadcast_up"
        assert result["delivered_to"] == 2  # dr-agent + vertex-orchestrator

    def test_broadcast_up_no_ancestors(self):
        r = self._build_test_hierarchy()
        result = r.broadcast_up("vertex-orchestrator", "test")
        assert result["success"] is True
        assert result["delivered_to"] == 0


class TestHierarchyAutoDetection:
    """Test auto-detection of hierarchy from `:` notation in agent IDs."""

    def test_colon_notation_detects_parent(self, tmp_path):
        state_file = tmp_path / "state.json"
        state_data = {
            "agents": {
                "dr-agent": {"status": "healthy"},
                "dr-agent:local-recovery": {"status": "running"},
                "dr-agent:cloud-failover": {"status": "standby"},
            }
        }
        state_file.write_text(json.dumps(state_data))

        r = A2ARouter()
        with patch("vertex_orchestrator.a2a_router.HUB_STATE_FILE", state_file):
            r.load_hub_agents()

        # Parent agent
        dr_agent = r.get_agent("dr-agent")
        assert dr_agent is not None
        assert dr_agent.level == 1
        assert dr_agent.parent_id is None or dr_agent.parent_id == "vertex-orchestrator"

        # Children should have parent_id="dr-agent" and level=2
        child1 = r.get_agent("dr-agent:local-recovery")
        assert child1 is not None
        assert child1.parent_id == "dr-agent"
        assert child1.level == 2

        child2 = r.get_agent("dr-agent:cloud-failover")
        assert child2 is not None
        assert child2.parent_id == "dr-agent"
        assert child2.level == 2

    def test_fleet_agent_parent_assignment(self, tmp_path):
        config_file = tmp_path / "agents.json"
        config_data = {
            "agents": {
                "seed_finder": {
                    "provider": "openrouter",
                    "model": "perplexity/sonar",
                    "purpose": "Find seed phrases.",
                    "script": "seed.py",
                },
                "gemini_analyst": {
                    "provider": "google",
                    "model": "gemini-pro",
                    "purpose": "Analyze Gemini output.",
                    "script": "analyst.py",
                },
                "aider_debug": {
                    "provider": "openrouter",
                    "model": "claude-sonnet",
                    "purpose": "Debug code with Aider.",
                    "script": "aider.py",
                },
            }
        }
        config_file.write_text(json.dumps(config_data))

        r = A2ARouter()
        with patch("vertex_orchestrator.a2a_router.FLEET_CONFIG_FILE", config_file):
            r.load_fleet_agents()

        # seed_finder → dr-agent (recovery specialist)
        sf = r.get_agent("fleet:seed_finder")
        assert sf is not None
        assert sf.parent_id == "dr-agent"
        assert sf.level == 2

        # gemini_analyst → overseer (analytics)
        ga = r.get_agent("fleet:gemini_analyst")
        assert ga is not None
        assert ga.parent_id == "overseer"
        assert ga.level == 2

        # aider_debug → hermes (code tool)
        ad = r.get_agent("fleet:aider_debug")
        assert ad is not None
        assert ad.parent_id == "hermes"
        assert ad.level == 2