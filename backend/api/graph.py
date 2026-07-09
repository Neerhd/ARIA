"""Graph visualizer API — read-only node/edge data for the 3D knowledge graph view."""
from fastapi import APIRouter, HTTPException
from services.graph_service import get_graph_data

router = APIRouter(tags=["graph"])


@router.get("/graph")
async def graph(project_id: str | None = None, scope: str = "project"):
    if scope not in ("project", "all"):
        raise HTTPException(422, "scope must be 'project' or 'all'")
    if scope == "project" and not project_id:
        raise HTTPException(422, "project_id is required when scope=project")
    return await get_graph_data(project_id, scope)
