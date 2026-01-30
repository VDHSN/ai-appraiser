#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""
Pre-tool-use hook for security controls.

Exit codes:
  0 - Allow operation
  2 - Block operation (with reason in stdout)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Dangerous rm patterns
DANGEROUS_RM_PATTERNS = [
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+/\s*$",  # rm -rf /
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+/\*",  # rm -rf /*
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+~/?",  # rm -rf ~ or ~/
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+\$HOME",  # rm -rf $HOME
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+/Users/",  # rm -rf /Users/
    r"rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|(-[a-zA-Z]*f[a-zA-Z]*r))\s+/home/",  # rm -rf /home/
]

# Env file patterns to block (but allow examples)
ENV_BLOCK_PATTERN = r"\.env(?!\.sample|\.example|\.template|\.local\.example)"


def get_log_path() -> Path:
    """Get the log file path."""
    project_root = Path(__file__).parent.parent.parent
    log_dir = project_root / "logs"
    log_dir.mkdir(exist_ok=True)
    return log_dir / "pre_tool_use.json"


def log_blocked(tool_name: str, reason: str, input_data: dict) -> None:
    """Log blocked operations."""
    log_path = get_log_path()

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool": tool_name,
        "reason": reason,
        "input": input_data,
        "action": "blocked",
    }

    logs = []
    if log_path.exists():
        try:
            with open(log_path) as f:
                logs = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logs = []

    logs.append(entry)

    with open(log_path, "w") as f:
        json.dump(logs, f, indent=2)


def check_dangerous_rm(command: str) -> str | None:
    """Check for dangerous rm commands. Returns reason if blocked."""
    for pattern in DANGEROUS_RM_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return f"Blocked dangerous rm command matching pattern: {pattern}"
    return None


def check_env_access(file_path: str) -> str | None:
    """Check for .env file access. Returns reason if blocked."""
    basename = os.path.basename(file_path)
    if re.match(ENV_BLOCK_PATTERN, basename):
        return f"Blocked access to sensitive .env file: {file_path}"
    return None


def main() -> int:
    """Main entry point."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0  # Allow if we can't parse input

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check Bash commands
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        reason = check_dangerous_rm(command)
        if reason:
            log_blocked(tool_name, reason, tool_input)
            print(reason)
            return 2

    # Check file access for Read, Write, Edit
    if tool_name in ("Read", "Write", "Edit"):
        file_path = tool_input.get("file_path", "")
        reason = check_env_access(file_path)
        if reason:
            log_blocked(tool_name, reason, tool_input)
            print(reason)
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
