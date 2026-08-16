"""Event logging integration for the orchestrator server.

Wraps the shell-based event-log.sh framework so that server.py can
log structured events to ~/docs/events/ without spawning a subprocess
for every request. Events are written as JSON lines to the daily log
file, matching the format produced by event-log.sh.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


_EVENTS_DIR_DEFAULT = os.path.expanduser("~/docs/events")


def _get_events_dir() -> Path:
    return Path(os.environ.get("ORCHESTRATOR_EVENT_DIR", _EVENTS_DIR_DEFAULT))


def _ensure_dir() -> None:
    _get_events_dir().mkdir(parents=True, exist_ok=True)


def _log_file() -> Path:
    return _get_events_dir() / f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.log"


def _update_symlink() -> None:
    events_dir = _get_events_dir()
    latest = events_dir / "latest.log"
    target = _log_file()
    try:
        if latest.is_symlink() or latest.exists():
            latest.unlink()
        latest.symlink_to(target)
    except OSError:
        pass  # symlink creation may fail on some filesystems


def log_event(
    category: str,
    message: str,
    details: Optional[str] = None,
) -> None:
    """Log a structured event to the daily event log file.

    Args:
        category: One of: discovery, recovery, agent, infra, security,
                  archive, timeline, other
        message: Short event description
        details: Optional longer details string
    """
    _ensure_dir()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    entry = {"timestamp": timestamp, "category": category, "message": message}
    if details:
        entry["details"] = details

    with open(_log_file(), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    _update_symlink()


def log_request(method: str, path: str, status: int, duration_ms: float) -> None:
    """Convenience: log an API request event."""
    log_event(
        "agent",
        f"{method} {path} → {status}",
        f"duration: {duration_ms:.1f}ms",
    )


def log_recovery(action: str, success: bool, details: str = "") -> None:
    """Convenience: log a recovery operation."""
    log_event(
        "recovery",
        f"{action} {'✓' if success else '✗'}",
        details if details else None,
    )


def log_overseer(action: str, success: bool) -> None:
    """Convenience: log an overseer lifecycle event."""
    log_event(
        "infra",
        f"overseer {action} {'✓' if success else '✗'}",
    )


def log_security(event: str, details: str = "") -> None:
    """Convenience: log a security event (auth failure, key rotation, etc.)."""
    log_event(
        "security",
        event,
        details if details else None,
    )