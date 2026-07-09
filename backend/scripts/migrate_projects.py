"""
One-off, idempotent migration: introduce Projects and backfill all existing
conversations/episodes/memory entries into a "Default" project.

Safe to run multiple times — every step checks current state before acting.
Run from the backend/ directory: python scripts/migrate_projects.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from database.sqlite import engine, AsyncSessionLocal, init_db
from database.neo4j_client import get_neo4j_driver, close_neo4j_driver
from database.chroma_client import get_or_create_collection
from services.project_service import get_or_create_default_project


async def migrate_sqlite() -> str:
    # Ensure all current tables (including the new `projects` table) exist.
    await init_db()

    async with engine.begin() as conn:
        result = await conn.execute(text("PRAGMA table_info(conversations)"))
        columns = {row[1] for row in result.fetchall()}
        if "project_id" not in columns:
            print("  Adding project_id column to conversations...")
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN project_id VARCHAR(36)"))
        else:
            print("  conversations.project_id already exists, skipping ALTER TABLE.")

    async with AsyncSessionLocal() as db:
        default_id = await get_or_create_default_project(db)
        await db.commit()

    async with engine.begin() as conn:
        result = await conn.execute(
            text("UPDATE conversations SET project_id = :pid WHERE project_id IS NULL"),
            {"pid": default_id},
        )
        print(f"  Backfilled {result.rowcount} conversation(s) to Default project ({default_id}).")

    return default_id


async def migrate_neo4j(default_id: str) -> None:
    driver = await get_neo4j_driver()
    async with driver.session() as s:
        result = await s.run(
            "MATCH (e:Episode) WHERE e.project_id IS NULL "
            "SET e.project_id = $default_id "
            "RETURN count(e) AS updated",
            default_id=default_id,
        )
        row = await result.single()
        print(f"  Backfilled {row['updated']} Episode node(s) to Default project.")


def migrate_chroma(default_id: str) -> None:
    collection = get_or_create_collection()
    existing = collection.get(include=["metadatas"])
    ids_to_update, metadatas_to_update = [], []
    for eid, meta in zip(existing["ids"], existing["metadatas"]):
        if not meta or "project_id" not in meta:
            new_meta = dict(meta or {})
            new_meta["project_id"] = default_id
            ids_to_update.append(eid)
            metadatas_to_update.append(new_meta)

    if ids_to_update:
        collection.update(ids=ids_to_update, metadatas=metadatas_to_update)
    print(f"  Backfilled {len(ids_to_update)} ChromaDB entr(y/ies) to Default project.")


async def main():
    print("=== ARIA Projects migration ===")

    print("\n[1/3] SQLite...")
    default_id = await migrate_sqlite()

    print("\n[2/3] Neo4j...")
    try:
        await migrate_neo4j(default_id)
    finally:
        await close_neo4j_driver()

    print("\n[3/3] ChromaDB...")
    migrate_chroma(default_id)

    print(f"\nDone. Default project id: {default_id}")


if __name__ == "__main__":
    asyncio.run(main())
