"""Action-based model router — classifies tasks and dispatches to the right tier."""
import httpx
import logging
from fastapi import HTTPException
from config import settings
from models.schemas import ChatRequest

logger = logging.getLogger(__name__)

TIER_SIGNALS = {
    "file_attached":       "file attached",
    "long_conversation":   "long conversation (15+ messages)",
    "web_search_enabled":  "web search enabled (→ T3)",
    "file_writer_enabled": "file writer enabled (→ T3)",
    "file_reader_enabled": "file reader enabled (→ T3)",
    "query_graph_enabled": "graph query enabled (→ T3)",
}

_LONG_CONTEXT_THRESHOLD = 15
_T3_TOOLS = {"web_search", "file_writer", "file_reader", "query_graph"}

_ANTHROPIC_VERSION = "2023-06-01"


def tier_model(tier: int) -> str:
    return {1: settings.tier1_model, 2: settings.tier2_model, 3: settings.tier3_model}.get(
        tier, settings.tier1_model
    )


def _is_anthropic() -> bool:
    return "anthropic.com" in settings.tier3_base_url


def classify_action(req: ChatRequest, history_length: int) -> tuple[int, list[str]]:
    tier, signals = 1, []

    if req.file_content:
        signals.append("file_attached")
        tier = max(tier, 2)

    if history_length >= _LONG_CONTEXT_THRESHOLD:
        signals.append("long_conversation")
        tier = max(tier, 2)

    for tool in _T3_TOOLS:
        if tool in req.tools_enabled:
            signals.append(f"{tool}_enabled")
            tier = max(tier, 3)

    if tier == 3 and not settings.tier3_api_key:
        tier = 2

    return tier, [TIER_SIGNALS.get(s, s) for s in signals]


async def dispatch(tier: int, messages: list[dict]) -> str:
    model = tier_model(tier)
    if tier == 3 and settings.tier3_api_key:
        if _is_anthropic():
            return await _call_anthropic(model, messages)
        return await _call_cloud(model, messages)
    return await _call_ollama(model, messages)


async def dispatch_with_tools(
    tier: int,
    messages: list[dict],
    tools: list[dict],
) -> tuple[str, list[dict]]:
    model = tier_model(tier)
    if tier == 3 and settings.tier3_api_key:
        if _is_anthropic():
            return await _call_anthropic_with_tools(model, messages, tools)
        return await _call_cloud_with_tools(model, messages, tools)
    return await _call_ollama_with_tools(model, messages, tools)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Split system message out of the messages list (required by Anthropic API)."""
    system = ""
    rest = []
    for msg in messages:
        if msg["role"] == "system":
            system = msg.get("content") or ""
        else:
            rest.append(msg)
    return system, rest


def _convert_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-style tool defs to Anthropic format."""
    result = []
    for tool in tools:
        fn = tool.get("function", {})
        result.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    return result


def _anthropic_error(status: int, body: str) -> HTTPException:
    logger.error("Anthropic API error %s: %s", status, body[:400])
    if status == 429:
        return HTTPException(503, "Claude API rate limit exceeded — try again in a moment.")
    if status in (401, 403):
        return HTTPException(503, "Claude API key rejected. Check TIER3_API_KEY in backend/.env.")
    return HTTPException(502, f"Claude API error {status}: {body[:200]}")


def _cloud_error(status: int, body: str) -> HTTPException:
    logger.error("Cloud API error %s: %s", status, body[:400])
    if status == 429:
        return HTTPException(503, "Gemini quota exceeded. Enable billing at ai.google.dev or switch to Claude.")
    if status in (401, 403):
        return HTTPException(503, f"Gemini API key rejected ({status}). Check TIER3_API_KEY in .env.")
    return HTTPException(502, f"Gemini API error {status}: {body[:200]}")


# ─── Ollama ────────────────────────────────────────────────────────────────────

async def _call_ollama(model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        r.raise_for_status()
        return r.json()["message"]["content"]


async def _call_ollama_with_tools(
    model: str, messages: list[dict], tools: list[dict]
) -> tuple[str, list[dict]]:
    payload = {"model": model, "messages": messages, "stream": False}
    if tools:
        payload["tools"] = tools
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        r.raise_for_status()
        msg = r.json()["message"]
        return msg.get("content") or "", msg.get("tool_calls") or []


# ─── Anthropic (Claude) ────────────────────────────────────────────────────────

async def _call_anthropic(model: str, messages: list[dict]) -> str:
    system, msgs = _extract_system(messages)
    payload: dict = {"model": model, "max_tokens": 4096, "messages": msgs}
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.tier3_api_key,
                "anthropic-version": _ANTHROPIC_VERSION,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if not r.is_success:
            raise _anthropic_error(r.status_code, r.text)
        blocks = r.json().get("content", [])
        return "\n".join(b["text"] for b in blocks if b.get("type") == "text")


async def _call_anthropic_with_tools(
    model: str, messages: list[dict], tools: list[dict]
) -> tuple[str, list[dict]]:
    system, msgs = _extract_system(messages)
    payload: dict = {"model": model, "max_tokens": 4096, "messages": msgs}
    if system:
        payload["system"] = system
    if tools:
        payload["tools"] = _convert_tools_to_anthropic(tools)

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.tier3_api_key,
                "anthropic-version": _ANTHROPIC_VERSION,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if not r.is_success:
            raise _anthropic_error(r.status_code, r.text)

    data = r.json()
    blocks = data.get("content", [])
    reply = "\n".join(b["text"] for b in blocks if b.get("type") == "text")

    # Normalise tool_use blocks to internal format {id, function: {name, arguments: dict}}
    tool_calls = [
        {"id": b["id"], "function": {"name": b["name"], "arguments": b["input"]}}
        for b in blocks
        if b.get("type") == "tool_use"
    ]
    return reply, tool_calls


# ─── OpenAI-compatible (Gemini / other) ───────────────────────────────────────

async def _call_cloud(model: str, messages: list[dict]) -> str:
    base = settings.tier3_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {settings.tier3_api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages},
        )
        if not r.is_success:
            raise _cloud_error(r.status_code, r.text)
        return r.json()["choices"][0]["message"]["content"]


async def _call_cloud_with_tools(
    model: str, messages: list[dict], tools: list[dict]
) -> tuple[str, list[dict]]:
    import json as _json
    base = settings.tier3_base_url.rstrip("/")
    payload = {"model": model, "messages": messages}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {settings.tier3_api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        if not r.is_success:
            raise _cloud_error(r.status_code, r.text)
    choice_msg = r.json()["choices"][0]["message"]
    content = choice_msg.get("content") or ""
    raw_calls = choice_msg.get("tool_calls") or []
    tool_calls = []
    for tc in raw_calls:
        fn = tc.get("function", {})
        raw_args = fn.get("arguments", "{}")
        args = raw_args if isinstance(raw_args, dict) else _json.loads(raw_args)
        tool_calls.append({"id": tc.get("id", ""), "function": {"name": fn.get("name", ""), "arguments": args}})
    return content, tool_calls
