# vertex_orchestrator — Architecture

## What it is

A Python backend exposing three agent frameworks over one REST API:

| Task | Routed to | What it does |
|------|-----------|-------------|
| ANALYSIS | CrewAI | Structured analysis, auditing |
| CONVERSATION | AutoGen | Multi-agent dialogue (via litellm) |
| EDIT | Aider | Direct file editing on a target path |

All three talk to Google Vertex AI (gemini-2.5-pro / gemini-2.5-flash in us-central1), via `GOOGLE_CLOUD_PROJECT` env var and ADC credentials.

## HTTP server

- Binds to `0.0.0.0:8000` — all interfaces
- Endpoints: `GET /health`, `GET /providers`, `POST /execute`, `POST /batch`
- **Auth**: API key via `ORCHESTRATOR_API_KEY` env var. If set, POST endpoints require `Authorization: Bearer <key>`. If not set, runs open (local dev only).
- **File access**: `EDIT` task `file_path` is restricted to `ConsolidatedDevelopment/` directory. Override with `ORCHESTRATOR_ALLOWED_BASE` env var. Paths outside get 403.
- CORS: `Access-Control-Allow-Origin: *` (for Android app bridge)
- Caller can override `model` and `task_type` per request
- GCP credentials come from `gcloud auth application-default login`

## Security posture

| Risk | Status |
|------|--------|
| No auth on /execute and /batch | **Fixed** — ORCHESTRATOR_API_KEY required |
| Arbitrary file_path on EDIT | **Fixed** — restricted to ConsolidatedDevelopment |
| CORS wide-open | Intentional — Android app needs cross-origin |
| GCP project override in body | Accepted — project_id comes from env, not body |
| master-recovery-hub-2026 GCP project | Enterprise project, ADC-secured |
| Exposed GitHub PAT in MCP config | **Fixed** — rotated to new PAT, tokens via env vars |
| GDPR compliance | Documented — DPIA required for AI agent deployment |

## Git multi-account wiring

| GitHub org | Name on commits | Email | Role |
|------------|-----------------|-------|------|
| yajlang | Conor Gold | admin@208fenceandgate.com | Personal (primary) |
| conor-ops | Conor Gomes | admin@208fenceandgate.com | Personal/work |
| Autonomous-Agentic-Workflows | Conor Gold | admin@208fenceandgate.com | Enterprise org |
| 3rdIteration | (external) | — | External fork |

Note: 208DevOps org exists under the 208developeroperations enterprise but is inaccessible via API. All repos were migrated to Autonomous-Agentic-Workflows.

## Active repos (OneDrive\ConsolidatedDevelopment)

| Repo | Remote | Size | Status |
|------|--------|------|--------|
| vertex_orchestrator | conor-ops/fictional-invention | — | This backend (31 tests, all live) |
| hermes-agent-recovery-skills | AAW/hermes-agent-recovery-skills | 104.4 MB | 171 skills, MCP server, Docker |
| OmniDev | conor-ops/OmniDev | 1.6 MB | DevGate Android app (5 providers) |
| Numera2 | conor-ops/Numera2 | — | Firebase enterprise app |
| aider | AAW/aider-conor-fork | 75 MB | Fork of Aider-AI/aider (v0.86.3) |
| gk-cli-agents | conor-ops/gk-cli-agents | 7 MB | GitKraken CLI (MCP server, AI commits) |
| MasterRecovery3 | AAW/MasterRecovery3 | 1.18 GB | Autonomous recovery workflow |
| btcrecover | AAW/btcrecover | 42.9 MB | BTC password/seed recovery |
| local-recovery | AAW/local-recovery | — | Crypto recovery tools |
| MasterRecoveryAgents | AAW/MasterRecoveryAgents | 413 MB | Cloning in progress |

## Backup repos (JayLang085MR4\OneDrive\ConsolidatedDevelopment\FoundRepos)

| Repo | Remote | Status |
|------|--------|--------|
| MasterRecovery2 | NO REMOTE | 9.4 GB, canonical backup |
| MasterRecovery3 | conor-ops/MasterRecovery3 | 408.6 MB, canonical copy |
| MasterRecovery3_SSOT | 208DevOps/MasterRecovery3_SSOT | Enterprise SSOT |
| JARVIS | conor-ops/JARVIS | 109.6 MB |
| FlowState-Finance | conor-ops/FlowState-Finance | |
| numera | conor-ops/numera | |
| BizBalance | NO REMOTE | Needs remote |
| agents-cli | AAW/agents-cli | |
| mindsdb | AAW/mindsdb | 210.1 MB |
| GenAIMindMapFlowBuilder | AAW/GenAIMindMapFlowBuilder | |
| antigravity-sdk-python | AAW/antigravity-sdk-python | |
| autonomous-recovery | AAW/autonomous-recovery | |
| trezor-firmware | NO REMOTE | |
| rtl8812au/8821au/88x2bu | aircack-ng/lwfinger/cilynx | WiFi drivers, duplicates archived to M: |

## Agent Hub (C:\Users\jayla\agent-hub\)

Unified configuration and orchestration layer connecting all components:

```
agent-hub/
  configs/
    agent-hub.json              # GCloud project (master-recovery-hub-2026)
    mcp-config.json             # 17 MCP servers, tokens via env vars
    .env.template               # All API keys documented
    github-integration.json     # 37 repos mapped across 3 orgs
    gdpr-compliance-reference.md # 8.3KB GDPR research (Articles 5-39, 83)
    sentinel-dr/
      sentinel-dr.service       # Systemd service unit
      sentinel-dr.timer         # 60s watchdog timer
      install-sentinel-dr.sh    # Deployment script
  scripts/
    setup-env.ps1               # Environment setup (gcloud, env vars, APIs)
    orchestrator.py             # Unified Python orchestrator (CrewAI+AutoGen+Aider)
    move-duplicate-repos.bat    # Manual repo dedup script
  skills/                       # Ready for skill linking
```

## Hermes Agent Platform

- **CLI**: `C:\Users\jayla\AppData\Local\hermes\hermes-agent\bin\hermes.exe`
- **Repo**: `ConsolidatedDevelopment\hermes-agent-recovery-skills` (104.4 MB, 4912 files)
- **171 skills** linked to:
  - Ollama: `~\.ollama\skills\` (172 total with skill-creator)
  - Claude: `~\.claude\skills\` (171)
  - Gemini: `~\.gemini\skills\` (171)
- **Skill categories**: creative(25), mlops(25), research(17), productivity(15), 
  software-development(12), autonomous-ai-agents(9), finance(8), devops(7), 
  github(6), security(4), blockchain(3), + 19 more
- **MCP server**: `mcp_serve.py` in hermes repo
- **Optional MCPs**: linear, n8n

## Google Cloud integration

| Component | Value |
|-----------|-------|
| Project ID | master-recovery-hub-2026 |
| Project name | MasterRecovery4 |
| Region | us-central1 |
| Auth | ADC (gcloud auth application-default login) |
| APIs enabled | aiplatform, cloudbuild, secretmanager, iam |
| MySQL instance | 8.4 (free trial, creating) |
| Other projects | gen-lang-client-0770467301 (Autonomous-Agents), gen-lang-client-0999709111 (Fence Estimate Tool) |

## MCP servers

17 MCP servers configured in `agent-hub/configs/mcp-config.json`:
- GitHub MCP Server (Docker, token via env var)
- GitKraken CLI MCP (gk mcp serve)
- Google Cloud: BigQuery, Cloud SQL, Spanner, GKE, Cloud Run, Vertex AI Search
- Google Drive, Filesystem, HuggingFace, Sequential Thinking
- Linear, Antimetal, Google Home Developer

## DevTools installed

| Tool | Version | Path |
|------|---------|------|
| Python (system) | 3.14.6 | C:\Python314\ |
| Python (venv) | 3.11.15 | vertex_orchestrator\.venv\ |
| Node.js | 24.18.1 | C:\Program Files\nodejs\ |
| Docker | 29.6.2 | C:\Program Files\Docker\ |
| Git | 2.55.0 | C:\Program Files\Git\ |
| gcloud SDK | 580.0.0 | AppData\Local\Google\Cloud SDK\ |
| Hermes CLI | installed | AppData\Local\hermes\hermes-agent\bin\ |
| Aider | 0.86.3 | AppData\Roaming\Python\Python314\Scripts\ |
| Antigravity IDE | installed | AppData\Local\Programs\Antigravity IDE\ |
| Ollama | installed | glm-5.2:cloud (Hermes integration) |

## Running the server

```powershell
cd C:\Users\jayla\OneDrive\ConsolidatedDevelopment\vertex_orchestrator
$env:ORCHESTRATOR_API_KEY="***"
.venv\Scripts\python.exe -m vertex_orchestrator.server
```

Output:
```
Vertex Orchestrator backend running on http://0.0.0.0:8000
  Project: master-recovery-hub-2026
  Auth: ENABLED (ORCHESTRATOR_API_KEY set)
  File access: restricted to <ConsolidatedDevelopment>
  Endpoints: /health, /execute, /batch, /providers
```

## Testing

```bash
.venv/Scripts/python.exe -m pytest tests/ -q
# 31 passed
```

All three providers confirmed live with Vertex AI:
- CrewAI: returns structured analysis responses
- AutoGen: returns conversation responses via litellm
- Aider: edits files locally through Vertex AI

## Sentinel-DR (Disaster Recovery)

Systemd service + watchdog timer for autonomous DR scanning:
- Service: `sentinel-dr.service` (oneshot, CPU-limited, sandboxed)
- Timer: `sentinel-dr.timer` (60s heartbeat, persistent)
- Configs: `agent-hub/configs/sentinel-dr/`
- Deploy: `install-sentinel-dr.sh` on recovery hosts

## Repo dedup status

- 26 duplicate repos moved to `M:\RepoBackups\` (Storage Space)
- 6 remaining in FoundRepos (script written: `move-duplicate-repos.bat`)
- ~100+ GB in duplicate VHDX/ZIP files identified across drives
- Consolidation target: D: (952GB NVMe SSD) or M: (10TB Storage Space)

## Deleted repos (GitHub)

| Repo | Status | Notes |
|------|--------|-------|
| conor-ops/fclones | Restorable | File dedup tool |
| conor-ops/testdisk | Restorable | Disk recovery |
| conor-ops/advanced-wallets | Restorable | Crypto wallets |
| conor-ops/GenAIMindMapFlowBuilder | Skip | Exists in AAW |
| conor-ops/MasterRecoveryAgentsTransfer | Skip | AAW has MasterRecoveryAgents |
| conor-ops/MemGPT | Contact support | Can't restore |