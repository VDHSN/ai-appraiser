#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""
Post-tool-use hook for audit logging.

Logs all tool invocations with timestamps for auditing purposes.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def get_log_path() -> Path:
    """Get the log file path."""
    project_root = Path(__file__).parent.parent.parent
    log_dir = project_root / "logs"
    log_dir.mkdir(exist_ok=True)
    return log_dir / "post_tool_use.json"


def truncate_output(output: str, max_length: int = 1000) -> str:
    """Truncate output to avoid huge log files."""
    if len(output) > max_length:
        return output[:max_length] + f"... [truncated {len(output) - max_length} chars]"
    return output


def main() -> int:
    """Main entry point."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0  # Silently continue if we can't parse

    log_path = get_log_path()

    # Extract relevant data
    tool_name = input_data.get("tool_name", "unknown")
    tool_input = input_data.get("tool_input", {})
    tool_output = input_data.get("tool_output", "")

    # Truncate large outputs
    if isinstance(tool_output, str):
        tool_output = truncate_output(tool_output)

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool": tool_name,
        "input": tool_input,
        "output_preview": tool_output,
        "session_id": input_data.get("session_id", "unknown"),
    }

    # Load existing logs
    logs = []
    if log_path.exists():
        try:
            with open(log_path) as f:
                logs = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logs = []

    logs.append(entry)

    # Keep last 1000 entries to prevent unbounded growth
    if len(logs) > 1000:
        logs = logs[-1000:]

    with open(log_path, "w") as f:
        json.dump(logs, f, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
