"""Tool definitions, executors, and the agentic tool-call loop."""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_MAX_FILE_CHARS = 50_000
_MAX_TOOL_ROUNDS = 5

# ─── Tool schema definitions (OpenAI / Ollama format) ─────────────────────────

_TOOL_DEFS = {
    "file_reader": {
        "type": "function",
        "function": {
            "name": "file_reader",
            "description": (
                "Read the text contents of a local file given its absolute path. "
                "Use this when the user asks you to read, open, or look at a specific file."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file (e.g. /Users/alice/notes.txt).",
                    }
                },
                "required": ["path"],
            },
        },
    },
    "file_writer": {
        "type": "function",
        "function": {
            "name": "file_writer",
            "description": (
                "Write text content to a local file at a given absolute path. "
                "Creates the file and any missing parent directories automatically. "
                "Use this when the user asks you to save, create, write, or export a file."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path where the file should be written (e.g. /Users/alice/Desktop/notes.txt).",
                    },
                    "content": {
                        "type": "string",
                        "description": "The full text content to write into the file.",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    "web_search": {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web using the local SearXNG instance and return relevant results. "
                "Use this for current events, facts you don't know, or anything that needs up-to-date information."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up.",
                    }
                },
                "required": ["query"],
            },
        },
    },
}


def build_tool_definitions(tools_enabled: list[str]) -> list[dict]:
    """Return Ollama/OpenAI tool definition objects for the enabled tool names."""
    return [_TOOL_DEFS[t] for t in tools_enabled if t in _TOOL_DEFS]


# ─── Tool executors ────────────────────────────────────────────────────────────

async def _exec_file_reader(args: dict) -> str:
    path_str = args.get("path", "").strip()
    if not path_str:
        return "Error: no path provided."
    p = Path(path_str).expanduser()
    if not p.exists():
        return f"Error: file not found: {path_str}"
    if not p.is_file():
        return f"Error: not a regular file: {path_str}"
    try:
        text = p.read_text(errors="replace")
        if len(text) > _MAX_FILE_CHARS:
            text = text[:_MAX_FILE_CHARS] + f"\n\n[...truncated at {_MAX_FILE_CHARS} characters]"
        return text
    except Exception as e:
        return f"Error reading file: {e}"


async def _exec_web_search(args: dict) -> str:
    from services.web_search_service import web_search
    query = args.get("query", "").strip()
    if not query:
        return "Error: no search query provided."
    results = await web_search(query)
    if not results:
        return "No search results found."
    lines = []
    for i, r in enumerate(results, 1):
        if "error" in r:
            return r["error"]
        lines.append(f"{i}. {r['title']}\n   {r['url']}\n   {r['snippet']}")
    return "\n\n".join(lines)


async def _exec_file_writer(args: dict) -> str:
    path_str = args.get("path", "").strip()
    content = args.get("content", "")
    if not path_str:
        return "Error: no path provided."
    p = Path(path_str).expanduser()
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"File written successfully: {p} ({len(content):,} characters)"
    except Exception as e:
        return f"Error writing file: {e}"


async def execute_tool(name: str, args: dict) -> str:
    """Dispatch a tool call by name and return its string result."""
    if name == "file_reader":
        return await _exec_file_reader(args)
    if name == "file_writer":
        return await _exec_file_writer(args)
    if name == "web_search":
        return await _exec_web_search(args)
    return f"Unknown tool: {name}"


# ─── Agentic loop ──────────────────────────────────────────────────────────────

def _parse_args(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}


async def run_agentic_loop(
    tier: int,
    messages: list[dict],
    tools_enabled: list[str],
) -> tuple[str, list[str]]:
    """
    Run the model with tool-call support. Loops until the model returns a plain
    text reply with no pending tool calls. Returns (reply, tool_names_used).
    Falls back to a single plain dispatch if tools_enabled is empty.
    """
    from services.router_service import dispatch, dispatch_with_tools

    if not tools_enabled:
        return await dispatch(tier, messages), []

    tool_defs = build_tool_definitions(tools_enabled)
    tool_names_used: list[str] = []
    current_messages = list(messages)

    for _ in range(_MAX_TOOL_ROUNDS):
        reply, tool_calls = await dispatch_with_tools(tier, current_messages, tool_defs)

        if not tool_calls:
            return reply, tool_names_used

        # Append the assistant turn that contained the tool calls
        current_messages.append({
            "role": "assistant",
            "content": reply or "",
            "tool_calls": tool_calls,
        })

        for call in tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            args = _parse_args(fn.get("arguments", {}))

            logger.info(f"Tool call: {name}({list(args.keys())})")
            tool_names_used.append(name)
            result = await execute_tool(name, args)
            logger.info(f"Tool result [{name}]: {result[:120]}")

            current_messages.append({
                "role": "tool",
                "content": result,
                "name": name,
            })

    # Safety fallback: one final call without tools to get a closing reply
    reply, _ = await dispatch_with_tools(tier, current_messages, [])
    return reply, tool_names_used
