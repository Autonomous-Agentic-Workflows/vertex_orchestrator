# vertex_orchestrator — Architecture

> **Visual topology**: See [`docs/conor-agent-topology.html`](docs/conor-agent-topology.html) for an interactive SVG diagram of the full agent stack (Hermes + OpenClaw + Vertex AI + AGY SDK + MCP, WSL2 host + GCP cloud).

## What it is

A Python backend exposing three agent frameworks over one REST API, now integrated with the crypto recovery operation and the recovery-overseer management dashboard.

## Recovery Overseer (managed sub-service)

The `recovery_overseer/` directory contains a TypeScript/React sub-project
that provides an MCP (Model Context Protocol) server, Google Workspace
integrations (Gmail, Slides, Tasks, Keep, Drive), and a Spark analytics
dashboard.  It runs as a **child service** under the Python orchestrator.

```
vertex_orchestrator (Python, port 8000)
  └── recovery-overseer (Node/Express, port 3000)
        ├── MCP JSON-RPC 2.0 server
        ├── Google Workspace tools (Gmail, Slides, Tasks, Keep, Drive)
        ├── Spark engine + AI optimization (Gemini)
        └── Cloud SQL / Firebase / Firestore
```

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| /overseer/status | GET | No | Check if recovery-overseer is running + health |
| /overseer/start | POST | Yes | Start the recovery-overseer Node.js service |
| /overseer/stop | POST | Yes | Stop the recovery-overseer service |
| /overseer/mcp | POST | Yes | Proxy MCP JSON-RPC 2.0 requests to recovery-overseer |
| /overseer/mcp/info | GET | No | Get MCP server info (tools, resources, prompts) |
| /overseer/proxy/* | POST | Yes | Generic proxy to any recovery-overseer API endpoint |

The `OverseerManager` (`src/vertex_orchestrator/overseer_manager.py`) handles
subprocess lifecycle (start/stop), health monitoring, and request proxying.
It auto-runs `npm install` on first start if `node_modules/` is missing.

| Task | Routed to | What it does |
|------|-----------|-------------|
| ANALYSIS | CrewAI | Structured analysis, auditing, recovery config validation |
| CONVERSATION | AutoGen | Multi-agent dialogue, passphrase generation (via litellm) |
| EDIT | Aider | Direct file editing on a target path (restricted to ConsolidatedDevelopment) |

All three talk to Google Vertex AI (gemini-2.5-pro / gemini-2.5-flash in us-central1), via `GOOGLE_CLOUD_PROJECT` env var and ADC credentials.

## HTTP server

- Binds to `0.0.0.0:8000` — all interfaces
- **Auth**: API key via `ORCHESTRATOR_API_KEY` env var. If set, POST endpoints require `Authorization: Bearer <key>`. If not set, runs open (local dev only).
- **File access**: `EDIT` task `file_path` restricted to `ConsolidatedDevelopment/` directory. Paths outside get 403.
- CORS: `Access-Control-Allow-Origin: *` (for Android app bridge)

### Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| /health | GET | No | Health check, lists providers + project |
| /providers | GET | No | List available agent frameworks + models |
| /execute | POST | Yes | Execute single task (ANALYSIS/CONVERSATION/EDIT) |
| /batch | POST | Yes | Execute multiple tasks in sequence |
| /recovery/status | POST | Yes | Full recovery report (config validation + log analysis) |
| /recovery/targets | GET | Yes | Parse ALL_TARGETS.txt — returns structured address list, coin summary, (seeds/WIFs/YPRV redacted by default; `?include_sensitive=true` for trusted local use) |
| /recovery/analyze-seeds | POST | Yes | AI analysis of seed derivation paths, suggests missed paths |
| /recovery/passphrases | POST | Yes | AI-generated passphrase variations |
| /recovery/analyze-log | POST | Yes | Parse scanner logs for patterns, hits, errors |

## Recovery Integration

The `recovery.py` module bridges Hermes with MasterRecovery3:

- **RecoveryIntegration** class at `src/vertex_orchestrator/recovery.py`
- Sanitizes all sensitive data (seeds, WIF keys, passphrases) before sending to AI
- Routes through CrewAI -> litellm -> Vertex AI (gemini-2.5-flash)
- AI validates recovery.json, analyzes seed paths, generates passphrase variants, parses scanner logs
- **Target list parser** (`load_targets()`) parses `recovery_data/ALL_TARGETS.txt` into structured JSON
  - 45 addresses across BTC (32), LTC (5), DOGE (2), PPC (4), SOL (2)
  - Seeds, WIF keys, and YPRV are **redacted by default** — use `?include_sensitive=true` only in trusted local contexts
  - The real `ALL_TARGETS.txt` is gitignored; a sanitized `ALL_TARGETS.example.txt` is committed as a template
- **BTCRecover code reviewer** at `recovery_overseer/btcrecover-reviewer/` — AI Studio React app that uses Gemini to review BTCRecover-Master Python code snippets for security, quality, and performance

### Recovery workspace documentation

The `docs/` directory contains reference documents from the OneDrive recovery workspace:

| Document | Description |
|----------|-------------|
| `conor-agent-topology.html` | Interactive SVG topology diagram of the full agent stack |
| `deep-research-report.md` | Gemini Deep Research: "Autonomous Agent Development Blueprint for a Windows Workflow on C Drive" |
| `workspace-organization-report.md` | MasterRecovery3 workspace organization report (42,528 files, 183 GiB, dedup passes) |
| `workspace-root-map.md` | Filesystem inventory map of MasterRecovery3 root buckets |
| `workspace-largest-files.csv` | Largest files in the MasterRecovery3 workspace |

### Key AI Findings (2026-08-13)

1. **Change addresses NOT scanned** — scanner only tried external chain (CHAIN_EXT). Fixed: now also scans CHAIN_INT (change addresses). Pushed to AAW/MasterRecovery3.
2. **Invalid seed words** — SEED_D "sumer"→"summer", SEED_P "Human"→"human"
3. **Electrum legacy paths** — m/0/i and m/1/i not tried
4. **BIP84 paths** — were scanned but only external chain
5. **Index depth** — should increase from 200 to 250+

## Security posture

| Risk | Status |
|------|--------|
| No auth on endpoints | **Fixed** — ORCHESTRATOR_API_KEY required |
| Arbitrary file_path on EDIT | **Fixed** — restricted to ConsolidatedDevelopment |
| CORS wide-open | Intentional — Android app needs cross-origin |
| Sensitive data to AI | **Mitigated** — recovery.py sanitizes seeds/keys before AI calls |

## Git multi-account wiring

| GitHub org | Name on commits | Role | Repos |
|------------|-----------------|------|-------|
| Autonomous-Agentic-Workflows | Conor Gold | Enterprise org (primary) | 34 active + 26 archived |
| conor-ops | Conor Gomes | Personal/work | 7 repos |
| yajlang | Conor Gold | Personal | 13 remaining unique repos |
| 3rdIteration | (external) | External fork | btcrecover |

Tokens: yajlang classic PAT (full scopes) + conor-ops fine-grained PAT. gh CLI both accounts registered.

## Recovery Operation Context

MasterRecovery2 (DESKTOP-7F4FEDJ, offline from this machine):
- ClawdBot/JARVIS orchestrator + OpenClaw gateway (Gemini 2.0 Flash, ws://127.0.0.1:18789)
- mega_scanner.py running SEED_B brute-force (750K passwords, BIP44/49/84)
- 6 recovery tracks (A-F) targeting ~$200K+ in BTC, LTC, DOGE, PPC
- Machines: PC + HP15 Ubuntu (192.168.4.32) + Homebook (192.168.1.3, unreachable)

MasterRecovery3 (cloned to ConsolidatedDevelopment, pushed to AAW):
- Autonomous recovery orchestration system
- mega_scanner.py patched with change address scanning (CHAIN_INT)
- RECOVERY_FINDINGS.md documents all AI-identified issues
- Uses bip_utils, bitcoinlib for address derivation
- Config at config/recovery.json (gitignored, sensitive)

MasterRecovery4 = GCP project master-recovery-hub-2026 (Vertex AI backend for all AI calls)

Autonomous-Agentic-Workflows = GitHub enterprise org holding all recovery + agent repos (57 total)

## Running the server

```powershell
cd C:\Users\jayla\OneDrive\ConsolidatedDevelopment\vertex_orchestrator
$env:ORCHESTRATOR_API_KEY="***"
.venv\Scripts\python.exe -m vertex_orchestrator.server
```

## Testing

```bash
.venv/Scripts/python.exe -m pytest tests/ -q
# 31 passed
```

All three providers confirmed live with Vertex AI:
- CrewAI: returns structured analysis (used by recovery endpoints)
- AutoGen: returns conversation responses via litellm
- Aider: edits files locally through Vertex AI