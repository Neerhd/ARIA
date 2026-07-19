"""Voice command endpoint — Hush's command mode posts here.

A voice command is a single request/response: Hush sends the transcript plus
context about where the user is (active app, selected text); ARIA answers
with paste-ready text. Routing skips the role classifier — a voice command
is agentic by nature and latency-sensitive — and uses the Agentic role's
assigned model. Commands land in a rolling "Voice Commands" conversation in
the Default project so they enter memory like normal chat.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.sqlite import get_db
from models.schemas import Conversation, Message
from services.memory_service import store_memory
from services.recall_service import recall, format_time_block
from services.graph_service import get_pinned_facts
from services.project_service import get_or_create_default_project
from services.role_service import resolve_role
from services.router_service import default_provider
from services.tool_service import run_agentic_loop, ALL_TOOLS
from api.chat import _store_episode_memory
import uuid
import logging

router = APIRouter(prefix="/voice", tags=["voice"])
logger = logging.getLogger(__name__)

_VOICE_CONVERSATION_TITLE = "Voice Commands"

_SYSTEM_PROMPT = (
    "You are ARIA, responding to a spoken command relayed from the user's "
    "computer. Your reply is pasted directly into the app the user is "
    "currently using, so output ONLY the content to paste — no preamble, no "
    "meta-commentary about what you did, no code fences around the whole "
    "reply. Match the target app: plain prose for an email draft, a tidy "
    "list for notes. The transcript comes from speech recognition, so "
    "tolerate small mis-transcriptions and infer the intended words. "
    "Memory grounding: any claim about the user's past conversations, "
    "preferences, or personal facts must be backed by the pinned facts, "
    "retrieved memories, or a query_graph result — if none contain it, say "
    "you don't have it in your memory rather than inventing a recollection."
)

_TOOL_NOTE = (
    "\n\nYou have tools and MUST use them when the command calls for them: "
    "web_search (current information), file_reader / file_writer (local "
    "files), calendar (the user's upcoming schedule and availability), "
    "query_graph (what the user discussed before). Never claim you cannot "
    "do something one of these tools can do."
)


class VoiceCommandRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=4000)
    active_app_name: Optional[str] = None
    selection_snapshot: Optional[str] = Field(None, max_length=16000)
    timestamp: Optional[str] = None  # accepted for forward-compat, not stored yet


class VoiceCommandResponse(BaseModel):
    reply: str
    provider: str
    model: str
    tools_used: list[str] = []


async def _get_or_create_voice_conversation(db: AsyncSession) -> Conversation:
    result = await db.execute(
        select(Conversation).where(Conversation.title == _VOICE_CONVERSATION_TITLE)
    )
    convo = result.scalars().first()
    if convo:
        return convo
    project_id = await get_or_create_default_project(db)
    convo = Conversation(
        id=str(uuid.uuid4()), title=_VOICE_CONVERSATION_TITLE, project_id=project_id
    )
    db.add(convo)
    await db.flush()
    return convo


@router.post("/command", response_model=VoiceCommandResponse)
async def voice_command(
    req: VoiceCommandRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if default_provider() is None:
        raise HTTPException(
            503,
            "No AI provider configured. Add an API key in ARIA's Settings first.",
        )
    # The dedicated voice role defaults to the budget model — voice is
    # latency-sensitive — and is reassignable in Settings → Task Roles.
    provider, model = resolve_role("voice")

    convo = await _get_or_create_voice_conversation(db)

    # Layer-3 recall across ALL projects — a voice command arrives with no
    # project context, and fencing it into the Default project would hide
    # the user's real memories. The active app + selection join the recall
    # cues: asking "how should I reply?" in Mail recalls mail-related memory.
    extra_context = None
    if req.active_app_name or req.selection_snapshot:
        extra_context = f"{req.active_app_name or ''}: {(req.selection_snapshot or '')[:300]}"
    recall_result = await recall(
        req.transcript, None, extra_context=extra_context, n_results=3
    )
    memories = recall_result["memories"]
    memory_context = ""
    if memories:
        lines = []
        for m in memories:
            meta = m.get("metadata") or {}
            date = (meta.get("timestamp") or "")[:10] or "undated"
            kind = "Reflection" if meta.get("type") == "reflection" else "Past exchange"
            lines.append(f"- [{date}] ({kind}) {m['text']}")
        memory_context = (
            "\nMemories retrieved for this command — the only source of truth "
            "about past conversations:\n" + "\n".join(lines)
        )

    if recall_result["time_label"]:
        memory_context += format_time_block(
            recall_result["time_label"], recall_result["time_episodes"]
        )
    pinned_facts = await get_pinned_facts()
    if pinned_facts:
        lines = "\n".join(f"- {f['text']}" for f in pinned_facts)
        memory_context = f"\n\nPinned facts (always remember these):\n{lines}" + memory_context

    context_lines = []
    if req.active_app_name:
        context_lines.append(f"The user is currently in the app: {req.active_app_name}")
    if req.selection_snapshot:
        context_lines.append(
            "Selected/focused content in that app (may be what the command "
            f"refers to as 'this'):\n---\n{req.selection_snapshot}\n---"
        )
    context_block = ("\n\n" + "\n".join(context_lines)) if context_lines else ""

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT + _TOOL_NOTE + context_block + memory_context},
        {"role": "user", "content": req.transcript},
    ]

    # project_id=None gives the query_graph tool all-projects scope too.
    reply, tools_used = await run_agentic_loop(
        provider, model, messages, ALL_TOOLS, None, role="agentic"
    )

    # Persist like a chat turn so voice commands are browsable and remembered.
    episode_id = str(uuid.uuid4())
    stored_prompt = f"[voice · {req.active_app_name or 'unknown app'}] {req.transcript}"
    db.add(Message(id=str(uuid.uuid4()), conversation_id=convo.id, role="user", content=stored_prompt))
    db.add(Message(id=episode_id, conversation_id=convo.id, role="assistant", content=reply))
    await db.commit()

    store_memory(
        f"User (voice): {req.transcript}\nARIA: {reply}",
        {"conversation_id": convo.id, "project_id": convo.project_id, "type": "exchange"},
        entry_id=episode_id,
    )
    background_tasks.add_task(
        _store_episode_memory, episode_id, convo.id, stored_prompt, reply, convo.project_id
    )

    return VoiceCommandResponse(
        reply=reply, provider=provider, model=model, tools_used=tools_used
    )
