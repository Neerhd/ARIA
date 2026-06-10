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
    routing_mode: Optional[str] = None   # "auto" | "manual" | "ask"
    override_tier: Optional[int] = None  # explicit tier for manual / post-ask confirmation
    tools_enabled: list[str] = []        # e.g. ["web_search", "file_reader"]

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
    tier: int = 1
    signals: list[str] = []
    tools_used: list[str] = []
    permission_required: bool = False
    suggested_tier: Optional[int] = None
    suggested_model: Optional[str] = None


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


class RoutingLog(Base):
    __tablename__ = "routing_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id: Mapped[str] = mapped_column(String(36), nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(36), nullable=False)
    routing_mode: Mapped[str] = mapped_column(String(20), default="auto")
    classified_tier: Mapped[int] = mapped_column(Integer, default=1)
    actual_tier: Mapped[int] = mapped_column(Integer, default=1)
    model_used: Mapped[str] = mapped_column(String(100), default="")
    signals: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConsolidationRun(Base):
    __tablename__ = "consolidation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    triggered_by: Mapped[str] = mapped_column(String(20), default="manual")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    clusters_found: Mapped[int] = mapped_column(Integer, default=0)
    reflections_created: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="running")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class HealthResponse(BaseModel):
    status: str
    ollama: bool
    sqlite: bool
    chroma: bool
    neo4j: bool
    model: str
