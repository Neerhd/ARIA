from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut, Conversation, Message
from database.sqlite import get_db
from services.ollama_service import chat as ollama_chat, check_ollama_alive
from services.memory_service import store_memory, search_memory
from services.graph_service import (
    store_episode, store_concepts, link_to_previous, reinforce,
)
from services.topic_service import extract_topics
from config import settings
import uuid
import logging

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are ARIA, an Adaptive Reasoning Intelligence Assistant. "
    "You are a helpful, thoughtful, and concise personal AI assistant. "
    "You have access to the user's conversation history and can reference past context."
)


# ─── Background episodic memory pipeline ──────────────────────────────────────

async def _store_episode_memory(
    episode_id: str,
    conversation_id: str,
    prompt: str,
    response: str,
):
    """Runs after the response is sent. Writes Episode + Concepts to Neo4j."""
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

    if not await check_ollama_alive():
        raise HTTPException(503, "Ollama is not running. Start it with: ollama serve")

    # ── Create or load conversation ────────────────────────────────────────────
    if req.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == req.conversation_id)
        )
        convo = result.scalar_one_or_none()
        if not convo:
            raise HTTPException(404, "Conversation not found")
    else:
        title = req.file_name or user_text[:60]
        convo = Conversation(id=str(uuid.uuid4()), title=title)
        db.add(convo)
        await db.flush()

    # ── Retrieve relevant memories (ChromaDB) + reinforce in Neo4j ────────────
    memories = search_memory(user_text, n_results=3)
    recalled_ids = [m["id"] for m in memories if m.get("id")]
    if recalled_ids:
        background_tasks.add_task(reinforce, recalled_ids)

    memory_context = ""
    if memories:
        snippets = [m["text"] for m in memories]
        memory_context = "\nRelevant past context:\n" + "\n".join(f"- {s}" for s in snippets)

    # ── Load recent conversation history ───────────────────────────────────────
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # ── Build user turn (inject file if attached) ──────────────────────────────
    if req.file_content:
        label = req.file_name or "attached file"
        user_turn = f"{user_text}\n\n[File attached: {label}]\n```\n{req.file_content}\n```"
    else:
        user_turn = user_text

    # ── Call Ollama ────────────────────────────────────────────────────────────
    messages = [{"role": "system", "content": SYSTEM_PROMPT + memory_context}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_turn})

    reply = await ollama_chat(messages, model=settings.ollama_model)

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
        id=episode_id,           # episode_id == assistant message id — shared key
        conversation_id=convo.id,
        role="assistant",
        content=reply,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()

    # ── Store in ChromaDB (same ID as the Neo4j episode) ──────────────────────
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
        model=settings.ollama_model,
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
