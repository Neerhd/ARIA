from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path
from config import settings

Path(settings.sqlite_db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.sqlite_db_path}",
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Lightweight, additive migration — there's no Alembic in this project.
        # create_all only creates missing tables, not missing columns on
        # existing ones, so a column added to an ORM model after the table
        # already exists (e.g. Conversation.pinned) needs to be backfilled
        # by hand here. Safe to run every startup: skipped once the column
        # is present.
        result = await conn.execute(text("PRAGMA table_info(conversations)"))
        columns = {row[1] for row in result.fetchall()}
        if "pinned" not in columns:
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT 0"))
        result = await conn.execute(text("PRAGMA table_info(routing_logs)"))
        columns = {row[1] for row in result.fetchall()}
        if "role" not in columns:
            await conn.execute(text("ALTER TABLE routing_logs ADD COLUMN role VARCHAR(40) NOT NULL DEFAULT ''"))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
