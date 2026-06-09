from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut, Conversation, Message
from database.sqlite import get_db
from services.ollama_service import chat as ollama_chat, check_ollama_alive
from services.memory_service import store_memory, search_memory
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


@router.post("", response_model=ChatResponse)
async def send_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    user_text = req.effective_message()
    if not user_text:
        raise HTTPException(422, "Provide a message or attach a file.")

    if not await check_ollama_alive():
        raise HTTPException(503, "Ollama is not running. Start it with: ollama serve")

    # Create or load conversation
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

    # Retrieve relevant memories for context
    memories = search_memory(user_text, n_results=3)
    memory_context = ""
    if memories:
        snippets = [m["text"] for m in memories]
        memory_context = "\nRelevant past context:\n" + "\n".join(f"- {s}" for s in snippets)

    # Load recent conversation history (last 10 messages)
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # Build the user turn — inject file content when present
    if req.file_content:
        label = req.file_name or "attached file"
        user_turn = (
            f"{user_text}\n\n"
            f"[File attached: {label}]\n"
            f"```\n{req.file_content}\n```"
        )
    else:
        user_turn = user_text

    # Build messages list for Ollama
    messages = [{"role": "system", "content": SYSTEM_PROMPT + memory_context}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_turn})

    # Call Ollama
    reply = await ollama_chat(messages, model=settings.ollama_model)

    # Persist — store display-friendly version (no raw file dump) in SQLite
    stored_user_content = user_text
    if req.file_name:
        stored_user_content += f"\n[Attached: {req.file_name}]"

    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=convo.id,
        role="user",
        content=stored_user_content,
    )
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=convo.id,
        role="assistant",
        content=reply,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()

    # Store in semantic memory
    store_memory(
        f"User: {stored_user_content}\nARIA: {reply}",
        {"conversation_id": convo.id, "type": "exchange"},
    )

    return ChatResponse(
        reply=reply,
        conversation_id=convo.id,
        message_id=assistant_msg.id,
        model=settings.ollama_model,
    )


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
