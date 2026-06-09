from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.sqlite import init_db
from database.neo4j_client import close_neo4j_driver
from api.health import router as health_router
from api.chat import router as chat_router
from api.files import router as files_router
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ARIA backend starting up...")
    await init_db()
    logger.info("SQLite database initialized.")
    yield
    logger.info("ARIA backend shutting down...")
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


@app.get("/")
async def root():
    return {"message": "ARIA backend is running", "docs": "/docs"}
