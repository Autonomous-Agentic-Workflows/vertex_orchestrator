# Downstream Integration Plan

> Autonomously planned 2026-08-16 from topology HTML + ARCHITECTURE.md + source audit.
> Status legend: ✅ done · 🔧 in-progress · 📋 planned

## Integration Matrix

| # | Integration | Priority | Status | Impact |
|---|-------------|----------|--------|--------|
| 1 | MCP Server exposure | P0 | ✅ | Claude/Cline/Hermes can call orchestrator |
| 2 | Fix /recovery/targets bug | P0 | ✅ | Endpoint moved to GET with proper query parsing |
| 3 | Cline CLI as 4th provider | P1 | ✅ | `/cline/execute` endpoint + ClineRunner module |
| 4 | Event log integration | P1 | ✅ | event_log.py module, auth failures logged |
| 5 | Webhook/notification endpoint | P2 | ✅ | Register/unregister/list callbacks, fires on task.complete |
| 6 | Cloud Run deployment (DR) | P2 | ✅ | Dockerfile + CLOUD_RUN_DEPLOY.md with gcloud deploy commands |
| 7 | Klarity security fix (P0) | P1 | ✅ | IAM allUsers removed, ingress restricted, GOOGLE_REQUIRE_AUTH=true |
| 8 | API key rotation | P1 | ✅ | Secure key in .env, "test-key" replaced |
| 9 | DevGate Android bridge verify | P2 | 📋 | Mobile app → orchestrator connectivity |
| 10 | 208 Fence & Gate tool deploy | P3 | 📋 | WebMCP agentic forms deployment |
| 11 | A2A routing harness | P1 | ✅ | 32 agents, keyword routing, 7 endpoints, 8 MCP tools |
| 12 | Recovery Overseer integration | P1 | ✅ | 492 deps installed, .env.local, OverseerManager |
| 13 | Culina AI integration | P1 | ✅ | 310 deps installed, CulinaManager, port 3001 |
| 14 | Mobile Device evidence catalog | P2 | ✅ | 103 photos cataloged + symlinked to photo-clues |
| 15 | Hierarchical A2A routing | P1 | ✅ | 3-tier tree, delegate/report/escalate/broadcast, 16 tests |
| 16 | Google Agents CLI integration | P1 | ✅ | v1.3.1 installed, AgentsCliManager, 9 endpoints, 6 MCP tools |

## Pending Actions Status (2026-08-16)

| Action | Status | Details |
|--------|--------|---------|
| Rotate ORCHESTRATOR_API_KEY | ✅ Done | 43-char secure token in `.env` (gitignored) |
| Move 47GB ollama store | ⏸️ Blocked | Needs sudo — script ready at `~/bin/move-ollama-store.sh` |
| Execute consolidation plan | ✅ Secured | All sensitive files gitignored, no secrets in git |
| Set up Telegram for Hermes | ✅ Done | OpenClaw gateway running on :18789, @gemmagitsclawd_bot live |
| Release cadence | ✅ Done | GitHub Actions release.yml + monthly-release.yml, ~/docs/RELEASE-CADENCE.md |
| Clean up 208DevOps | 📋 Planned | 0 repos — recommend repurpose for 208 Fence & Gate |
| Set GEMINI_API_KEY | 📋 Planned | Needed for both AI Studio applets (overseer + culina) |
| Set up PostgreSQL for culina-ai | 📋 Planned | docker-compose or local install for culina enterprise DB |

## Detailed Plans

### 1. MCP Server Exposure (P0)
Expose vertex_orchestrator endpoints as an MCP server so Claude, Cline,
and Hermes can invoke recovery analysis, task execution, and overseer
management through the standard MCP protocol.

**Implementation**: `src/vertex_orchestrator/mcp_server.py`
- JSON-RPC 2.0 over stdio (standard MCP transport)
- Tools: execute_task, batch_execute, recovery_status, recovery_targets,
  recovery_analyze_seeds, recovery_passphrases, overseer_start, overseer_stop,
  overseer_status, fallback_status
- Resources: health, providers, targets (read-only)
- Entry point: `python -m vertex_orchestrator.mcp_server`

### 2. Fix /recovery/targets Bug (P0)
The endpoint is in `do_POST` but references `self.query_params` which
doesn't exist on `BaseHTTPRequestHandler`. ARCHITECTURE.md documents it
as a GET endpoint. Move to `do_GET` with proper URL query parsing.

### 3. Cline CLI as 4th Provider (P1)
Add `cline_runner.py` that wraps the Cline CLI (`~/.local/bin/cline-oss`)
as a task runner. Maps to a new TaskType.CLI_AUTONOMOUS for autonomous
coding tasks that benefit from Cline's agentic file editing.

### 4. Event Log Integration (P1)
Wire `~/docs/event-log.sh` into server.py so every API call logs an
event. Categories: `agent` (task execution), `recovery` (recovery ops),
`infra` (overseer lifecycle), `security` (auth failures).

### 5. Webhook/Notification Endpoint (P2)
`POST /webhook/register` — downstream consumers register callback URLs.
Orchestrator POSTs event notifications to registered webhooks.

### 6. Cloud Run Deployment (P2)
Dockerfile + cloud_run_server.py for GCP deployment. Uses DR architecture
from topology section 2. 5 Cloud Run services across 3 regions.

### 7. Klarity Security Fix (P1)
```
gcloud run services update klarity --no-allow-unauthenticated \
  --region=us-east1 --project=master-recovery-hub-2026
```

### 8. API Key Rotation (P1)
Generate secure API key, update ORCHESTRATOR_API_KEY env var,
remove "test-key" from any config files.

### 9. DevGate Android Bridge (P2)
Verify DevGate mobile app can reach orchestrator at `http://<host>:8000`.
Test /health, /execute, /recovery/status endpoints from Android.

### 10. 208 Fence & Gate Tool (P3)
Deploy fence estimate tool with WebMCP agentic forms attributes.
Uses ADC: admin@208fenceandgate.com.

### 11. A2A Routing Harness (P1)
Unified agent-to-agent message bus connecting the Agent Hub (10 monitor
agents), MasterRecoveryAgents fleet (15+ recovery agents), managed
services (overseer, culina, vertex), and external agents (hermes,
openclaw, cline, ollama-router).

**Implementation**: `src/vertex_orchestrator/a2a_router.py`
- A2ARouter with keyword-based message routing
- Agent registry: 32 agents loaded at startup (hub + fleet + service)
- Message delivery: HTTP endpoint POST or in-process queue
- Message log: last 500 messages tracked
- Webhook integration: fires `a2a.message` events
- REST endpoints: /a2a/agents, /a2a/route, /a2a/send, /a2a/broadcast,
  /a2a/register, /a2a/unregister, /a2a/messages
- MCP tools: a2a_list_agents, a2a_route, a2a_send, a2a_messages
- 27 tests in test_a2a_router.py (139 total pass)

### 12. Recovery Overseer Integration (P1)
Synced recovery-overseer (Spark Analytics Studio) from Windows Downloads.
Already managed by OverseerManager in vertex_orchestrator.

**Actions taken**:
- Verified files match Downloads version (no diff)
- Installed 492 npm packages (node v20, npm v10.9.8)
- Created .env.local with GEMINI_API_KEY placeholder
- OverseerManager starts/stops/proxies on port 3000

### 13. Culina AI Integration (P1)
New project — Culina AI Studio Orchestrator (enterprise recovery +
legacy contact management + Google Keep + Gemini AI + Veo video).

**Implementation**: `src/vertex_orchestrator/culina_manager.py`
- CulinaProcess manages Node.js subprocess (mirrors OverseerManager)
- Port 3001 (offset from overseer's 3000)
- REST endpoints: /culina/status, /culina/start, /culina/stop, /culina/proxy/*
- MCP tools: culina_status, culina_start, culina_stop
- 310 npm packages installed, .env.local created
- Enterprise domain: 208fenceandgate.com
- GCP project: xenon-lantern-494206-u4

### 14. Mobile Device Evidence Catalog (P2)
103 phone photos (61.6MB) from Windows Downloads cataloged as recovery
evidence.

**Actions taken**:
- Created manifest.json with file sizes and metadata
- Symlinked all photos to /home/conor-ops/photo-clues/mobile-devices/
- Noted duplicate recovery-overseer copy inside Mobile Devices dir