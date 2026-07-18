"""Task roles — the categories Auto mode routes between, and the user's
role→model assignments.

A role's effective model resolves in two steps: a user assignment (persisted
to data/role_assignments.json) wins when its provider is still configured;
otherwise the role falls back to the default provider — its budget model for
lightweight roles, its main chat model for everything else. Defaults are
dynamic on purpose: whichever provider the user connected first powers every
unassigned role.
"""
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from config import settings
from services.router_service import (
    is_configured, default_provider, default_model, cheap_model,
)

logger = logging.getLogger(__name__)

_ASSIGNMENTS_PATH = Path(settings.sqlite_db_path).parent.parent / "role_assignments.json"


@dataclass(frozen=True)
class Role:
    id: str
    label: str
    description: str            # shown in the UI and fed to the classifier
    uses_cheap_model: bool = False


ROLES: dict[str, Role] = {r.id: r for r in [
    Role(
        "quick_chat", "Quick Chat",
        "casual conversation, greetings, quick everyday questions",
        uses_cheap_model=True,
    ),
    Role(
        "coding", "Coding",
        "writing, debugging, reviewing, or explaining code",
    ),
    Role(
        "research", "Research",
        "questions that need current information from the web or deep factual research",
    ),
    Role(
        "calculation", "Calculation & Reasoning",
        "math, logic puzzles, step-by-step analytical reasoning",
    ),
    Role(
        "creative_writing", "Creative Writing",
        "stories, poems, scripts, copywriting, creative brainstorming",
    ),
    Role(
        "agentic", "Agentic & Tools",
        "tasks that require actions: reading or writing files, exporting documents, "
        "searching the user's memory or notes",
    ),
]}


# ─── Persisted user assignments ───────────────────────────────────────────────

def _load_assignments() -> dict:
    try:
        with open(_ASSIGNMENTS_PATH) as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception as e:
        logger.warning(f"Could not read role assignments: {e}")
        return {}


def _save_assignments(assignments: dict) -> None:
    _ASSIGNMENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_ASSIGNMENTS_PATH, "w") as f:
        json.dump(assignments, f, indent=2)


def set_assignment(role_id: str, provider: str, model: str) -> None:
    assignments = _load_assignments()
    assignments[role_id] = {"provider": provider, "model": model}
    _save_assignments(assignments)


def clear_assignment(role_id: str) -> None:
    assignments = _load_assignments()
    if role_id in assignments:
        del assignments[role_id]
        _save_assignments(assignments)


# ─── Resolution ───────────────────────────────────────────────────────────────

def resolve_role(role_id: str | None) -> tuple[str, str] | None:
    """Return (provider, model) for a role — or for an unclassified message
    when role_id is None. Returns None only when no provider is configured."""
    if role_id in ROLES:
        override = _load_assignments().get(role_id)
        if override and override.get("model") and is_configured(override.get("provider", "")):
            return override["provider"], override["model"]

    dp = default_provider()
    if dp is None:
        return None
    if role_id in ROLES and ROLES[role_id].uses_cheap_model:
        return dp, cheap_model(dp)
    return dp, default_model(dp)


def roles_overview() -> dict:
    """Effective role→model table for the settings UI."""
    assignments = _load_assignments()
    overview = {}
    for role_id, role in ROLES.items():
        resolved = resolve_role(role_id)
        override = assignments.get(role_id)
        overview[role_id] = {
            "label": role.label,
            "description": role.description,
            "provider": resolved[0] if resolved else None,
            "model": resolved[1] if resolved else None,
            "overridden": bool(
                override and override.get("model") and is_configured(override.get("provider", ""))
            ),
        }
    return overview
