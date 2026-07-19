from fastapi import APIRouter, HTTPException
from services.graph_service import (
    get_recent_episodes, get_top_concepts, get_graph_stats,
    get_pinned_facts, delete_pinned_fact,
)

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/episodes")
async def episodes(project_id: str, limit: int = 20):
    return await get_recent_episodes(project_id, limit=min(limit, 50))


@router.get("/concepts")
async def concepts(project_id: str, limit: int = 40):
    return await get_top_concepts(project_id, limit=min(limit, 100))


@router.get("/stats")
async def stats(project_id: str):
    return await get_graph_stats(project_id)


@router.get("/pinned")
async def pinned():
    """The living profile: user-pinned facts plus active auto-captured
    ones. Superseded facts are excluded. (Endpoint keeps its historical
    name for frontend compatibility.)"""
    from services.graph_service import get_active_facts
    return await get_active_facts()


@router.delete("/pinned/{fact_id}")
async def remove_pinned(fact_id: str):
    ok = await delete_pinned_fact(fact_id)
    if not ok:
        raise HTTPException(500, "Failed to delete pinned fact")
    return {"deleted": True}
