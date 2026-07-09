"""Projects CRUD — scoping conversations and episodic memory by project."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from models.schemas import (
    Project, ProjectCreate, ProjectUpdate, ProjectOut,
    Conversation, Message, RoutingLog,
)
from database.sqlite import get_db
from services.graph_service import delete_episodes_by_project
from services.memory_service import delete_memory_by_project
import logging

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.asc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Cascade delete: removes the project's conversations/messages/routing logs,
    its Neo4j Episode nodes (and any Reflection left fully orphaned), and its
    ChromaDB memory entries. Concept nodes are untouched — they're global.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    convo_ids_result = await db.execute(
        select(Conversation.id).where(Conversation.project_id == project_id)
    )
    convo_ids = [row[0] for row in convo_ids_result.all()]

    if convo_ids:
        await db.execute(sa_delete(Message).where(Message.conversation_id.in_(convo_ids)))
        await db.execute(sa_delete(RoutingLog).where(RoutingLog.conversation_id.in_(convo_ids)))
        await db.execute(sa_delete(Conversation).where(Conversation.id.in_(convo_ids)))

    await db.delete(project)
    await db.commit()

    episodes_deleted = await delete_episodes_by_project(project_id)
    memory_deleted = delete_memory_by_project(project_id)

    return {
        "deleted": True,
        "conversations_deleted": len(convo_ids),
        "episodes_deleted": episodes_deleted,
        "memory_entries_deleted": memory_deleted,
    }
