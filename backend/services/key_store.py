"""Runtime provider API keys — the ones added through the Settings UI.

Stored in <data>/provider_keys.json with owner-only file permissions: the
same plaintext-on-disk security level as backend/.env, which remains the
other supported place for keys. A stored key wins over an .env key so the
UI always reflects the most recent intent; keys are write-only through the
API (never returned to the frontend)."""
import json
import logging
import os
from pathlib import Path
from config import settings

logger = logging.getLogger(__name__)

_PATH = Path(settings.sqlite_db_path).parent.parent / "provider_keys.json"


def _load() -> dict:
    try:
        with open(_PATH) as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception as e:
        logger.warning(f"Could not read provider keys: {e}")
        return {}


def _save(keys: dict) -> None:
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_PATH, "w") as f:
        json.dump(keys, f, indent=2)
    os.chmod(_PATH, 0o600)


def stored_key(provider_id: str) -> str:
    return _load().get(provider_id, "") or ""


def set_key(provider_id: str, key: str) -> None:
    keys = _load()
    keys[provider_id] = key
    _save(keys)


def clear_key(provider_id: str) -> None:
    keys = _load()
    if provider_id in keys:
        del keys[provider_id]
        _save(keys)
