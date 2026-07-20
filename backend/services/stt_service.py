"""In-app dictation — local Whisper transcription for the chat composer's
mic button. Distinct from voice/ (system-wide hotkey dictation/commands,
its own process): this runs inside the backend itself so the composer can
call a plain HTTP endpoint. Audio is written to a temp file only for the
duration of transcription and deleted immediately after — nothing persists.
"""
import asyncio
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info("Loading Whisper model for in-app dictation...")
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def _transcribe_sync(path: Path) -> str:
    model = _get_model()
    segments, _ = model.transcribe(str(path), beam_size=1, vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments).strip()


async def transcribe_audio(content: bytes, suffix: str = ".webm") -> str:
    """Transcribe a recorded audio clip. Never raises — returns "" on any
    failure so a mic hiccup can't break the composer."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            tmp_path = Path(f.name)
        return await asyncio.to_thread(_transcribe_sync, tmp_path)
    except Exception as e:
        logger.warning(f"In-app transcription failed: {e}")
        return ""
    finally:
        if tmp_path:
            tmp_path.unlink(missing_ok=True)
