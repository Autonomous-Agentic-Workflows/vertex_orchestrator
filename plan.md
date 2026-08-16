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

## Pending Actions Status (2026-08-16)

| Action | Status | Details |
|--------|--------|---------|
| Rotate ORCHESTRATOR_API_KEY | ✅ Done | 43-char secure token in `.env` (gitignored) |
| Move 47GB ollama store | ⏸️ Blocked | Needs sudo — script ready at `~/bin/move-ollama-store.sh` |
| Execute consolidation plan | ✅ Secured | All sensitive files gitignored, no secrets in git |
| Set up Telegram for Hermes | ✅ Done | OpenClaw gateway running on :18789, @gemmagitsclawd_bot live |
| Release cadence | ✅ Done | GitHub Actions release.yml + monthly-release.yml, ~/docs/RELEASE-CADENCE.md |
| Clean up 208DevOps | 📋 Planned | 0 repos — recommend repurpose for 208 Fence & Gate |

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