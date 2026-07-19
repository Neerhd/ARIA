"""
ARIA Voice — system-wide speech input for macOS (originally the standalone
Hush app, absorbed into ARIA). Local Whisper transcription; audio never
leaves the machine.

Two modes:
- Dictation: press Ctrl+H to start recording, press Ctrl+H again to stop.
  The audio is transcribed locally and injected into the focused input field.
- Command: hold Ctrl+J, speak, release. The transcript goes to ARIA along
  with the active app and any selected text; ARIA's reply is pasted instead
  of the transcript (see command_mode.py).
"""

import threading
import time
import wave
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import sounddevice as sd
from pynput import keyboard
from Quartz import (
    CGEventGetFlags,
    CGEventGetIntegerValueField,
    kCGEventFlagMaskControl,
    kCGKeyboardEventKeycode,
)

import command_mode
from injector import inject
from transcriber import Transcriber


# Recording config — 16 kHz mono matches Whisper's native sample rate exactly,
# avoiding any resampling overhead during transcription.
SAMPLE_RATE = 16_000
CHANNELS = 1
HOTKEY = {keyboard.Key.ctrl, keyboard.KeyCode.from_char("h")}
COMMAND_HOTKEY = {keyboard.Key.ctrl, keyboard.KeyCode.from_char("j")}
RECORDINGS_DIR = Path(__file__).parent / "recordings"


class AudioRecorder:
    """Captures microphone audio into memory and flushes it to a WAV file on demand."""

    def __init__(self):
        self._frames: list[np.ndarray] = []
        self._recording = False
        self._lock = threading.Lock()

    def start(self) -> None:
        """Open the input stream and begin buffering audio frames."""
        with self._lock:
            if self._recording:
                return
            self._frames = []
            self._recording = True

        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            callback=self._callback,
        )
        self._stream.start()
        print("[Voice] ● Recording… (press Ctrl+H to stop)")

    def stop(self) -> Optional[Path]:
        """Stop the stream, write captured audio to disk, and return the file path."""
        with self._lock:
            if not self._recording:
                return None
            self._recording = False

        self._stream.stop()
        self._stream.close()

        if not self._frames:
            print("[Voice] No audio captured.")
            return None

        return self._save()

    def _callback(self, indata, frames, time, status) -> None:
        with self._lock:
            if self._recording:
                self._frames.append(indata.copy())

    def _save(self) -> Path:
        RECORDINGS_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = RECORDINGS_DIR / f"recording_{timestamp}.wav"

        audio = np.concatenate(self._frames, axis=0)
        with wave.open(str(path), "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # int16 = 2 bytes per sample
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio.tobytes())

        duration = len(audio) / SAMPLE_RATE
        print(f"[Voice] Saved {duration:.1f}s → {path.name}")
        return path


class HotkeyListener:
    """
    Listens for the Ctrl+H toggle at the OS level.

    Key events belonging to the hotkey combo are consumed by the CGEventTap
    before they reach any application, preventing sound or unintended input.
    Transcription runs on a background thread so the hotkey stays responsive.
    """

    # macOS virtual key codes for every key in the Ctrl+H and Ctrl+J combos.
    # Both left and right variants of Ctrl are included.
    _HOTKEY_VKS = frozenset({
        0x3B,  # ctrl_l
        0x3E,  # ctrl_r
        0x04,  # h
        0x26,  # j (command mode)
    })

    def __init__(self, recorder: AudioRecorder, transcriber: Transcriber):
        self._recorder = recorder
        self._transcriber = transcriber
        self._pressed: set = set()
        self._recording = False
        # Guards against the combo firing repeatedly while the keys are held down.
        self._combo_fired = False
        # Command mode (hold Ctrl+J) — context captured on key-down, sent on release.
        self._command_active = False
        self._command_ctx = None

    def _normalize(self, key):
        """Map left/right Ctrl variants to a single canonical key."""
        if key in (keyboard.Key.ctrl_l, keyboard.Key.ctrl_r):
            return keyboard.Key.ctrl
        return key

    def on_press(self, key) -> None:
        key = self._normalize(key)
        self._pressed.add(key)

        # Command mode: hold-to-talk. Context (active app, selection) is
        # captured on key-down, before recording starts. Ignored while a
        # dictation recording is running.
        if (
            COMMAND_HOTKEY.issubset(self._pressed)
            and not self._command_active
            and not self._recording
        ):
            self._command_active = True
            self._command_ctx = command_mode.capture_context()
            self._recorder.start()
            command_mode.earcon("Tink")  # "listening"
            return

        if HOTKEY.issubset(self._pressed) and not self._combo_fired:
            self._combo_fired = True
            if self._command_active:
                return  # dictation toggle is disabled during a command capture
            if not self._recording:
                self._recording = True
                self._recorder.start()
            else:
                self._recording = False
                path = self._recorder.stop()
                if path:
                    threading.Thread(
                        target=self._transcribe_and_inject,
                        args=(path,),
                        daemon=True,
                    ).start()

    def on_release(self, key) -> None:
        key = self._normalize(key)
        self._pressed.discard(key)

        # Command mode ends the moment the combo is broken (either key up).
        if self._command_active and not COMMAND_HOTKEY.issubset(self._pressed):
            self._command_active = False
            ctx = self._command_ctx
            self._command_ctx = None
            path = self._recorder.stop()
            command_mode.earcon("Pop")  # "heard you"
            if path:
                threading.Thread(
                    target=self._process_command,
                    args=(path, ctx),
                    daemon=True,
                ).start()
            elif ctx:
                command_mode.restore_clipboard(ctx)

        # Reset the guard once the combo is broken so the next press works.
        if not HOTKEY.issubset(self._pressed):
            self._combo_fired = False

    def _transcribe_and_inject(self, path: Path) -> None:
        """Transcribe the recording, inject the result, then delete the file."""
        print("[Voice] Transcribing…")
        try:
            text = self._transcriber.transcribe(path)
            if text:
                print(f"[Voice] Transcript: {text}")
                inject(text)
            else:
                print("[Voice] (no speech detected)")
        finally:
            # Always remove the wav — transcriptions live in memory only.
            path.unlink(missing_ok=True)

    def _process_command(self, path: Path, ctx) -> None:
        """Transcribe the command, ask ARIA, paste the reply, restore the
        clipboard, delete the recording."""
        print("[Voice] Transcribing command…")
        try:
            text = self._transcriber.transcribe(path)
            if not text:
                print("[Voice] (no speech detected)")
                command_mode.notify("No speech detected.")
                return
            print(f"[Voice] Command ({ctx.app_name or 'unknown app'}): {text}")
            print("[Voice] Asking ARIA…")
            command_mode.notify(f'Heard: "{text}" — thinking…')
            reply = command_mode.send_command(text, ctx)
            if reply:
                print(f"[Voice] Pasting ARIA's reply ({len(reply)} chars).")
                inject(reply)
                time.sleep(0.4)  # let the paste land before the clipboard is restored
        finally:
            if ctx:
                command_mode.restore_clipboard(ctx)
            path.unlink(missing_ok=True)

    def _intercept(self, event_type, event):
        """
        Selectively suppress hotkey events at the CGEventTap level.

        Returns None to consume an event, or the original event to pass it through.
        Only suppresses keys that are part of the Ctrl+H combo while Ctrl is held,
        leaving all other keyboard input unaffected.
        """
        vk = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)
        flags = CGEventGetFlags(event)
        if vk in self._HOTKEY_VKS and bool(flags & kCGEventFlagMaskControl):
            return None
        return event

    def run(self) -> None:
        print("[Voice] ARIA Voice ready.")
        print("       Dictation: press Ctrl+H to start/stop recording.")
        print("       Command:   hold Ctrl+J, speak, release — ARIA replies in place.")
        print("       Press Ctrl+C to quit.\n")
        with keyboard.Listener(
            on_press=self.on_press,
            on_release=self.on_release,
            intercept=self._intercept,
        ) as listener:
            try:
                listener.join()
            except KeyboardInterrupt:
                print("\n[Voice] Stopped.")


if __name__ == "__main__":
    transcriber = Transcriber(model_size="base")
    recorder = AudioRecorder()
    HotkeyListener(recorder, transcriber).run()
