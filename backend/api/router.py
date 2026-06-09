"""Router API — exposes tier config and routing logs for the frontend."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import RoutingLog
from database.sqlite import get_db
from services.router_service import tier_model
from services.ollama_service import list_local_models
from config import settings

router = APIRouter(prefix="/router", tags=["router"])


@router.get("/config")
async def get_router_config():
    """Return tier model assignments and availability status."""
    local_models = await list_local_models()

    def local_available(model_name: str) -> bool:
        return any(model_name in m or m.startswith(model_name.split(":")[0]) for m in local_models)

    return {
        "tiers": {
            1: {
                "model": settings.tier1_model,
                "type": "local",
                "available": local_available(settings.tier1_model),
                "label": "Fast",
                "description": "Simple questions, quick lookups, casual chat",
            },
            2: {
                "model": settings.tier2_model,
                "type": "local",
                "available": local_available(settings.tier2_model),
                "label": "Capable",
                "description": "File analysis, summarisation, drafting, code review",
            },
            3: {
                "model": settings.tier3_model,
                "type": "cloud",
                "available": bool(settings.tier3_api_key),
                "label": "Powerful",
                "description": "Complex reasoning, deep research, multi-step planning",
            },
        },
        "tier3_configured": bool(settings.tier3_api_key),
    }


@router.get("/logs")
async def get_routing_logs(limit: int = 20, db: AsyncSession = Depends(get_db)):
    """Return recent routing decisions for review and analysis."""
    result = await db.execute(
        select(RoutingLog)
        .order_by(RoutingLog.created_at.desc())
        .limit(min(limit, 100))
    )
    logs = result.scalars().all()
    return [
        {
            "id": r.id,
            "message_id": r.message_id,
            "routing_mode": r.routing_mode,
            "classified_tier": r.classified_tier,
            "actual_tier": r.actual_tier,
            "model_used": r.model_used,
            "signals": r.signals,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in logs
    ]
