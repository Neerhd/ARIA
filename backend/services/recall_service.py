"""Layer 3 recall — memory retrieval driven by the whole current moment.

Three upgrades over plain last-message similarity:
1. Cues: the recall query includes recent conversation turns (and, for
   voice, the active app + selection), so follow-ups like "what do you
   think about that?" recall what "that" is.
2. Scoring: candidates that pass the Layer-2 relevance bar are re-ranked
   like human memory — relevance × recency × how often they've mattered
   before (see memory_service.search_memory).
3. Time questions: retrospective phrasings ("yesterday", "last week",
   "3 days ago") get an exact date-window lookup over dated Episodes
   instead of hoping similarity stumbles onto the right day.
"""
import re
from datetime import datetime, timedelta

from services.memory_service import search_memory
from services.graph_service import get_episodes_in_range

_SNIPPET_CHARS = 160
_TIME_EPISODE_LIMIT = 6


def build_cues(
    message: str,
    history_texts: list[str] | None = None,
    extra_context: str | None = None,
) -> list[str]:
    """The message alone is always cue #1 (the Layer-2 relevance bar was
    calibrated on single messages); a second cue blends in recent turns and
    any app context so contextual matches can surface too."""
    cues = [message]
    context_parts = [t[:_SNIPPET_CHARS] for t in (history_texts or [])[-3:] if t]
    if extra_context:
        context_parts.append(extra_context[:400])
    if context_parts:
        cues.append("\n".join(context_parts + [message[:_SNIPPET_CHARS]]))
    return cues


# Retrospective time references only — "the 25th" in "what's the plan for
# the 25th" is about content, not about when a memory was stored, and is
# handled fine by semantic recall.
def parse_time_window(text: str) -> tuple[datetime, datetime, str] | None:
    """Return (start, end, label) in the user's local timezone, or None."""
    lower = text.lower()
    now = datetime.now().astimezone()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    m = re.search(r"\b(\d{1,2})\s*days?\s+ago\b", lower)
    if m:
        days = int(m.group(1))
        start = today_start - timedelta(days=days)
        return start, start + timedelta(days=1), f"{days} day(s) ago"
    if re.search(r"\byesterday\b|\blast night\b", lower):
        return today_start - timedelta(days=1), today_start, "yesterday"
    if re.search(r"\bearlier today\b|\bthis morning\b|\btoday\b", lower):
        return today_start, now, "today"
    if re.search(r"\bthis week\b", lower):
        week_start = today_start - timedelta(days=now.weekday())
        return week_start, now, "this week"
    if re.search(r"\blast week\b", lower):
        this_week_start = today_start - timedelta(days=now.weekday())
        return this_week_start - timedelta(days=7), this_week_start, "last week"
    if re.search(r"\blast month\b", lower):
        return today_start - timedelta(days=30), now, "the last month"
    return None


async def recall(
    message: str,
    project_id: str | None,
    history_texts: list[str] | None = None,
    extra_context: str | None = None,
    n_results: int = 3,
) -> dict:
    """Full Layer-3 recall. Returns:
    {memories, time_label, time_episodes} — time_* populated only when the
    message contains a retrospective time reference."""
    cues = build_cues(message, history_texts, extra_context)
    memories = search_memory(cues, project_id, n_results=n_results)

    time_label = None
    time_episodes: list[dict] = []
    window = parse_time_window(message)
    if window:
        start, end, time_label = window
        time_episodes = await get_episodes_in_range(
            start.isoformat(), end.isoformat(), project_id, limit=_TIME_EPISODE_LIMIT
        )

    return {
        "memories": memories,
        "time_label": time_label,
        "time_episodes": time_episodes,
    }


def format_time_block(time_label: str, time_episodes: list[dict]) -> str:
    """Render date-window episodes for the system prompt."""
    if not time_episodes:
        return (
            f"\n\nThe user asked about {time_label}, but there are no "
            "recorded conversations in that period — say so rather than guessing."
        )
    lines = []
    for e in time_episodes:
        date = (e.get("timestamp") or "")[:10] or "undated"
        prompt = (e.get("prompt") or "")[:200].replace("\n", " ")
        response = (e.get("response") or "")[:200].replace("\n", " ")
        lines.append(f"- [{date}] User: {prompt} → ARIA: {response}")
    return (
        f"\n\nConversations recorded {time_label} (exact, dated records):\n"
        + "\n".join(lines)
    )
