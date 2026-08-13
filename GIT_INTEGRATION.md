# Git Multi-Account Integration

## Accounts

| Account | Org | Name | Email | Use |
|--------|-----|------|-------|-----|
| 1 | yajlang | Conor Gold | admin@208fenceandgate.com | Personal (primary) |
| 2 | conor-ops | Conor Gomes | admin@208fenceandgate.com | Personal/work |
| 3 | 208DevOps | Conor Gold | admin@208fenceandgate.com | Enterprise |
| 4 | Autonomous-Agentic-Workflows | Conor Gold | admin@208fenceandgate.com | Shared org |
| 5 | 3rdIteration | (external) | — | External fork |

## Active Repos (ConsolidatedDevelopment)

| Repo | Org | Remote | Status |
|------|-----|--------|--------|
| OmniDev | yajlang | github.com/yajlang/OmniDev | Pushed, CI active |
| vertex_orchestrator | yajlang | github.com/yajlang/fictional-invention | Pushed, 31 tests, all providers live |
| Numera2 | conor-ops | github.com/conor-ops/Numera2 | Configured, needs push from PowerShell |

## Backup Repos (FoundRepos)

| Repo | Org | Remote | Notes |
|------|-----|--------|-------|
| MasterRecovery3 | conor-ops | github.com/conor-ops/MasterRecovery3 | Canonical copy |
| MasterRecovery3_SSOT | 208DevOps | github.com/208DevOps/MasterRecovery3_SSOT | Enterprise SSOT |
| MasterRecovery2 | (none) | — | 9.4GB, no remote |
| JARVIS | conor-ops | github.com/conor-ops/JARVIS | |
| FlowState-Finance | conor-ops | github.com/conor-ops/FlowState-Finance | |
| numera | conor-ops | github.com/conor-ops/numera | |
| BizBalance | (none) | — | Needs remote |
| agents-cli | Autonomous-Agentic-Workflows | — | |
| aider | Autonomous-Agentic-Workflows | — | |
| mindsdb | Autonomous-Agentic-Workflows | — | |
| local-recovery | Autonomous-Agentic-Workflows | — | |
| btcrecover | 3rdIteration | — | External fork |

## Credential Setup

Git Credential Manager is installed and has a stored token for yajlang.
The token appears to have cross-org access (pushes to conor-ops work from PowerShell).

For repos that fail to push from the agent (non-interactive), run from PowerShell:
```
cd <repo-dir>
git push -u origin main
```

## Per-Repo User Config

Already applied to active repos:
- OmniDev: Conor Gold (yajlang)
- vertex_orchestrator: Conor Gold (yajlang)
- Numera2: Conor Gomes (conor-ops)

For backup repos, apply with:
```
cd <repo-dir>
git config user.name "Conor Gold"      # or "Conor Gomes" for conor-ops
git config user.email "admin@208fenceandgate.com"
```

## Scripts

- `git-integration-setup.py` — Scan and apply per-repo user config
- `consolidation_audit.py` — Audit file organization and repo health
- `consolidation_report.json` — Last audit results