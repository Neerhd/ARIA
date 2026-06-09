from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import (
    ChatRequest, ChatResponse, ConversationOut, MessageOut,
    Conversation, Message, RoutingLog,
)
from database.sqlite import get_db
from services.ollama_service import check_ollama_alive
from services.memory_service import store_memory, search_memory
from services.graph_service import store_episode, store_concepts, link_to_previous, reinforce
from services.topic_service import extract_topics
from services.router_service import classify_action, dispatch, tier_model
from config import settings
from datetime import datetime, timezone
import uuid
import json
import logging

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are ARIA, an Adaptive Reasoning Intelligence Assistant. "
    "You are a helpful, thoughtful, and concise personal AI assistant. "
    "You have access to the user's conversation history and can reference past context."
)


# ─── Background episodic memory pipeline ──────────────────────────────────────

async def _store_episode_memory(episode_id, conversation_id, prompt, response):
    ok = await store_episode(episode_id, conversation_id, prompt, response)
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
    routing_mode = req.routing_mode or "auto"

    # ── Create or load conversation ────────────────────────────────────────────
    if req.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == req.conversation_id)
        )
        convo = result.scalar_one_or_none()
        if not convo:
            # Pre-generated ID from a permission_required flow — create it now
            title = req.file_name or user_text[:60]
            convo = Conversation(id=req.conversation_id, title=title)
            db.add(convo)
            await db.flush()
    else:
        title = req.file_name or user_text[:60]
        convo = Conversation(id=str(uuid.uuid4()), title=title)
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

    # ── Classify action and determine tier ─────────────────────────────────────
    if routing_mode == "manual" and req.override_tier is not None:
        actual_tier = max(1, min(3, req.override_tier))
        classified_tier = actual_tier
        signals: list[str] = []
    else:
        classified_tier, signals = classify_action(req, len(history))
        actual_tier = classified_tier

    # ── Ask mode: return a permission prompt instead of calling the model ──────
    if routing_mode == "ask" and req.override_tier is None and classified_tier > 1:
        perm_id = str(uuid.uuid4())
        return ChatResponse(
            reply="",
            conversation_id=convo.id,
            message_id=perm_id,
            model=tier_model(classified_tier),
            tier=1,
            signals=signals,
            permission_required=True,
            suggested_tier=classified_tier,
            suggested_model=tier_model(classified_tier),
        )

    # ── Verify the target model is reachable ───────────────────────────────────
    if actual_tier < 3:
        if not await check_ollama_alive():
            raise HTTPException(503, "Ollama is not running. Start it with: ollama serve")
    elif not settings.tier3_api_key:
        raise HTTPException(503, "Tier 3 model not configured — add TIER3_API_KEY to .env")

    # ── Retrieve relevant memories (ChromaDB) + reinforce in Neo4j ────────────
    memories = search_memory(user_text, n_results=3)
    recalled_ids = [m["id"] for m in memories if m.get("id")]
    if recalled_ids:
        background_tasks.add_task(reinforce, recalled_ids)

    memory_context = ""
    if memories:
        snippets = [m["text"] for m in memories]
        memory_context = "\nRelevant past context:\n" + "\n".join(f"- {s}" for s in snippets)

    # ── Build messages for the model ───────────────────────────────────────────
    if req.file_content:
        label = req.file_name or "attached file"
        user_turn = f"{user_text}\n\n[File attached: {label}]\n```\n{req.file_content}\n```"
    else:
        user_turn = user_text

    messages = [{"role": "system", "content": SYSTEM_PROMPT + memory_context}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_turn})

    # ── Call the model via the router ──────────────────────────────────────────
    reply = await dispatch(actual_tier, messages)

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
        classified_tier=classified_tier,
        actual_tier=actual_tier,
        model_used=tier_model(actual_tier),
        signals=json.dumps(signals),
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.add(routing_log)
    await db.commit()

    # ── Store in ChromaDB ──────────────────────────────────────────────────────
    store_memory(
        f"User: {stored_user_content}\nARIA: {reply}",
        {"conversation_id": convo.id, "type": "exchange"},
        entry_id=episode_id,
    )

    # ── Fire-and-forget: write Episode + Concepts to Neo4j ────────────────────
    background_tasks.add_task(
        _store_episode_memory,
        episode_id,
        convo.id,
        stored_user_content,
        reply,
    )

    return ChatResponse(
        reply=reply,
        conversation_id=convo.id,
        message_id=episode_id,
        model=tier_model(actual_tier),
        tier=actual_tier,
        signals=signals,
    )


# ─── Conversation list / history ──────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc()).limit(50)
    )
    return result.scalars().all()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()
