"""
Command mode — hold Ctrl+J, speak, release: the transcript goes to ARIA
along with where you are (active app, selected text), and ARIA's paste-ready
reply lands where you're typing.

The clipboard is snapshotted on hotkey-down and restored after the paste, so
command mode is invisible to normal copy/paste use. Text-only fidelity: an
image or file on the clipboard won't survive the round-trip.
"""
import os
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import pyautogui
import requests
from AppKit import NSWorkspace

_BACKEND_URL = os.environ.get("ARIA_BACKEND_URL", "http://localhost:8000").rstrip("/")
ARIA_COMMAND_URL = f"{_BACKEND_URL}/voice/command"
REQUEST_TIMEOUT = 120  # agentic replies with tool calls can take a while
MAX_SELECTION_CHARS = 16_000


@dataclass
class CommandContext:
    app_name: Optional[str]
    clipboard_snapshot: str
    selection: Optional[str]


def _read_clipboard() -> str:
    result = subprocess.run(["pbpaste"], capture_output=True)
    return result.stdout.decode(errors="replace")


def _write_clipboard(text: str) -> None:
    subprocess.run(["pbcopy"], input=text.encode(), check=True)


def frontmost_app_name() -> Optional[str]:
    app = NSWorkspace.sharedWorkspace().frontmostApplication()
    return app.localizedName() if app else None


def capture_context() -> CommandContext:
    """On hotkey-down: snapshot the clipboard, then simulate Cmd+C to grab
    whatever is selected in the active app.

    The clipboard is cleared before the simulated copy so an app with no
    selection (where copy is a no-op) can't be confused with the user's old
    clipboard contents.
    """
    app_name = frontmost_app_name()
    snapshot = _read_clipboard()
    _write_clipboard("")
    pyautogui.hotkey("command", "c")
    time.sleep(0.15)
    selection = _read_clipboard().strip()
    return CommandContext(app_name, snapshot, selection or None)


def restore_clipboard(ctx: CommandContext) -> None:
    _write_clipboard(ctx.clipboard_snapshot)


def earcon(sound: str = "Pop") -> None:
    """Fire-and-forget system sound — audible feedback without blocking."""
    subprocess.Popen(
        ["afplay", f"/System/Library/Sounds/{sound}.aiff"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def send_command(transcript: str, ctx: CommandContext) -> Optional[str]:
    """POST the command to ARIA. Returns the paste-ready reply, or None on
    failure (error sound played, nothing gets pasted; the caller still
    restores the clipboard)."""
    payload = {
        "transcript": transcript,
        "active_app_name": ctx.app_name,
        "selection_snapshot": (ctx.selection or "")[:MAX_SELECTION_CHARS] or None,
        "timestamp": datetime.now().astimezone().isoformat(),
    }
    try:
        r = requests.post(ARIA_COMMAND_URL, json=payload, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        reply = r.json().get("reply", "").strip()
        if reply:
            return reply
        print("[Voice] ARIA returned an empty reply.")
    except requests.RequestException as e:
        print(f"[Voice] ARIA request failed: {e}")
    earcon("Basso")
    return None
