from fastapi import APIRouter
from models.schemas import HealthResponse
from services.ollama_service import check_ollama_alive
from database.neo4j_client import verify_neo4j_connection
from database.chroma_client import get_chroma_client
from config import settings
import logging

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("", response_model=HealthResponse)
async def health_check():
    ollama_ok = await check_ollama_alive()

    sqlite_ok = True  # If the app started, SQLite is working
    try:
        get_chroma_client()
        chroma_ok = True
    except Exception:
        chroma_ok = False

    neo4j_ok = await verify_neo4j_connection()

    all_ok = ollama_ok and sqlite_ok and chroma_ok

    return HealthResponse(
        status="ok" if all_ok else "degraded",
        ollama=ollama_ok,
        sqlite=sqlite_ok,
        chroma=chroma_ok,
        neo4j=neo4j_ok,
        model=settings.ollama_model,
    )
