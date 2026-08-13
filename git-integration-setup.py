#!/usr/bin/env python3
"""
Git Multi-Account Integration Script
Sets up correct credentials, remotes, and per-repo user config across all GitHub accounts.

Accounts:
  1. yajlang           — personal (primary, admin@208fenceandgate.com)
  2. conor-ops         — personal/work (admin@208fenceandgate.com)
  3. 208DevOps         — enterprise (admin@208fenceandgate.com)
  4. Autonomous-Agentic-Workflows — shared org (admin@208fenceandgate.com)

Usage:
  python git-integration-setup.py          # scan and report
  python git-integration-setup.py --apply   # apply fixes
"""
import os
import subprocess
import sys
from pathlib import Path

BASE = Path(os.environ.get("USERPROFILE", os.environ.get("HOME", ""))) / "OneDrive" / "ConsolidatedDevelopment"
BACKUP_REPOS = Path(os.environ.get("USERPROFILE", os.environ.get("HOME", ""))) / "Documents" / "JayLang085MR4" / "OneDrive" / "ConsolidatedDevelopment"

# Account configurations
ACCOUNTS = {
    "yajlang": {
        "name": "Conor Gold",
        "email": "admin@208fenceandgate.com",
        "repos": ["OmniDev", "fictional-invention", "Cline"],
    },
    "conor-ops": {
        "name": "Conor Gomes",
        "email": "admin@208fenceandgate.com",
        "repos": ["MasterRecovery3", "Numera2", "numera", "JARVIS", "FlowState-Finance", "BizBalance"],
    },
    "208DevOps": {
        "name": "Conor Gold",
        "email": "admin@208fenceandgate.com",
        "repos": ["MasterRecovery3_SSOT"],
    },
    "Autonomous-Agentic-Workflows": {
        "name": "Conor Gold",
        "email": "admin@208fenceandgate.com",
        "repos": ["agents-cli", "aider", "mindsdb", "local-recovery", "GenAIMindMapFlowBuilder", "antigravity-sdk-python", "autonomous-recovery"],
    },
}

def run_git(repo_path, *args, check=False):
    try:
        result = subprocess.run(
            ["git"] + list(args),
            cwd=str(repo_path),
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), 1

def find_all_repos():
    """Find all git repos in both ConsolidatedDevelopment and backup FoundRepos."""
    repos = []
    for base in [BASE, BACKUP_REPOS]:
        if not base.exists():
            continue
        for item in sorted(base.iterdir()):
            if (item / ".git").exists():
                repos.append(item)
        # Also check FoundRepos subdirs
        found_repos = base / "FoundRepos"
        if found_repos.exists():
            for item in sorted(found_repos.iterdir()):
                if (item / ".git").exists():
                    repos.append(item)
    return repos

def get_repo_owner(repo_path):
    """Extract the GitHub owner from the remote URL."""
    out, _ = run_git(repo_path, "remote", "get-url", "origin")
    if "github.com/" in out:
        # Extract owner/repo from URL like https://github.com/owner/repo.git
        parts = out.split("github.com/")[-1].split("/")
        if len(parts) >= 2:
            return parts[0]
    return None

def audit_repo(repo_path, apply=False):
    """Check and optionally fix a repo's git config."""
    owner = get_repo_owner(repo_path)
    name = repo_path.name
    issues = []
    fixes = []

    # Check if repo has a remote
    out, rc = run_git(repo_path, "remote", "get-url", "origin")
    if rc != 0:
        issues.append("NO REMOTE")
        if owner and apply:
            for acc, config in ACCOUNTS.items():
                if name in config["repos"] or name.startswith(acc):
                    url = f"https://github.com/{acc}/{name}.git"
                    run_git(repo_path, "remote", "add", "origin", url)
                    fixes.append(f"Added remote: {url}")
                    break

    # Check user config for this repo
    if owner and owner in ACCOUNTS:
        expected = ACCOUNTS[owner]
        current_name, _ = run_git(repo_path, "config", "user.name")
        current_email, _ = run_git(repo_path, "config", "user.email")

        if current_name != expected["name"]:
            issues.append(f"user.name={current_name} (expected {expected['name']})")
            if apply:
                run_git(repo_path, "config", "user.name", expected["name"])
                fixes.append(f"Set user.name={expected['name']}")

        if current_email != expected["email"]:
            issues.append(f"user.email={current_email} (expected {expected['email']})")
            if apply:
                run_git(repo_path, "config", "user.email", expected["email"])
                fixes.append(f"Set user.email={expected['email']}")

    # Check branch name (recommend main)
    branch, _ = run_git(repo_path, "rev-parse", "--abbrev-ref", "HEAD")
    if branch and branch != "main" and branch != "master":
        issues.append(f"branch={branch}")

    return {
        "name": name,
        "owner": owner or "unknown",
        "remote": out,
        "branch": branch,
        "issues": issues,
        "fixes": fixes,
    }

def main():
    apply = "--apply" in sys.argv
    mode = "APPLYING FIXES" if apply else "SCANNING (dry run)"

    print("=" * 75)
    print(f"GIT MULTI-ACCOUNT INTEGRATION — {mode}")
    print("=" * 75)
    print(f"Base: {BASE}")
    print(f"Backup: {BACKUP_REPOS}")
    print()

    # Show account summary
    print("ACCOUNTS:")
    for org, config in ACCOUNTS.items():
        print(f"  {org:30s} {config['name']} <{config['email']}>  ({len(config['repos'])} repos)")
    print()

    repos = find_all_repos()
    print(f"Found {len(repos)} git repositories\n")

    print(f"{'REPO':<35} {'OWNER':<30} {'ISSUES':<30}")
    print("-" * 95)

    total_issues = 0
    total_fixes = 0
    results = []

    for repo in repos:
        result = audit_repo(repo, apply=apply)
        results.append(result)
        issues_str = ", ".join(result["issues"]) if result["issues"] else "OK"
        print(f"{result['name']:<35} {result['owner']:<30} {issues_str:<30}")
        total_issues += len(result["issues"])
        total_fixes += len(result["fixes"])

    # Summary
    print(f"\n{'=' * 75}")
    print(f"SUMMARY: {len(repos)} repos, {total_issues} issues found, {total_fixes} fixes applied")
    print(f"{'=' * 75}")

    if not apply and total_issues > 0:
        print(f"\nRun with --apply to fix {total_issues} issues:")
        print(f"  python {sys.argv[0]} --apply")
    elif apply and total_fixes > 0:
        print(f"\nApplied {total_fixes} fixes. Verify with: git config --list in each repo.")

    # Per-account breakdown
    print(f"\nPER-ACCOUNT STATUS:")
    for org, config in ACCOUNTS.items():
        org_repos = [r for r in results if r["owner"] == org]
        issues_count = sum(len(r["issues"]) for r in org_repos)
        print(f"  {org:30s} {len(org_repos)} repos, {issues_count} issues")

    # Repos with no remote (need manual setup)
    no_remote = [r for r in results if "NO REMOTE" in r["issues"]]
    if no_remote:
        print(f"\nREPOS WITHOUT REMOTE ({len(no_remote)}):")
        for r in no_remote:
            print(f"  {r['name']}")

    # Repos with unknown owner
    unknown = [r for r in results if r["owner"] == "unknown"]
    if unknown:
        print(f"\nREPOS WITH UNKNOWN OWNER ({len(unknown)}):")
        for r in unknown:
            print(f"  {r['name']} — remote: {r['remote']}")

if __name__ == "__main__":
    main()