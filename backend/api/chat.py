from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import (
    ChatRequest, ChatResponse, ConversationOut, ConversationUpdate, MessageOut,
    Conversation, Message, RoutingLog, Project,
)
from database.sqlite import get_db
from services.memory_service import store_memory, bump_recall_counts
from services.recall_service import recall, format_memory_block, format_time_block
from services.graph_service import (
    store_episode, store_concepts, link_to_previous, reinforce,
    store_fact, get_pinned_facts, get_episodes_by_ids,
)
from services.project_service import get_or_create_default_project
from services.topic_service import extract_topics
from services.fact_service import extract_and_store_facts, build_profile_context
from services.router_service import default_provider, default_model, is_configured, PROVIDERS
from services.role_service import resolve_role
from services.role_classifier_service import classify_role
from services.tool_service import run_agentic_loop, build_tool_instruction, ALL_TOOLS
import uuid
import json
import re
import logging

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are ARIA, an Adaptive Reasoning Intelligence Assistant. "
    "You are a helpful, thoughtful, and concise personal AI assistant. "
    "You have access to the user's conversation history and can reference past context. "
    "Your replies are rendered as Markdown — use headings, bullet or numbered lists, tables, "
    "code blocks (with a language tag), and bold/italic emphasis whenever they genuinely "
    "improve clarity (e.g. comparisons, steps, structured data, code). Don't force structure "
    "onto a short conversational reply that reads better as plain prose."
    "\n\nMemory grounding: any claim about the user's past conversations, "
    "preferences, or personal facts must be backed by the pinned facts, the "
    "retrieved memories provided to you, or a query_graph result. If none of "
    "those contain it, say you don't have it in your memory — never invent a "
    "recollection. When citing a memory, you may mention its date. General "
    "world knowledge is unaffected by this rule."
)

# Matches phrases like "remember this", "save that", "don't forget", etc.
_REMEMBER_RE = re.compile(
    r"^\s*"
    r"(remember\s+(this|that|:|this:?|that:?)?|"
    r"save\s+(this|that)|"
    r"don'?t\s+forget[:\s]|"
    r"keep\s+in\s+mind[:\s]|"
    r"note\s+that[:\s]|"
    r"please\s+remember[:\s]?)",
    re.IGNORECASE,
)


def _extract_fact(text: str) -> str | None:
    """Return the fact substring if the message is a remember request, else None."""
    m = _REMEMBER_RE.match(text)
    if not m:
        return None
    fact = text[m.end():].strip(" .,:;—-–\n")
    return fact if len(fact) >= 3 else None


async def _resolve_project_id(db: AsyncSession, project_id: str | None) -> str:
    """Return project_id if it names a real project, else the Default project's id."""
    if project_id:
        result = await db.execute(select(Project).where(Project.id == project_id))
        if result.scalar_one_or_none():
            return project_id
        raise HTTPException(404, f"Project {project_id} not found")
    return await get_or_create_default_project(db)


# ─── Background episodic memory pipeline ──────────────────────────────────────

async def _store_episode_memory(episode_id, conversation_id, prompt, response, project_id):
    ok = await store_episode(episode_id, conversation_id, prompt, response, project_id)
    if not ok:
        return
    await link_to_previous(episode_id, conversation_id)
    topics = await extract_topics(prompt, response)
    logger.info(f"Episode {episode_id[:8]} topics: {topics}")
    if topics:
        await store_concepts(episode_id, topics)


# ─── Chat endpoint ─────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def send_message(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user_text = req.effective_message()
    if not user_text:
        raise HTTPException(422, "Provide a message or attach a file.")

    # ── Determine routing ──────────────────────────────────────────────────────
    # "ask" mode was retired with the tier system — treat it as auto.
    routing_mode = req.routing_mode or "auto"
    if routing_mode == "ask":
        routing_mode = "auto"

    # ── Create or load conversation ────────────────────────────────────────────
    # A new conversation's project_id comes from the request, falling back to the
    # Default project if omitted. An existing conversation keeps the project_id
    # it was created with — a later, mismatched req.project_id never re-scopes it.
    if req.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == req.conversation_id)
        )
        convo = result.scalar_one_or_none()
        if not convo:
            # Pre-generated ID from a permission_required flow — create it now
            title = req.file_name or user_text[:60]
            project_id = await _resolve_project_id(db, req.project_id)
            convo = Conversation(id=req.conversation_id, title=title, project_id=project_id)
            db.add(convo)
            await db.flush()
    else:
        title = req.file_name or user_text[:60]
        project_id = await _resolve_project_id(db, req.project_id)
        convo = Conversation(id=str(uuid.uuid4()), title=title, project_id=project_id)
        db.add(convo)
        await db.flush()

    # ── Load recent conversation history ───────────────────────────────────────
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # ── Resolve provider & model ───────────────────────────────────────────────
    # A manual pick (override_provider + override_model) bypasses classification
    # entirely. Otherwise Auto classifies the message into a task role and
    # routes to whatever model that role is assigned to. Manual mode without a
    # pick uses the default model — predictable, no classifier call.
    if default_provider() is None:
        raise HTTPException(
            503,
            "No AI provider configured. Add at least one API key "
            "(e.g. ANTHROPIC_API_KEY) to backend/.env and restart ARIA.",
        )

    role: str | None = None
    if req.override_provider and req.override_model:
        if req.override_provider not in PROVIDERS:
            raise HTTPException(404, f"Unknown provider: {req.override_provider}")
        if not is_configured(req.override_provider):
            raise HTTPException(
                503,
                f"{PROVIDERS[req.override_provider].label} is not configured — "
                "add its API key in Settings first.",
            )
        routing_mode = "manual"
        provider, model = req.override_provider, req.override_model
    elif routing_mode == "manual":
        provider = default_provider()
        model = default_model(provider)
    else:
        role = await classify_role(user_text, bool(req.file_content))
        provider, model = resolve_role(role)
        logger.info(f"Routing: role={role or 'unclassified'} → {provider}:{model}")

    # ── Detect "remember" intent and queue fact storage ────────────────────────
    new_fact_text = _extract_fact(user_text)
    if new_fact_text:
        fact_id = str(uuid.uuid4())
        background_tasks.add_task(store_fact, fact_id, new_fact_text, user_text)
        logger.info(f"Pinning new fact: {new_fact_text[:80]}")

    # ── Layer-3 recall: cues from the whole moment + time-window lookups ──────
    recall_result = await recall(
        user_text,
        convo.project_id,
        history_texts=[m.content for m in history],
        n_results=3,
    )
    memories = recall_result["memories"]
    recalled_ids = [m["id"] for m in memories if m.get("id")]
    if recalled_ids:
        background_tasks.add_task(reinforce, recalled_ids)
        background_tasks.add_task(bump_recall_counts, recalled_ids)

    memory_context = format_memory_block(memories, "message")

    if recall_result["time_label"]:
        memory_context += format_time_block(
            recall_result["time_label"], recall_result["time_episodes"]
        )

    # ── Inject the living profile (Layer 4 — replaces the pinned-facts dump) ──
    profile_context = await build_profile_context()
    memory_context = profile_context + memory_context
    pinned_facts = await get_pinned_facts()  # provenance citations only

    # ── Build lean provenance for this reply (M14) — surfaces what was already
    # retrieved above, no new retrieval, no full prompt/response text ─────────
    sources: list[dict] = []
    # Date-window episodes are exact records — cite them like recalled ones.
    for e in recall_result["time_episodes"]:
        prompt = e.get("prompt") or ""
        sources.append({
            "type": "episode",
            "ref_id": e["id"],
            "label": prompt[:80] + ("…" if len(prompt) > 80 else ""),
            "timestamp": e.get("timestamp"),
        })
    time_episode_ids = {e["id"] for e in recall_result["time_episodes"]}
    if recalled_ids:
        episodes = await get_episodes_by_ids(
            [i for i in recalled_ids if i not in time_episode_ids]
        )
        episode_ids = {e["id"] for e in episodes}
        for e in episodes:
            prompt = e.get("prompt") or ""
            sources.append({
                "type": "episode",
                "ref_id": e["id"],
                "label": prompt[:80] + ("…" if len(prompt) > 80 else ""),
                "timestamp": e.get("timestamp"),
            })
        # Recalled reflections aren't Episode nodes — cite them from their
        # Chroma metadata instead.
        for m in memories:
            meta = m.get("metadata") or {}
            if m["id"] not in episode_ids and meta.get("type") == "reflection":
                text = m.get("text") or ""
                sources.append({
                    "type": "reflection",
                    "ref_id": m["id"],
                    "label": text[:80] + ("…" if len(text) > 80 else ""),
                    "timestamp": meta.get("timestamp"),
                })
    for f in pinned_facts:
        text = f.get("text") or ""
        sources.append({
            "type": "fact",
            "ref_id": f["id"],
            "label": text[:80] + ("…" if len(text) > 80 else ""),
            "timestamp": f.get("created_at"),
        })

    # ── If this is a remember request, guide ARIA to acknowledge it ───────────
    if new_fact_text:
        memory_context += (
            f"\n\n[System: The user asked you to permanently remember: \"{new_fact_text}\". "
            "Briefly confirm you've saved it to permanent memory — one sentence is enough.]"
        )

    # ── Tool-capability instruction (overrides trained refusals) ──────────────
    # Tools are always available — the model decides per-message whether one
    # is actually relevant via function-calling, same as any other capability.
    tools_enabled = ALL_TOOLS
    tool_instruction = build_tool_instruction(tools_enabled)

    # ── Build messages for the model ───────────────────────────────────────────
    if req.file_content:
        label = req.file_name or "attached file"
        user_turn = f"{user_text}\n\n[File attached: {label}]\n```\n{req.file_content}\n```"
    else:
        user_turn = user_text

    messages = [{"role": "system", "content": SYSTEM_PROMPT + tool_instruction + memory_context}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_turn})

    # ── Call the model — always via the agentic loop, since tools are always
    #    available; the model itself decides whether to invoke one. ──────────
    reply, tools_used = await run_agentic_loop(
        provider, model, messages, tools_enabled, convo.project_id, role=role
    )

    # ── Persist to SQLite ──────────────────────────────────────────────────────
    stored_user_content = user_text
    if req.file_name:
        stored_user_content += f"\n[Attached: {req.file_name}]"

    episode_id = str(uuid.uuid4())

    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=convo.id,
        role="user",
        content=stored_user_content,
    )
    assistant_msg = Message(
        id=episode_id,
        conversation_id=convo.id,
        role="assistant",
        content=reply,
    )
    routing_log = RoutingLog(
        id=str(uuid.uuid4()),
        message_id=episode_id,
        conversation_id=convo.id,
        routing_mode=routing_mode,
        role=role or "",
        model_used=f"{provider}:{model}",
        signals=json.dumps([]),
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.add(routing_log)
    await db.commit()

    # ── Store in ChromaDB ──────────────────────────────────────────────────────
    store_memory(
        f"User: {stored_user_content}\nARIA: {reply}",
        {"conversation_id": convo.id, "project_id": convo.project_id, "type": "exchange"},
        entry_id=episode_id,
    )

    # ── Fire-and-forget: write Episode + Concepts to Neo4j ────────────────────
    background_tasks.add_task(
        _store_episode_memory,
        episode_id,
        convo.id,
        stored_user_content,
        reply,
        convo.project_id,
    )

    # ── Layer 4 auto-capture — skipped when "remember this" already pinned
    # the fact verbatim ────────────────────────────────────────────────────────
    if not new_fact_text:
        background_tasks.add_task(extract_and_store_facts, user_text, reply)

    return ChatResponse(
        reply=reply,
        conversation_id=convo.id,
        message_id=episode_id,
        model=model,
        provider=provider,
        role=role,
        tools_used=tools_used,
        sources=sources,
    )


# ─── Conversation list / history ──────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(project_id: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Conversation).order_by(Conversation.pinned.desc(), Conversation.updated_at.desc()).limit(50)
    if project_id:
        query = query.where(Conversation.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(conversation_id: str, body: ConversationUpdate, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if body.pinned is not None:
        convo.pinned = body.pinned
    await db.commit()
    await db.refresh(convo)
    return convo


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()
