"""
Text injection for macOS.

Copies the transcript to the system clipboard via pbcopy, then simulates
Cmd+V to paste into whichever input field currently has focus.
"""

import subprocess
import time

import pyautogui

# Disable pyautogui's built-in inter-action delay and the fail-safe mouse
# corner so neither interferes with the paste timing.
pyautogui.PAUSE = 0
pyautogui.FAILSAFE = False


def inject(text: str, delay: float = 0.3) -> None:
    """
    Paste text into the focused input field.

    The short delay gives macOS time to return focus to the target app
    after the Ctrl+H hotkey is released before the paste is triggered.
    """
    subprocess.run(["pbcopy"], input=text.encode(), check=True)
    time.sleep(delay)
    pyautogui.hotkey("command", "v")
