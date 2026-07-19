"""
Local speech-to-text using faster-whisper.

The model is loaded once at startup and reused across recordings.
Transcription runs entirely on-device — no data leaves the machine.
"""

from pathlib import Path

from faster_whisper import WhisperModel


class Transcriber:
    """Wraps a faster-whisper model and exposes a simple transcribe() method."""

    def __init__(self, model_size: str = "base"):
        print(f"[Voice] Loading Whisper {model_size} model…")
        # CPU + int8 quantisation is the fastest reliable path on macOS.
        # The base model (~145 MB) gives a good balance of speed and accuracy.
        self._model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("[Voice] Model ready.\n")

    def transcribe(self, audio_path: Path) -> str:
        """
        Return the transcribed text for the given WAV file.

        VAD filtering is enabled to skip silent sections, which keeps latency
        low even when there are gaps or trailing silence in the recording.
        """
        segments, _ = self._model.transcribe(
            str(audio_path),
            # Greedy decoding (beam 1) is ~2-3x faster than beam 5; short
            # dictations and voice commands rarely benefit from a wider beam.
            beam_size=1,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
