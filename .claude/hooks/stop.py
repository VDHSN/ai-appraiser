#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""
Stop hook for TTS notifications on task completion.

Uses macOS `say` command for text-to-speech (no dependencies required).
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def get_log_path() -> Path:
    """Get the log file path."""
    project_root = Path(__file__).parent.parent.parent
    log_dir = project_root / "logs"
    log_dir.mkdir(exist_ok=True)
    return log_dir / "stop.json"


def speak(message: str) -> None:
    """Speak message using macOS say command. Fails gracefully on non-macOS systems."""
    try:
        subprocess.run(
            ["say", "-v", "Samantha", message],
            check=False,
            capture_output=True,
            timeout=10,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass  # Silently fail if say is unavailable or on non-macOS systems


def log_stop(input_data: dict, notify: bool) -> None:
    """Log stop event."""
    log_path = get_log_path()

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stop_reason": input_data.get("stop_reason", "unknown"),
        "session_id": input_data.get("session_id", "unknown"),
        "notified": notify,
    }

    logs = []
    if log_path.exists():
        try:
            with open(log_path) as f:
                logs = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logs = []

    logs.append(entry)

    # Keep last 100 entries
    if len(logs) > 100:
        logs = logs[-100:]

    with open(log_path, "w") as f:
        json.dump(logs, f, indent=2)


def main() -> int:
    """Main entry point."""
    notify = "--notify" in sys.argv

    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    log_stop(input_data, notify)

    if notify:
        stop_reason = input_data.get("stop_reason", "end_turn")

        if stop_reason == "end_turn":
            speak("Claude has finished.")
        elif stop_reason == "stop_sequence":
            speak("Task complete.")
        else:
            speak("Claude stopped.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
