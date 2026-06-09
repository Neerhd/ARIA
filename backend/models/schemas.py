from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from database.sqlite import Base
import uuid


# ─── SQLAlchemy ORM Models ─────────────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), default="New Conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


# ─── Pydantic Request/Response Schemas ────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field("", max_length=8000)
    conversation_id: Optional[str] = None
    stream: bool = False
    file_content: Optional[str] = None
    file_name: Optional[str] = None

    def effective_message(self) -> str:
        if self.message.strip():
            return self.message
        if self.file_content:
            return "Please read and summarise this file for me."
        return ""


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    message_id: str
    model: str


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    ollama: bool
    sqlite: bool
    chroma: bool
    neo4j: bool
    model: str
