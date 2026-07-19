"""Classifies each Auto-mode message into a task role using the default
provider's budget model — a few hundred input tokens and ~1 output token per
call, so the cost is a fraction of a cent. Returns None on any failure; the
caller falls back to the default chat model, so classification can never
block a reply."""
import logging
from services.router_service import default_provider, cheap_model, send
from services.role_service import ROLES

logger = logging.getLogger(__name__)

_MAX_CLASSIFY_CHARS = 600


def _build_prompt(message: str, has_file: bool) -> str:
    categories = "\n".join(
        f"- {r.id}: {r.description}" for r in ROLES.values() if r.classifiable
    )
    file_note = "\n(The user attached a file to this message.)" if has_file else ""
    snippet = message[:_MAX_CLASSIFY_CHARS].replace("\n", " ")
    return (
        "Classify the user's message into exactly one of these categories:\n"
        f"{categories}\n\n"
        "Reply with ONLY the category id, nothing else.\n\n"
        f"Message: {snippet}{file_note}"
    )


def _parse(raw: str) -> str | None:
    text = raw.strip().lower()
    if text in ROLES and ROLES[text].classifiable:
        return text
    for role_id, role in ROLES.items():
        if role.classifiable and role_id in text:
            return role_id
    return None


async def classify_role(message: str, has_file: bool = False) -> str | None:
    provider = default_provider()
    if provider is None:
        return None
    try:
        raw = await send(
            provider,
            cheap_model(provider),
            [{"role": "user", "content": _build_prompt(message, has_file)}],
            max_tokens=16,
            purpose="classifier",
        )
        role = _parse(raw)
        if role is None:
            logger.warning(f"Role classifier returned unrecognised label: {raw!r}")
        return role
    except Exception as e:
        logger.warning(f"Role classification failed: {e}")
        return None
