"""A2A routing harness — unified agent-to-agent message bus.

Connects the Agent Hub (10 monitor agents), MasterRecoveryAgents fleet,
vertex_orchestrator managed services (recovery-overseer, culina-ai),
and external agents (Hermes, OpenClaw, Cline) via a keyword-routed
message bus.

Architecture:

    ┌──────────────────────────────────────────────────────────────┐
    │  A2A Router (in-process, port 8000)                          │
    │                                                              │
    │  Agent Registry ──► Keyword Index ──► Route Table            │
    │       │                  │                  │                │
    │  ┌────┴────┐     ┌───────┴───────┐  ┌──────┴──────┐          │
    │  │ Hub     │     │ "recovery"    │  │ dr-agent    │          │
    │  │ Agents  │     │ "compliance"  │  │ hermes      │          │
    │  │ (10)    │     │ "backup"      │  │ overseer    │          │
    │  │         │     │ "scan"        │  │ culina      │          │
    │  │ Fleet   │     │ "deploy"      │  │ openclaw    │          │
    │  │ (15+)   │     │ "cleanup"     │  │ cline       │          │
    │  └─────────┘     └───────────────┘  └─────────────┘          │
    │                                                              │
    │  Endpoints: /a2a/agents, /a2a/route, /a2a/send, /a2a/broadcast│
    └──────────────────────────────────────────────────────────────┘
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

# Agent hub state file (shared with agent-hub-monitor.py)
HUB_STATE_FILE = Path(
    os.environ.get("AGENT_HUB_STATE", "/home/conor-ops/.agent-hub-state.json")
)

# MasterRecoveryAgents fleet config
FLEET_CONFIG_FILE = Path(
    os.environ.get("FLEET_CONFIG", "/home/conor-ops/MasterRecoveryAgents/config/agents.json")
)


@dataclass
class Agent:
    """A registered A2A agent."""

    id: str
    name: str
    agent_type: str  # "hub", "fleet", "service", "external"
    status: str = "unknown"  # healthy, degraded, down, unknown
    keywords: list[str] = field(default_factory=list)
    endpoint: Optional[str] = None  # URL for HTTP-based agents
    capabilities: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def matches(self, keyword: str) -> bool:
        """Check if this agent handles a keyword (case-insensitive)."""
        kw = keyword.lower()
        return any(kw == k.lower() or kw in k.lower() for k in self.keywords)


@dataclass
class A2AMessage:
    """An inter-agent message envelope."""

    sender: str
    recipient: str  # agent id or "*"
    content: str
    msg_type: str = "request"  # request, response, event, broadcast
    keywords: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = f"a2a-{int(self.timestamp * 1000)}-{self.sender}"


class A2ARouter:
    """In-process A2A message router with keyword-based dispatch."""

    def __init__(self) -> None:
        self._agents: dict[str, Agent] = {}
        self._lock = threading.RLock()
        self._message_log: list[dict] = []
        self._max_log = 500
        self._webhook_fire: Optional[Any] = None  # set by server for webhook integration

    # --- agent registry --------------------------------------------------

    def register_agent(self, agent: Agent) -> dict[str, Any]:
        """Register or update an agent in the registry."""
        with self._lock:
            self._agents[agent.id] = agent
        logger.info("A2A agent registered: %s (%s)", agent.id, agent.agent_type)
        return {"status": "registered", "agent_id": agent.id}

    def unregister_agent(self, agent_id: str) -> dict[str, Any]:
        """Remove an agent from the registry."""
        with self._lock:
            removed = self._agents.pop(agent_id, None)
        if removed:
            logger.info("A2A agent unregistered: %s", agent_id)
            return {"status": "unregistered", "agent_id": agent_id}
        return {"status": "not_found", "agent_id": agent_id}

    def get_agent(self, agent_id: str) -> Optional[Agent]:
        with self._lock:
            return self._agents.get(agent_id)

    def list_agents(self) -> list[dict[str, Any]]:
        with self._lock:
            return [asdict(a) for a in self._agents.values()]

    # --- keyword routing -------------------------------------------------

    def route_by_keyword(self, keyword: str) -> list[Agent]:
        """Find all agents that match a keyword."""
        with self._lock:
            return [a for a in self._agents.values() if a.matches(keyword)]

    def route_message(self, message: A2AMessage) -> dict[str, Any]:
        """Route a message to the appropriate agent(s).

        If recipient is "*", broadcast to all agents matching keywords.
        If recipient is a specific agent id, deliver directly.
        """
        with self._lock:
            # Log the message
            entry = asdict(message)
            self._message_log.append(entry)
            if len(self._message_log) > self._max_log:
                self._message_log = self._message_log[-self._max_log :]

        if message.recipient == "*":
            # Broadcast: route by keywords
            targets: list[Agent] = []
            if message.keywords:
                matched_ids: set[str] = set()
                for kw in message.keywords:
                    for agent in self.route_by_keyword(kw):
                        if agent.id != message.sender and agent.id not in matched_ids:
                            targets.append(agent)
                            matched_ids.add(agent.id)
            else:
                # No keywords → broadcast to all
                with self._lock:
                    targets = [
                        a for a in self._agents.values() if a.id != message.sender
                    ]

            results = []
            for target in targets:
                result = self._deliver(target, message)
                results.append({"agent_id": target.id, "result": result})

            response = {
                "message_id": message.id,
                "type": "broadcast",
                "delivered_to": len(results),
                "results": results,
            }
        else:
            # Direct delivery
            target = self.get_agent(message.recipient)
            if not target:
                response = {
                    "message_id": message.id,
                    "type": "direct",
                    "error": f"agent not found: {message.recipient}",
                }
            else:
                result = self._deliver(target, message)
                response = {
                    "message_id": message.id,
                    "type": "direct",
                    "delivered_to": 1,
                    "agent_id": target.id,
                    "result": result,
                }

        # Fire webhook if configured
        if self._webhook_fire:
            try:
                self._webhook_fire("a2a.message", response)
            except Exception as exc:
                logger.warning("webhook fire failed: %s", exc)

        return response

    def _deliver(self, agent: Agent, message: A2AMessage) -> dict[str, Any]:
        """Deliver a message to an agent via HTTP or in-process."""
        if agent.endpoint:
            try:
                payload = json.dumps(asdict(message)).encode("utf-8")
                req = Request(
                    agent.endpoint,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                )
                with urlopen(req, timeout=30) as resp:
                    body = resp.read().decode()
                    try:
                        return {"status": "delivered", "response": json.loads(body)}
                    except json.JSONDecodeError:
                        return {"status": "delivered", "response": body}
            except (URLError, HTTPError, TimeoutError, OSError) as exc:
                return {"status": "failed", "error": str(exc)}
        else:
            # In-process agent — log for pickup
            return {
                "status": "queued",
                "agent_id": agent.id,
                "message": "in-process agent — no HTTP endpoint",
            }

    # --- message log -----------------------------------------------------

    def get_message_log(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return list(reversed(self._message_log[-limit:]))

    # --- fleet loading ---------------------------------------------------

    def load_hub_agents(self) -> int:
        """Load agents from the agent-hub-state.json file."""
        if not HUB_STATE_FILE.exists():
            logger.warning("hub state file not found: %s", HUB_STATE_FILE)
            return 0

        count = 0
        try:
            data = json.loads(HUB_STATE_FILE.read_text())
            for agent_id, agent_data in data.get("agents", {}).items():
                status = agent_data.get("status", "unknown")
                keywords = self._infer_keywords(agent_id)
                agent = Agent(
                    id=agent_id,
                    name=agent_id.replace("-", " ").title(),
                    agent_type="hub",
                    status=status,
                    keywords=keywords,
                )
                self.register_agent(agent)
                count += 1
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("failed to load hub agents: %s", exc)

        return count

    def load_fleet_agents(self) -> int:
        """Load agents from the MasterRecoveryAgents config."""
        if not FLEET_CONFIG_FILE.exists():
            logger.warning("fleet config not found: %s", FLEET_CONFIG_FILE)
            return 0

        count = 0
        try:
            data = json.loads(FLEET_CONFIG_FILE.read_text())
            for agent_id, agent_data in data.get("agents", {}).items():
                purpose = agent_data.get("purpose", "")
                model = agent_data.get("model", "")
                keywords = self._extract_keywords_from_purpose(purpose, agent_id)
                agent = Agent(
                    id=f"fleet:{agent_id}",
                    name=agent_id.replace("_", " ").title(),
                    agent_type="fleet",
                    status="standby",
                    keywords=keywords,
                    capabilities=[model] if model else [],
                    metadata={"script": agent_data.get("script", ""),
                              "provider": agent_data.get("provider", "")},
                )
                self.register_agent(agent)
                count += 1
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("failed to load fleet agents: %s", exc)

        return count

    def register_service_agents(self) -> int:
        """Register managed service agents (overseer, culina, etc.)."""
        services = [
            Agent(
                id="overseer",
                name="Recovery Overseer (Spark Studio)",
                agent_type="service",
                keywords=["analytics", "spark", "workspace", "drive", "slides",
                          "gmail", "keep", "mcp", "notebook", "pipeline",
                          "data-explorer", "dag", "cluster"],
                endpoint="http://localhost:3000/api/mcp",
                capabilities=["mcp-jsonrpc", "google-workspace", "spark-engine"],
            ),
            Agent(
                id="culina",
                name="Culina AI Studio Orchestrator",
                agent_type="service",
                keywords=["culina", "cooking", "recipe", "enterprise", "legacy",
                          "recovery-jobs", "keep-notes", "workspace", "live-api",
                          "veo", "video", "websocket"],
                endpoint="http://localhost:3001/api",
                capabilities=["gemini-ai", "websocket", "firebase", "postgresql",
                              "google-workspace", "veo-video"],
            ),
            Agent(
                id="vertex-orchestrator",
                name="Vertex Orchestrator",
                agent_type="service",
                keywords=["orchestrate", "execute", "batch", "fallback",
                          "webhook", "a2a", "deploy", "monitor"],
                endpoint="http://localhost:8000",
                capabilities=["rest-api", "mcp-server", "webhook-pubsub",
                              "a2a-routing", "fallback-chain"],
            ),
            Agent(
                id="openclaw",
                name="OpenClaw Gateway",
                agent_type="external",
                keywords=["telegram", "gateway", "bot", "message", "notify"],
                endpoint="http://localhost:18789",
                capabilities=["telegram-bot", "websocket"],
            ),
            Agent(
                id="hermes",
                name="Hermes Agent",
                agent_type="external",
                keywords=["hermes", "acp", "tool-calling", "reasoning",
                          "compression", "context"],
                capabilities=["acp-protocol", "tool-calling", "context-compression"],
            ),
            Agent(
                id="ollama-router",
                name="Ollama Model Router",
                agent_type="external",
                keywords=["ollama", "model", "inference", "gemma", "glm",
                          "kimi", "fallback", "llm"],
                endpoint="http://127.0.0.1:11434",
                capabilities=["llm-inference", "model-routing"],
            ),
            Agent(
                id="cline",
                name="Cline CLI",
                agent_type="external",
                keywords=["cline", "code", "edit", "refactor", "build",
                          "test", "typescript"],
                capabilities=["code-editing", "plan-mode", "thinking"],
            ),
        ]
        count = 0
        for svc in services:
            self.register_agent(svc)
            count += 1
        return count

    # --- keyword inference helpers ---------------------------------------

    @staticmethod
    def _infer_keywords(agent_id: str) -> list[str]:
        """Infer routing keywords from an agent id."""
        kw_map = {
            "dr-agent": ["dr", "disaster-recovery", "cloud-run", "health",
                         "alert", "monitor", "security"],
            "compliance-legal": ["compliance", "legal", "audit", "gdpr",
                                 "policy", "regulation"],
            "gdpr-compliance": ["gdpr", "privacy", "data-protection", "consent"],
            "drive-layout": ["drive", "layout", "filesystem", "organization"],
            "vertex-orchestration": ["orchestrate", "execute", "batch"],
            "git-profiles": ["git", "profile", "commit", "repo", "github"],
            "backup": ["backup", "restore", "snapshot", "archive"],
            "hermes": ["hermes", "acp", "reasoning", "tool-calling"],
            "openclaw": ["openclaw", "telegram", "gateway", "bot"],
            "ollama-router": ["ollama", "model", "inference", "llm"],
        }
        return kw_map.get(agent_id, [agent_id.replace("-", " ")])

    @staticmethod
    def _extract_keywords_from_purpose(purpose: str, agent_id: str) -> list[str]:
        """Extract routing keywords from an agent's purpose description."""
        keywords = [agent_id.replace("_", " ")]
        # Add the purpose words as keywords
        stop_words = {"a", "an", "the", "for", "and", "of", "to", "in", "with",
                       "is", "are", "using", "based", "on", "via"}
        words = [w.lower().strip(".,;:") for w in purpose.split()]
        keywords.extend(w for w in words if len(w) > 3 and w not in stop_words)
        return keywords[:15]  # cap at 15 keywords


# Module-level singleton
_router: Optional[A2ARouter] = None


def get_router() -> A2ARouter:
    """Return the shared A2ARouter singleton, auto-loading all agents."""
    global _router
    if _router is None:
        _router = A2ARouter()
        _router.load_hub_agents()
        _router.load_fleet_agents()
        _router.register_service_agents()
        logger.info(
            "A2A router initialized with %d agents", len(_router.list_agents())
        )
    return _router