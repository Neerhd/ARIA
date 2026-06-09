from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.sqlite import init_db
from database.neo4j_client import close_neo4j_driver
from services.graph_service import init_graph_schema
from api.health import router as health_router
from api.chat import router as chat_router
from api.files import router as files_router
from api.memory import router as memory_router
from api.consolidation import router as consolidation_router, run_consolidation_with_log
from api.router import router as router_router
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_CONSOLIDATION_INTERVAL = 24 * 60 * 60  # 24 hours


async def _nightly_consolidation():
    """Background task: runs the consolidation pipeline once per day."""
    while True:
        await asyncio.sleep(_CONSOLIDATION_INTERVAL)
        logger.info("Scheduler: starting nightly consolidation…")
        try:
            result = await run_consolidation_with_log(triggered_by="scheduler")
            logger.info(
                f"Scheduler: consolidation complete — "
                f"{result['reflections_created']} reflection(s) from "
                f"{result['clusters_found']} cluster(s)."
            )
        except Exception as e:
            logger.error(f"Scheduler: consolidation failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ARIA backend starting up...")
    await init_db()
    logger.info("SQLite database initialized.")
    await init_graph_schema()
    scheduler = asyncio.create_task(_nightly_consolidation())
    yield
    logger.info("ARIA backend shutting down...")
    scheduler.cancel()
    await close_neo4j_driver()


app = FastAPI(
    title="ARIA Backend",
    description="Adaptive Reasoning Intelligence Assistant — local AI backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(files_router)
app.include_router(memory_router)
app.include_router(consolidation_router)
app.include_router(router_router)


@app.get("/")
async def root():
    return {"message": "ARIA backend is running", "docs": "/docs"}
