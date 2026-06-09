"""Extract topic tags from conversation turns using the local Ollama model."""
import httpx
import json
import re
import logging
from config import settings

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
    short_prompt = prompt[:200].replace("\n", " ")
    short_response = response[:200].replace("\n", " ")
    payload = {
        "model": settings.ollama_model,
        "prompt": _PROMPT.format(prompt=short_prompt, response=short_response),
        "stream": False,
        "options": {"temperature": 0, "num_predict": 60},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            r.raise_for_status()
            raw = r.json().get("response", "").strip()
            return _parse_topics(raw)
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
