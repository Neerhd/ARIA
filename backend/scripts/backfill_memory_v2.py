"""One-off Memory v2 backfill (run from backend/: .venv/bin/python scripts/backfill_memory_v2.py)

1. Copies timestamps from Neo4j Episodes onto their matching ChromaDB
   entries (pre-v2 entries stored no timestamp, so dated recall couldn't
   work for them).
2. Indexes existing Neo4j Reflections into ChromaDB (pre-v2 reflections
   were never part of recall).

Safe to re-run: both steps skip entries that are already correct.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from neo4j import GraphDatabase
from config import settings
from database.chroma_client import get_or_create_collection


def main() -> None:
    driver = GraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )
    collection = get_or_create_collection()

    with driver.session() as session:
        episodes = session.run(
            "MATCH (e:Episode) RETURN e.id AS id, e.timestamp AS ts"
        ).data()
        reflections = session.run(
            """
            MATCH (r:Reflection)
            OPTIONAL MATCH (r)-[:SYNTHESISED_FROM]->(e:Episode)
            RETURN r.id AS id, r.concept AS concept, r.text AS text,
                   r.created_at AS created_at, head(collect(e.project_id)) AS project_id
            """
        ).data()
    driver.close()

    # ── 1. Timestamp backfill ────────────────────────────────────────────────
    ts_by_id = {e["id"]: str(e["ts"]) for e in episodes if e["ts"] is not None}
    existing = collection.get(include=["metadatas"])
    updated = 0
    for eid, meta in zip(existing["ids"], existing["metadatas"]):
        meta = meta or {}
        if meta.get("timestamp"):
            continue
        ts = ts_by_id.get(eid)
        if not ts:
            continue
        meta["timestamp"] = ts
        collection.update(ids=[eid], metadatas=[meta])
        updated += 1
    print(f"Timestamps backfilled: {updated} (of {len(existing['ids'])} entries)")

    # ── 2. Reflection indexing ───────────────────────────────────────────────
    added = 0
    for r in reflections:
        if not r["id"] or not r["text"]:
            continue
        if collection.get(ids=[r["id"]])["ids"]:
            continue  # already indexed
        collection.add(
            documents=[f"Reflection ({r['concept']}): {r['text']}"],
            metadatas=[{
                "project_id": r["project_id"] or "",
                "type": "reflection",
                "concept": r["concept"] or "",
                "timestamp": str(r["created_at"]) if r["created_at"] else "",
            }],
            ids=[r["id"]],
        )
        added += 1
    print(f"Reflections indexed: {added} (of {len(reflections)} in the graph)")


if __name__ == "__main__":
    main()
