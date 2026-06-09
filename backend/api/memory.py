from fastapi import APIRouter
from services.graph_service import get_recent_episodes, get_top_concepts, get_graph_stats

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
