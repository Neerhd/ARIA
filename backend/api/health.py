from fastapi import APIRouter
from models.schemas import HealthResponse
from services.router_service import PROVIDERS, is_configured, default_provider, default_model
from database.neo4j_client import verify_neo4j_connection
from database.chroma_client import get_chroma_client
import logging

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("", response_model=HealthResponse)
async def health_check():
    sqlite_ok = True  # If the app started, SQLite is working
    try:
        get_chroma_client()
        chroma_ok = True
    except Exception:
        chroma_ok = False

    neo4j_ok = await verify_neo4j_connection()

    provider = default_provider()
    all_ok = sqlite_ok and chroma_ok and provider is not None

    return HealthResponse(
        status="ok" if all_ok else "degraded",
        providers={pid: is_configured(pid) for pid in PROVIDERS},
        sqlite=sqlite_ok,
        chroma=chroma_ok,
        neo4j=neo4j_ok,
        model=default_model(provider) if provider else "",
    )
