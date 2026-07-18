"""Router API — exposes provider config, role assignments, and routing logs
for the frontend."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import RoutingLog
from database.sqlite import get_db
from config import settings
from services.router_service import PROVIDERS, is_configured, default_provider, send
from services.role_service import ROLES, roles_overview, set_assignment, clear_assignment
from services import key_store

router = APIRouter(prefix="/router", tags=["router"])


class RoleAssignment(BaseModel):
    provider: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)


class ProviderKey(BaseModel):
    key: str = Field(..., min_length=8)


def _key_source(provider_id: str) -> str | None:
    if key_store.stored_key(provider_id):
        return "stored"
    if getattr(settings, PROVIDERS[provider_id].key_setting, ""):
        return "env"
    return None


@router.get("/config")
async def get_router_config():
    """Return provider availability and model assignments."""
    default = default_provider()
    return {
        "providers": {
            pid: {
                "label": p.label,
                "model": p.default_model,
                "cheap_model": p.cheap_model,
                "models": [{"id": mid, "label": mlabel} for mid, mlabel in p.models],
                "configured": is_configured(pid),
                "key_source": _key_source(pid),
                "supports_tools": p.supports_tools,
                "default": pid == default,
                "key_url": p.key_url,
            }
            for pid, p in PROVIDERS.items()
        },
        "default_provider": default,
    }


@router.put("/providers/{provider_id}/key")
async def set_provider_key(provider_id: str, body: ProviderKey):
    """Store a provider API key and verify it with a minimal live request."""
    if provider_id not in PROVIDERS:
        raise HTTPException(404, f"Unknown provider: {provider_id}")
    key_store.set_key(provider_id, body.key.strip())
    try:
        await send(
            provider_id,
            PROVIDERS[provider_id].cheap_model,
            [{"role": "user", "content": "Reply with the word OK."}],
            max_tokens=8,
            purpose="key_check",
        )
    except HTTPException as e:
        key_store.clear_key(provider_id)
        raise HTTPException(400, f"That key didn't work: {e.detail}")
    except Exception as e:
        key_store.clear_key(provider_id)
        raise HTTPException(400, f"That key didn't work: {e}")
    return {
        "provider": provider_id,
        "configured": True,
        "default_provider": default_provider(),
    }


@router.delete("/providers/{provider_id}/key")
async def remove_provider_key(provider_id: str):
    """Remove a stored key. A key set in backend/.env (if any) resurfaces."""
    if provider_id not in PROVIDERS:
        raise HTTPException(404, f"Unknown provider: {provider_id}")
    key_store.clear_key(provider_id)
    return {
        "provider": provider_id,
        "configured": is_configured(provider_id),
        "default_provider": default_provider(),
    }


@router.get("/usage")
async def get_usage(days: int = 7):
    """Estimated spend over the last N days, broken down by day/provider/activity."""
    from services.usage_service import usage_summary
    return await usage_summary(days=max(1, min(days, 90)))


@router.get("/roles")
async def get_roles():
    """Effective role→model assignments (defaults resolved dynamically)."""
    return {"roles": roles_overview()}


@router.put("/roles/{role_id}")
async def assign_role(role_id: str, body: RoleAssignment):
    """Assign a specific provider+model to a task role."""
    if role_id not in ROLES:
        raise HTTPException(404, f"Unknown role: {role_id}")
    if body.provider not in PROVIDERS:
        raise HTTPException(404, f"Unknown provider: {body.provider}")
    if not is_configured(body.provider):
        raise HTTPException(
            400, f"{PROVIDERS[body.provider].label} has no API key configured."
        )
    set_assignment(role_id, body.provider, body.model)
    return {"roles": roles_overview()}


@router.delete("/roles/{role_id}")
async def reset_role(role_id: str):
    """Reset a role to its dynamic default (the default provider's model)."""
    if role_id not in ROLES:
        raise HTTPException(404, f"Unknown role: {role_id}")
    clear_assignment(role_id)
    return {"roles": roles_overview()}


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
            "role": r.role,
            "model_used": r.model_used,
            "signals": r.signals,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in logs
    ]
