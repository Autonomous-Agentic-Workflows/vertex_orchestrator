#!/usr/bin/env python
"""Example: Unified orchestration of CrewAI, AutoGen, and Aider via Vertex AI.

This script demonstrates the full workflow:
  1. Configure Vertex AI with your enterprise Google Cloud project
  2. Create the unified orchestrator
  3. Execute tasks across all three agent frameworks

Before running, ensure you have:
  - gcloud auth application-default login
  - GOOGLE_CLOUD_PROJECT env var set (or pass project_id explicitly)
  - crewai / pyautogen / aider-chat installed for real execution

Usage:
    python -m vertex_orchestrator.example
"""
from __future__ import annotations

import os
import sys

from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import Orchestrator, TaskType


def main() -> int:
    # 1. Configure Vertex AI with enterprise project boundaries
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "your-corporate-project-id")
    location = os.environ.get("VERTEXAI_LOCATION", "us-central1")

    config = VertexAIConfig(
        project_id=project_id,
        location=location,
        model="gemini-2.5-pro",
        temperature=0.2,
    )

    # 2. Create the orchestrator
    orch = Orchestrator(config=config)

    # 3. Define tasks for each framework
    tasks = [
        {
            "task_type": TaskType.ANALYSIS,
            "task": "Scan source code repositories for unsafe license leakage",
        },
        {
            "task_type": TaskType.CONVERSATION,
            "task": "Design a secure data model for user authentication",
            "system_message": "You generate highly secure, proprietary object models.",
        },
        {
            "task_type": TaskType.EDIT,
            "task": "Add input validation to the login function",
            "file_path": "src/auth.py",
        },
    ]

    # 4. Execute all tasks
    print("=" * 60)
    print("Vertex AI Unified Orchestrator")
    print(f"  Project:  {config.project_id}")
    print(f"  Location: {config.location}")
    print(f"  Model:    {config.model}")
    print("=" * 60)

    results = orch.execute_batch(tasks=tasks)

    for i, (task_spec, result) in enumerate(zip(tasks, results)):
        task_type = task_spec["task_type"].value
        status = "PASS" if result.success else "FAIL"
        print(f"\n[{i + 1}] {task_type.upper()} -> {result.runner_used} [{status}]")
        if result.success:
            print(f"    Output: {result.output}")
        else:
            print(f"    Error:  {result.error}")

    # 5. Summary
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed
    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())