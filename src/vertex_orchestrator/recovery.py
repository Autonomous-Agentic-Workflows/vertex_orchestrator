"""Recovery integration — bridges vertex_orchestrator with MasterRecovery3.

Provides AI-powered recovery analysis tasks that route through the Hermes
backend (CrewAI/AutoGen/Aider via Vertex AI) to assist the crypto wallet
recovery operation.

Task types:
  - SEED_ANALYSIS: Analyze seed derivation paths for missed addresses
  - PASSPHRASE_GENERATION: Generate passphrase variations using AI
  - LOG_ANALYSIS: Parse scanner logs for patterns and missed hits
  - CODE_REVIEW: Review recovery scripts for bugs/improvements
  - CONFIG_VALIDATION: Validate recovery.json structure and data
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional
from pathlib import Path

from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import Orchestrator, TaskType


class RecoveryIntegration:
    """Bridges the Hermes backend with the MasterRecovery3 recovery system.

    Uses Vertex AI (via CrewAI/AutoGen/Aider) to provide AI-assisted
    recovery analysis, passphrase generation, and code review.
    """

    def __init__(
        self,
        config: VertexAIConfig,
        recovery_repo_path: str,
        backend_url: str = "http://localhost:8000",
    ) -> None:
        self.config = config
        self.orchestrator = Orchestrator(config=config)
        self.recovery_repo = Path(recovery_repo_path)
        self.backend_url = backend_url

    def analyze_seed_paths(self, seed_info: dict) -> dict:
        """Use CrewAI to analyze seed derivation paths for missed addresses.

        Asks the AI to review BIP44/49/84 derivation paths and suggest
        alternative paths or account/index ranges that might contain funds.
        """
        prompt = f"""You are a cryptocurrency recovery expert. Analyze this seed information
        and suggest derivation paths that might have been missed:

        Seed type: {seed_info.get('type', 'unknown')}
        BIP paths tried: {seed_info.get('paths_tried', [])}
        Accounts scanned: {seed_info.get('max_accounts', 5)}
        Indices per account: {seed_info.get('max_index', 100)}
        Known hits: {seed_info.get('hits', [])}

        Suggest:
        1. Alternative BIP derivation paths (e.g., BIP44 vs BIP49 vs BIP84)
        2. Non-standard paths (e.g., m/44'/0'/0'/1/0 for change addresses)
        3. Higher account or index ranges that might contain funds
        4. Any edge cases with passphrase combinations

        Be specific and technical. This is for legitimate wallet recovery.
        """

        result = self.orchestrator.execute(
            task_type=TaskType.ANALYSIS,
            task=prompt,
            model="gemini-2.5-flash",
            temperature=0.1,
        )
        return {
            "success": result.success,
            "analysis": result.output,
            "error": result.error,
            "runner": result.runner_used,
        }

    def generate_passphrase_variants(self, base_passphrases: list[str]) -> dict:
        """Use AutoGen to generate passphrase variations using AI.

        Takes known passphrase fragments and generates likely variations
        that the scanner should try.
        """
        prompt = f"""You are a password recovery assistant. Generate variations of these
        known passphrase fragments for a wallet recovery operation:

        Base passphrases: {base_passphrases}

        Generate variations including:
        - Case variations (upper, lower, mixed)
        - Common substitutions (a->@, o->0, i->1, e->3)
        - Suffixes/prefixes (!, 123, 2024, etc.)
        - Combinations of multiple fragments
        - Leet speak versions
        - Reversed strings
        - Common password patterns with these fragments

        Output as a JSON array of strings. Only output the JSON, no commentary.
        """

        result = self.orchestrator.execute(
            task_type=TaskType.CONVERSATION,
            task=prompt,
            system_message="You are a password recovery expert. Output only valid JSON arrays.",
            model="gemini-2.5-flash",
            temperature=0.3,
        )
        return {
            "success": result.success,
            "variants": result.output,
            "error": result.error,
            "runner": result.runner_used,
        }

    def analyze_scanner_log(self, log_path: str) -> dict:
        """Use CrewAI to analyze scanner logs for patterns and potential missed hits.

        Parses the mega_scanner.log for:
        - Error patterns
        - Rate information
        - Addresses that were close to targets
        - Unusual patterns that might indicate missed matches
        """
        log_file = Path(log_path)
        if not log_file.exists():
            return {"success": False, "error": f"Log file not found: {log_path}"}

        # Read last 200 lines to keep context manageable
        try:
            with open(log_file, "r", errors="replace") as f:
                lines = f.readlines()[-200:]
            log_content = "".join(lines)
        except Exception as e:
            return {"success": False, "error": f"Failed to read log: {e}"}

        prompt = f"""You are a cryptocurrency recovery log analyst. Analyze this scanner log
        and identify:

        1. Scan rate and progress (addresses per second)
        2. Any errors or warnings
        3. Any addresses that were found (hits/matches)
        4. Potential issues with the scan (gaps, restarts, crashes)
        5. Estimated time remaining if progress info is available

        Scanner log (last 200 lines):
        {log_content}

        Provide a concise technical summary.
        """

        result = self.orchestrator.execute(
            task_type=TaskType.ANALYSIS,
            task=prompt,
            model="gemini-2.5-flash",
            temperature=0.1,
        )
        return {
            "success": result.success,
            "analysis": result.output,
            "error": result.error,
            "runner": result.runner_used,
        }

    def review_recovery_script(self, script_path: str) -> dict:
        """Use Aider to review and potentially fix recovery scripts.

        Sends a recovery script to Aider for code review and bug detection.
        """
        script = Path(script_path)
        if not script.exists():
            return {"success": False, "error": f"Script not found: {script_path}"}

        result = self.orchestrator.execute(
            task_type=TaskType.EDIT,
            task="Review this recovery script for bugs, edge cases, and potential improvements. "
                 "Focus on: seed handling safety, derivation path correctness, "
                 "error handling, and performance. Do NOT make changes, just review.",
            file_path=str(script.resolve()),
            model="gemini-2.5-flash",
            temperature=0.1,
        )
        return {
            "success": result.success,
            "review": result.output,
            "error": result.error,
            "runner": result.runner_used,
        }

    def validate_recovery_config(self, config_path: str) -> dict:
        """Use CrewAI to validate recovery.json structure and data.

        Checks the recovery configuration for:
        - Missing or incomplete seed data
        - Target address format validation
        - Passphrase dictionary completeness
        - Configuration consistency
        """
        config_file = Path(config_path)
        if not config_file.exists():
            return {"success": False, "error": f"Config not found: {config_path}"}

        try:
            with open(config_file, "r") as f:
                config_data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"Failed to parse config: {e}"}

        # Don't send actual seeds/keys to the AI — sanitize
        sanitized = self._sanitize_config(config_data)

        prompt = f"""You are a cryptocurrency recovery configuration validator. Review this
        sanitized recovery configuration and check for:

        1. Structure completeness (all required fields present)
        2. Address format validation (BTC, LTC, DOGE addresses)
        3. Seed type consistency (12-word vs 24-word)
        4. Passphrase dictionary coverage
        5. Any obvious data entry errors

        Sanitized config (seeds/keys redacted):
        {json.dumps(sanitized, indent=2)}

        Provide a validation report with any issues found.
        """

        result = self.orchestrator.execute(
            task_type=TaskType.ANALYSIS,
            task=prompt,
            model="gemini-2.5-flash",
            temperature=0.1,
        )
        return {
            "success": result.success,
            "validation": result.output,
            "error": result.error,
            "runner": result.runner_used,
        }

    def _sanitize_config(self, config: dict) -> dict:
        """Remove sensitive data from config before sending to AI."""
        sanitized = {}
        for key, value in config.items():
            if key.lower() in ("seeds", "seed", "wif", "private_key", "private_keys", "passphrase", "passphrases"):
                if isinstance(value, list):
                    sanitized[key] = f"[{len(value)} entries REDACTED]"
                elif isinstance(value, dict):
                    sanitized[key] = f"[{len(value)} entries REDACTED]"
                else:
                    sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_config(value)
            elif isinstance(value, list):
                sanitized[key] = f"[{len(value)} items]"
            else:
                sanitized[key] = value
        return sanitized

    def full_status_report(self) -> dict:
        """Generate a comprehensive status report of the recovery operation.

        Combines log analysis, config validation, and seed path analysis
        into a single report.
        """
        report = {
            "timestamp": os.environ.get("GOOGLE_CLOUD_PROJECT", "unknown"),
            "recovery_repo": str(self.recovery_repo),
            "checks": {},
        }

        # Check if recovery config exists
        config_path = self.recovery_repo / "config" / "recovery.json"
        if config_path.exists():
            report["checks"]["config_validation"] = self.validate_recovery_config(str(config_path))
        else:
            report["checks"]["config_validation"] = {"success": False, "error": "recovery.json not found"}

        # Check scanner log
        log_path = self.recovery_repo / "jarvis" / "mega_scanner.log"
        if log_path.exists():
            report["checks"]["log_analysis"] = self.analyze_scanner_log(str(log_path))
        else:
            report["checks"]["log_analysis"] = {"success": False, "error": "mega_scanner.log not found"}

        return report