"""Multi-provider model router — one dispatch interface over every supported
AI provider. Two wire formats cover all five providers: Anthropic's native
Messages API, and the OpenAI-compatible chat-completions API (OpenAI, Google,
xAI, Perplexity)."""
import httpx
import json
import logging
from dataclasses import dataclass
from fastapi import HTTPException
from config import settings

logger = logging.getLogger(__name__)

_ANTHROPIC_VERSION = "2023-06-01"

# One shared client with connection pooling — a client per request would
# pay TCP+TLS setup on every model call. Closed via close_http_client()
# in main's lifespan shutdown.
_http_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=120.0)
    return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    api: str                 # "anthropic" | "openai_compat"
    base_url: str
    key_setting: str         # attribute on settings holding this provider's API key
    models: tuple            # ((model_id, human label), ...) — strong model first, budget model second
    supports_tools: bool = True
    supports_vision: bool = False
    key_url: str = ""        # where the user creates an API key

    @property
    def default_model(self) -> str:
        return self.models[0][0]

    @property
    def cheap_model(self) -> str:
        return self.models[-1][0]


PROVIDERS: dict[str, Provider] = {p.id: p for p in [
    Provider(
        id="anthropic", label="Anthropic (Claude)", api="anthropic",
        base_url="https://api.anthropic.com/v1",
        key_setting="anthropic_api_key",
        models=(("claude-sonnet-5", "Claude Sonnet"), ("claude-haiku-4-5", "Claude Haiku")),
        supports_vision=True,
        key_url="https://console.anthropic.com",
    ),
    Provider(
        id="openai", label="OpenAI (GPT)", api="openai_compat",
        base_url="https://api.openai.com/v1",
        key_setting="openai_api_key",
        models=(("gpt-5.1", "GPT-5.1"), ("gpt-5-mini", "GPT-5 mini")),
        supports_vision=True,
        key_url="https://platform.openai.com",
    ),
    Provider(
        id="google", label="Google (Gemini)", api="openai_compat",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        key_setting="google_api_key",
        models=(("gemini-2.5-pro", "Gemini Pro"), ("gemini-2.5-flash", "Gemini Flash")),
        supports_vision=True,
        key_url="https://aistudio.google.com",
    ),
    Provider(
        id="xai", label="xAI (Grok)", api="openai_compat",
        base_url="https://api.x.ai/v1",
        key_setting="xai_api_key",
        models=(("grok-4", "Grok 4"), ("grok-4-fast", "Grok Fast")),
        # Not confirmed against xAI's current API — left conservative
        # (text-only) rather than asserting vision support unverified.
        supports_vision=False,
        key_url="https://console.x.ai",
    ),
    Provider(
        id="perplexity", label="Perplexity", api="openai_compat",
        base_url="https://api.perplexity.ai",
        key_setting="perplexity_api_key",
        models=(("sonar-pro", "Sonar Pro"), ("sonar", "Sonar")),
        supports_tools=False,  # sonar models don't do function calling
        supports_vision=False,  # not confirmed — left conservative, see xai note above
        key_url="https://www.perplexity.ai/settings/api",
    ),
]}

# Order used to pick the default provider — first configured wins. Perplexity
# is last because it can't drive tools, making it a poor everything-provider.
_DEFAULT_PRIORITY = ["anthropic", "openai", "google", "xai", "perplexity"]


def api_key_for(provider_id: str) -> str:
    """Stored key (added via the Settings UI) wins over an .env key."""
    from services.key_store import stored_key
    return stored_key(provider_id) or getattr(settings, PROVIDERS[provider_id].key_setting, "") or ""


def is_configured(provider_id: str) -> bool:
    return bool(api_key_for(provider_id))


def configured_providers() -> list[str]:
    return [pid for pid in _DEFAULT_PRIORITY if is_configured(pid)]


def default_provider() -> str | None:
    """Whichever provider the user connected first, in priority order —
    'your first key becomes the default'."""
    configured = configured_providers()
    return configured[0] if configured else None


def default_model(provider_id: str) -> str:
    return PROVIDERS[provider_id].default_model


def cheap_model(provider_id: str) -> str:
    return PROVIDERS[provider_id].cheap_model


def supports_tools(provider_id: str) -> bool:
    return PROVIDERS[provider_id].supports_tools


def supports_vision(provider_id: str) -> bool:
    return PROVIDERS[provider_id].supports_vision


def is_anthropic(provider_id: str) -> bool:
    return PROVIDERS[provider_id].api == "anthropic"


# ─── Dispatch ──────────────────────────────────────────────────────────────────

async def send(
    provider_id: str, model: str, messages: list[dict], max_tokens: int = 4096,
    purpose: str = "other", role: str = "",
) -> str:
    """Send a chat request and return the assistant's text reply."""
    provider = _require_configured(provider_id)
    messages = _prepare_messages(messages, provider.api)
    if provider.api == "anthropic":
        text, usage = await _call_anthropic(provider, model, messages, max_tokens)
    else:
        text, usage = await _call_openai_compat(provider, model, messages)
    await _record_usage(provider_id, model, usage, purpose, role)
    return text


async def send_with_tools(
    provider_id: str, model: str, messages: list[dict], tools: list[dict],
    max_tokens: int = 4096, purpose: str = "other", role: str = "",
) -> tuple[str, list[dict]]:
    """Send a chat request with tool definitions. Returns (reply, tool_calls),
    tool_calls normalised to {id, function: {name, arguments: dict}}."""
    provider = _require_configured(provider_id)
    messages = _prepare_messages(messages, provider.api)
    if provider.api == "anthropic":
        reply, tool_calls, usage = await _call_anthropic_with_tools(provider, model, messages, tools, max_tokens)
    else:
        reply, tool_calls, usage = await _call_openai_compat_with_tools(provider, model, messages, tools)
    await _record_usage(provider_id, model, usage, purpose, role)
    return reply, tool_calls


async def _record_usage(
    provider_id: str, model: str, usage: dict | None, purpose: str, role: str
) -> None:
    """Normalise the provider's usage block and log it. Never raises."""
    from services.usage_service import record_usage

    usage = usage or {}
    input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or 0
    output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or 0
    await record_usage(provider_id, model, purpose, role, input_tokens, output_tokens)


def _require_configured(provider_id: str) -> Provider:
    provider = PROVIDERS.get(provider_id)
    if provider is None:
        raise HTTPException(500, f"Unknown provider: {provider_id}")
    if not api_key_for(provider_id):
        raise HTTPException(
            503,
            f"{provider.label} is not configured — add {provider.key_setting.upper()} "
            "to backend/.env (create a key at " + provider.key_url + ").",
        )
    return provider


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


def _prepare_messages(messages: list[dict], api: str) -> list[dict]:
    """Translate the universal message format into a provider's exact wire
    shape. A message's content is either a plain string (the common case,
    untouched here) or a list of blocks — currently only produced when an
    image is attached: [{"type": "text", "text": ...},
    {"type": "image", "media_type": ..., "data": <base64>}]."""
    out = []
    for msg in messages:
        content = msg.get("content")
        if not isinstance(content, list):
            out.append(msg)
            continue
        if api == "anthropic":
            blocks = [
                {"type": "image", "source": {"type": "base64", "media_type": b["media_type"], "data": b["data"]}}
                if b.get("type") == "image" else b
                for b in content
            ]
        else:
            blocks = [
                {"type": "image_url", "image_url": {"url": f"data:{b['media_type']};base64,{b['data']}"}}
                if b.get("type") == "image" else b
                for b in content
            ]
        out.append({**msg, "content": blocks})
    return out


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


def _provider_error(provider: Provider, status: int, body: str) -> HTTPException:
    logger.error("%s API error %s: %s", provider.label, status, body[:400])
    if status == 429:
        return HTTPException(503, f"{provider.label} rate limit exceeded — try again in a moment.")
    if status in (401, 403):
        return HTTPException(
            503,
            f"{provider.label} API key rejected ({status}). "
            f"Check {provider.key_setting.upper()} in backend/.env.",
        )
    return HTTPException(502, f"{provider.label} API error {status}: {body[:200]}")


# ─── Anthropic (native Messages API) ──────────────────────────────────────────

def _anthropic_headers(provider: Provider) -> dict:
    return {
        "x-api-key": api_key_for(provider.id),
        "anthropic-version": _ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }


async def _call_anthropic(
    provider: Provider, model: str, messages: list[dict], max_tokens: int
) -> tuple[str, dict]:
    system, msgs = _extract_system(messages)
    payload: dict = {"model": model, "max_tokens": max_tokens, "messages": msgs}
    if system:
        payload["system"] = system
    r = await _http().post(
        f"{provider.base_url}/messages",
        headers=_anthropic_headers(provider),
        json=payload,
    )
    if not r.is_success:
        raise _provider_error(provider, r.status_code, r.text)
    data = r.json()
    blocks = data.get("content", [])
    text = "\n".join(b["text"] for b in blocks if b.get("type") == "text")
    return text, data.get("usage") or {}


async def _call_anthropic_with_tools(
    provider: Provider, model: str, messages: list[dict], tools: list[dict],
    max_tokens: int,
) -> tuple[str, list[dict], dict]:
    system, msgs = _extract_system(messages)
    payload: dict = {"model": model, "max_tokens": max_tokens, "messages": msgs}
    if system:
        payload["system"] = system
    if tools:
        payload["tools"] = _convert_tools_to_anthropic(tools)

    r = await _http().post(
        f"{provider.base_url}/messages",
        headers=_anthropic_headers(provider),
        json=payload,
    )
    if not r.is_success:
        raise _provider_error(provider, r.status_code, r.text)

    data = r.json()
    blocks = data.get("content", [])
    reply = "\n".join(b["text"] for b in blocks if b.get("type") == "text")

    # Normalise tool_use blocks to internal format {id, function: {name, arguments: dict}}
    tool_calls = [
        {"id": b["id"], "function": {"name": b["name"], "arguments": b["input"]}}
        for b in blocks
        if b.get("type") == "tool_use"
    ]
    return reply, tool_calls, data.get("usage") or {}


# ─── OpenAI-compatible (OpenAI / Google / xAI / Perplexity) ───────────────────

def _openai_headers(provider: Provider) -> dict:
    return {
        "Authorization": f"Bearer {api_key_for(provider.id)}",
        "Content-Type": "application/json",
    }


async def _call_openai_compat(
    provider: Provider, model: str, messages: list[dict]
) -> tuple[str, dict]:
    r = await _http().post(
        f"{provider.base_url}/chat/completions",
        headers=_openai_headers(provider),
        json={"model": model, "messages": messages},
    )
    if not r.is_success:
        raise _provider_error(provider, r.status_code, r.text)
    data = r.json()
    return data["choices"][0]["message"]["content"] or "", data.get("usage") or {}


async def _call_openai_compat_with_tools(
    provider: Provider, model: str, messages: list[dict], tools: list[dict]
) -> tuple[str, list[dict], dict]:
    payload: dict = {"model": model, "messages": messages}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    r = await _http().post(
        f"{provider.base_url}/chat/completions",
        headers=_openai_headers(provider),
        json=payload,
    )
    if not r.is_success:
        raise _provider_error(provider, r.status_code, r.text)
    data = r.json()
    choice_msg = data["choices"][0]["message"]
    content = choice_msg.get("content") or ""
    raw_calls = choice_msg.get("tool_calls") or []
    tool_calls = []
    for tc in raw_calls:
        fn = tc.get("function", {})
        raw_args = fn.get("arguments", "{}")
        args = raw_args if isinstance(raw_args, dict) else json.loads(raw_args)
        tool_calls.append({"id": tc.get("id", ""), "function": {"name": fn.get("name", ""), "arguments": args}})
    return content, tool_calls, data.get("usage") or {}
