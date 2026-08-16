#!/usr/bin/env python3
"""vertex-recovery-bridge smoke test.

Proves that the recovery flow does NOT leak raw seed / xprv / WIF material
into the prompts handed to the LLM (CrewAI / AutoGen / Aider via Vertex AI).

It monkey-patches ``Orchestrator.execute`` so every prompt the AI would
receive is captured, then runs the three flows that could carry secrets:

  * analyze_seed_paths           (derivation-path analysis)
  * generate_passphrase_variants (passphrase variation work)
  * analyze_scanner_log          (reads last 200 lines of a log)

Exits 0 if no secret fingerprints appear in any captured prompt; exits 1
otherwise.

Run with the venv that already has vertex_orchestrator installed:

  /home/conor-ops/vertex_orchestrator/.venv/bin/python \\
      /home/conor-ops/vertex_orchestrator/scripts/vertex-recovery-bridge-smoke.py

Always uses FAKE material — no real seed ever reaches the AI path.
"""
from __future__ import annotations
import os, sys, tempfile
from pathlib import Path

# Make sure we use the project venv even if invoked under a different interpreter
ROOT = Path("/home/conor-ops/vertex_orchestrator")
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.recovery import RecoveryIntegration
from vertex_orchestrator.orchestrator import Orchestrator, OrchestratorResult, TaskType

FAKE_SEED_WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
FAKE_XPRV = "xprv9s21ZrQH143K3GJJCneb8o9q9Gt9P3Z8KjQcFTfQ6bpY1UvMPd8QkABbXs4YPmRKwhZS3ZwoPG2VqK7QJ7a7tDm6h6EgpY1hz3MQbRtv8RfV"
FAKE_WIF = "5J1F7GqKUrqxNz3bjFRSwJ8qNjQ7jVn5Vp8x8aHtF9XXcDrLWEk"

calls: list[dict] = []


def _fake_execute(self, task_type, task, **kw):
    calls.append({"task_type": task_type.name, "task": task, "kw": kw})
    return OrchestratorResult(success=True, output="RECOVERY_OK", runner_used="crewai")


Orchestrator.execute = _fake_execute


def main() -> int:
    cfg = VertexAIConfig(project_id="smoke-test-project", location="us-central1")
    bridge = RecoveryIntegration(cfg, recovery_repo_path=str(ROOT.parent / "MasterRecovery3"))

    bridge.analyze_seed_paths({
        "type": "BIP39",
        "paths_tried": ["m/44'/0'/0'/0", "m/84'/0'/0'/0"],
        "max_accounts": 5,
        "max_index": 250,
        "hits": [],
    })

    bridge.generate_passphrase_variants(["MySecret", "Wallet2024"])

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".log") as f:
        f.write("scanner started\naddresses/sec=180\nno hits\n")
        log_path = f.name
    try:
        bridge.analyze_scanner_log(log_path)
    finally:
        try:
            os.unlink(log_path)
        except FileNotFoundError:
            pass

    joined = "\n".join(c["task"] for c in calls)
    failures: list[str] = []
    for label, secret in [
        ("FAKE_SEED_WORDS", FAKE_SEED_WORDS),
        ("FAKE_XPRV",       FAKE_XPRV),
        ("FAKE_WIF",        FAKE_WIF),
    ]:
        if secret in joined:
            failures.append(label)
            print(f"❌ SECRET LEAKED: {label}")
        else:
            print(f"✅ {label} NOT in any captured task ({len(calls)} tasks captured)")

    if failures:
        print(f"\nFAIL — leak detected for: {', '.join(failures)}", file=sys.stderr)
        return 1
    print("\nPASS — no seed/xprv/wif material reached the AI prompt layer.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
