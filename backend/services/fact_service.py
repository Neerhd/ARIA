"""Layer 4 — auto-captured structured facts and the living profile.

After every exchange, a budget-model pass asks "did anything durable just
get said?" and stores results as categorized Facts in Neo4j — no magic
words needed. Facts with the same category + subject supersede older ones
(history kept; only the newest is believed). The profile builder renders
all active facts into the block injected into every chat and voice request,
replacing the old raw pinned-facts dump.
"""
import json
import logging
import re
import uuid

from services.router_service import default_provider, cheap_model, send
from services.graph_service import store_structured_fact, get_active_facts

logger = logging.getLogger(__name__)

CATEGORIES = {"person", "preference", "decision", "commitment", "thread", "other"}

_CATEGORY_HEADINGS = [
    ("person", "People in the user's life"),
    ("preference", "Preferences & style"),
    ("decision", "Decisions (and why)"),
    ("commitment", "Commitments & deadlines"),
    ("thread", "Open threads"),
    ("other", "Other"),
]

_MAX_PER_CATEGORY = 15
_MAX_FACTS_PER_EXCHANGE = 5

_EXTRACT_PROMPT = """\
Review this exchange and extract durable personal facts about the user \
worth remembering long-term. Most exchanges contain none — an empty list \
is the normal answer.

Categories:
- person: people in the user's life (names, relationships, key details)
- preference: lasting likes, dislikes, habits, working style
- decision: choices the user made, with the reasoning if given
- commitment: promises, deadlines, appointments — include dates
- thread: ongoing situations worth following up later
- other: durable personal facts fitting none of the above

Rules:
- Only durable information. Skip small talk, one-off task details, general
  knowledge, and anything about the assistant.
- subject: a short canonical key for the topic (e.g. "sister Priya",
  "current city", "job: startup offer"). Reuse identical phrasing for the
  same topic so newer facts can replace older ones.
- fact: one self-contained sentence; include dates when present.
- If the user corrects or updates something, output the new version.

Reply with ONLY a JSON array, no explanation:
[{"category": "...", "subject": "...", "fact": "..."}]

Exchange:
User: {user}
Assistant: {reply}"""


def _parse_facts(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0), strict=False)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    facts = []
    for item in data[:_MAX_FACTS_PER_EXCHANGE]:
        if not isinstance(item, dict):
            continue
        category = str(item.get("category") or "").strip().lower()
        subject = str(item.get("subject") or "").strip()[:60]
        fact = str(item.get("fact") or "").strip()[:300]
        if category in CATEGORIES and subject and len(fact) >= 8:
            facts.append({"category": category, "subject": subject, "fact": fact})
    return facts


async def extract_and_store_facts(user_text: str, reply: str) -> None:
    """Background task after each exchange. Never raises."""
    provider = default_provider()
    if provider is None:
        return
    try:
        # Show the extractor which subjects already exist so updates reuse
        # the exact phrasing and supersede cleanly.
        existing = await get_active_facts()
        subjects = sorted({f["subject"] for f in existing if f.get("subject")})[-40:]
        subject_note = (
            "\nExisting subjects — reuse the EXACT phrasing if a fact updates "
            "one of these: " + "; ".join(subjects) if subjects else ""
        )
        # .replace, not .format — the JSON example in the prompt contains
        # literal braces that .format would treat as placeholders.
        prompt = (
            _EXTRACT_PROMPT
            .replace("{user}", user_text[:1500])
            .replace("{reply}", reply[:1000])
            + subject_note
        )
        raw = await send(
            provider,
            cheap_model(provider),
            [{"role": "user", "content": prompt}],
            max_tokens=400,
            purpose="memory",
        )
        facts = _parse_facts(raw)
        for f in facts:
            await store_structured_fact(
                str(uuid.uuid4()), f["category"], f["subject"], f["fact"],
                raw_message=user_text[:500],
            )
        if facts:
            logger.info(f"Auto-captured {len(facts)} fact(s): "
                        + ", ".join(f["subject"] for f in facts))
    except Exception as e:
        logger.warning(f"Fact extraction failed: {e}")


async def build_profile_context() -> str:
    """The living profile block injected into every chat/voice request.
    Returns "" when nothing is known yet."""
    facts = await get_active_facts()
    if not facts:
        return ""
    pinned = [f for f in facts if f.get("user_pinned")]
    groups: dict[str, list[dict]] = {}
    for f in facts:
        if f.get("user_pinned"):
            continue
        groups.setdefault(f.get("category") or "other", []).append(f)

    lines = [
        "\n\nUser profile — facts ARIA maintains about the user from past "
        "conversations. Treat these as current truth (newer facts have "
        "already superseded older ones):"
    ]
    if pinned:
        lines.append("Pinned by the user (highest priority):")
        lines.extend(f"- {f['text']}" for f in pinned)
    for category, heading in _CATEGORY_HEADINGS:
        items = groups.get(category)
        if not items:
            continue
        lines.append(f"{heading}:")
        for f in items[-_MAX_PER_CATEGORY:]:
            date = (f.get("created_at") or "")[:10]
            lines.append(f"- [{date}] {f['text']}")
    return "\n".join(lines)
