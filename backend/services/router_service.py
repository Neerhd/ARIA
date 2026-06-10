"""Action-based model router — classifies tasks and dispatches to the right tier."""
import httpx
import logging
from config import settings
from models.schemas import ChatRequest

logger = logging.getLogger(__name__)

TIER_SIGNALS = {
    "file_attached":      "file attached",
    "long_conversation":  "long conversation (15+ messages)",
    "web_search_enabled": "web search enabled (→ T3)",
}

_LONG_CONTEXT_THRESHOLD = 15


def tier_model(tier: int) -> str:
    """Return the configured model name for a tier."""
    return {
        1: settings.tier1_model,
        2: settings.tier2_model,
        3: settings.tier3_model,
    }.get(tier, settings.tier1_model)


def classify_action(req: ChatRequest, history_length: int) -> tuple[int, list[str]]:
    """
    Determine the appropriate tier based on observable context signals.
    Returns (tier, signal_labels). No LLM call — instant and deterministic.

    Tier 2 triggers:
      - A file is attached to the message
      - The conversation has 15+ prior messages

    Tier 3 triggers:
      - Web search tool is enabled (M6 signal)
      - Requires TIER3_API_KEY; falls back to Tier 2 if not configured.
    """
    tier, signals = 1, []

    if req.file_content:
        signals.append("file_attached")
        tier = max(tier, 2)

    if history_length >= _LONG_CONTEXT_THRESHOLD:
        signals.append("long_conversation")
        tier = max(tier, 2)

    if "web_search" in req.tools_enabled:
        signals.append("web_search_enabled")
        tier = max(tier, 3)

    # Tier 3 requires an API key; fall back gracefully
    if tier == 3 and not settings.tier3_api_key:
        tier = 2

    return tier, [TIER_SIGNALS.get(s, s) for s in signals]


async def dispatch(tier: int, messages: list[dict]) -> str:
    """Send messages to the model for the given tier and return the reply."""
    model = tier_model(tier)
    if tier == 3 and settings.tier3_api_key:
        return await _call_cloud(model, messages)
    return await _call_ollama(model, messages)


async def dispatch_with_tools(
    tier: int,
    messages: list[dict],
    tools: list[dict],
) -> tuple[str, list[dict]]:
    """
    Call the model with optional tool definitions.
    Returns (content, tool_calls) where tool_calls is [] if the model gave a plain reply.
    """
    model = tier_model(tier)
    if tier == 3 and settings.tier3_api_key:
        return await _call_cloud_with_tools(model, messages, tools)
    return await _call_ollama_with_tools(model, messages, tools)


async def _call_ollama(model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        r.raise_for_status()
        return r.json()["message"]["content"]


async def _call_ollama_with_tools(
    model: str,
    messages: list[dict],
    tools: list[dict],
) -> tuple[str, list[dict]]:
    """Ollama tool-calling. Returns (content, tool_calls)."""
    payload = {"model": model, "messages": messages, "stream": False}
    if tools:
        payload["tools"] = tools
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json=payload,
        )
        r.raise_for_status()
        msg = r.json()["message"]
        content = msg.get("content") or ""
        tool_calls = msg.get("tool_calls") or []
        return content, tool_calls


async def _call_cloud(model: str, messages: list[dict]) -> str:
    """Call a cloud model via OpenAI-compatible API (e.g. Google Gemini AI Studio)."""
    base = settings.tier3_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.tier3_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": model, "messages": messages},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _call_cloud_with_tools(
    model: str,
    messages: list[dict],
    tools: list[dict],
) -> tuple[str, list[dict]]:
    """OpenAI-compatible tool-calling for the cloud tier. Returns (content, tool_calls)."""
    base = settings.tier3_base_url.rstrip("/")
    payload = {"model": model, "messages": messages}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.tier3_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        choice_msg = r.json()["choices"][0]["message"]
        content = choice_msg.get("content") or ""
        raw_calls = choice_msg.get("tool_calls") or []
        # Normalise to Ollama-style {function: {name, arguments: dict}}
        tool_calls = []
        for tc in raw_calls:
            fn = tc.get("function", {})
            import json as _json
            raw_args = fn.get("arguments", "{}")
            args = raw_args if isinstance(raw_args, dict) else _json.loads(raw_args)
            tool_calls.append({
                "id": tc.get("id", ""),
                "function": {"name": fn.get("name", ""), "arguments": args},
            })
        return content, tool_calls
