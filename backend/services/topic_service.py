"""Extract topic tags from conversation turns using the default provider's
budget model — a small background job, so it always uses the cheap model."""
import json
import re
import logging
from services.router_service import default_provider, cheap_model, send

logger = logging.getLogger(__name__)

_PROMPT = """\
Extract 2-3 short topic tags from this conversation.
Reply with ONLY a JSON array of lowercase strings. No explanation, no markdown.
Example: ["python", "web scraping", "automation"]

User: {prompt}
ARIA: {response}

Tags:"""


async def extract_topics(prompt: str, response: str) -> list[str]:
    """Return 2-3 lowercase topic strings. Falls back to [] on any failure."""
    provider = default_provider()
    if provider is None:
        return []
    short_prompt = prompt[:200].replace("\n", " ")
    short_response = response[:200].replace("\n", " ")
    try:
        raw = await send(
            provider,
            cheap_model(provider),
            [{"role": "user", "content": _PROMPT.format(prompt=short_prompt, response=short_response)}],
            max_tokens=100,
            purpose="memory",
        )
        return _parse_topics(raw.strip())
    except Exception as e:
        logger.warning(f"Topic extraction failed: {e}")
        return []


def _parse_topics(raw: str) -> list[str]:
    """Try several strategies to extract a list of strings from model output."""
    # Strategy 1: parse as JSON directly
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return _clean(result)
    except json.JSONDecodeError:
        pass

    # Strategy 2: find a JSON array inside the string
    match = re.search(r'\[([^\]]+)\]', raw)
    if match:
        try:
            result = json.loads(f"[{match.group(1)}]")
            if isinstance(result, list):
                return _clean(result)
        except json.JSONDecodeError:
            pass

    # Strategy 3: extract quoted strings
    quoted = re.findall(r'"([^"]+)"|\'([^\']+)\'', raw)
    if quoted:
        return _clean([a or b for a, b in quoted])

    # Strategy 4: split on commas and clean up
    parts = [p.strip().strip('"\'[]').lower() for p in raw.split(",")]
    clean = [p for p in parts if 2 <= len(p) <= 40 and p.replace(" ", "").isalpha()]
    return clean[:3] if clean else []


def _clean(items: list) -> list[str]:
    result = []
    for item in items:
        s = str(item).lower().strip().strip('"\'')
        if 2 <= len(s) <= 40:
            result.append(s)
    return result[:3]
