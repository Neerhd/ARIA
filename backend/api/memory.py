from fastapi import APIRouter, HTTPException
from services.graph_service import (
    get_recent_episodes, get_top_concepts, get_graph_stats,
    get_pinned_facts, delete_pinned_fact,
)

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/episodes")
async def episodes(limit: int = 20):
    return await get_recent_episodes(limit=min(limit, 50))


@router.get("/concepts")
async def concepts(limit: int = 40):
    return await get_top_concepts(limit=min(limit, 100))


@router.get("/stats")
async def stats():
    return await get_graph_stats()


@router.get("/pinned")
async def pinned():
    return await get_pinned_facts()


@router.delete("/pinned/{fact_id}")
async def remove_pinned(fact_id: str):
    ok = await delete_pinned_fact(fact_id)
    if not ok:
        raise HTTPException(500, "Failed to delete pinned fact")
    return {"deleted": True}
