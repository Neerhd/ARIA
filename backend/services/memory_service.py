"""Stores and retrieves conversation turns in ChromaDB for semantic memory."""
from database.chroma_client import get_or_create_collection
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

# Memory v2 relevance bar — recall drops anything farther than this, so a
# message with no genuinely related history recalls NOTHING (which is
# correct) instead of padding in the 3 nearest strangers. Calibrated
# empirically against the real database (2026-07-19: on-topic matches sat
# at 0.42–0.68, off-topic at 0.77+); re-tune if the embedder ever changes.
_MAX_RELEVANCE_DISTANCE = 0.70


def store_memory(text: str, metadata: dict, entry_id: str | None = None) -> str:
    """Persist a piece of text into the vector store. Returns the entry ID.

    Pass entry_id to match the Neo4j Episode id so the two stores stay in sync.
    """
    collection = get_or_create_collection()
    eid = entry_id or str(uuid.uuid4())
    metadata.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    collection.add(
        documents=[text],
        metadatas=[metadata],
        ids=[eid],
    )
    return eid


def search_memory(query: str, project_id: str | None, n_results: int = 5) -> list[dict]:
    """Return the top-n semantically similar memory entries for a query,
    scoped to a single project so recall never crosses project boundaries.
    project_id=None searches across ALL projects — used by voice commands,
    which have no project context of their own.

    Each result includes an 'id' field so callers can reinforce the
    matching Neo4j Episode nodes.
    """
    collection = get_or_create_collection()
    try:
        kwargs = {
            "query_texts": [query],
            # Retrieve wide, then filter by the relevance bar below and cap
            # at n_results — so weak matches get dropped, not padded in.
            "n_results": max(n_results * 3, 10),
            "include": ["documents", "metadatas", "distances"],
        }
        if project_id is not None:
            kwargs["where"] = {"project_id": project_id}
        results = collection.query(**kwargs)
        items = []
        dropped = 0
        for eid, doc, meta, dist in zip(
            results["ids"][0],
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            if dist > _MAX_RELEVANCE_DISTANCE:
                dropped += 1
                continue
            items.append({"id": eid, "text": doc, "metadata": meta, "distance": dist})
        if dropped:
            logger.info(f"Memory recall: kept {len(items[:n_results])}, dropped {dropped} below relevance bar")
        return items[:n_results]
    except Exception as e:
        logger.warning(f"Memory search failed: {e}")
        return []


def delete_memory_by_project(project_id: str) -> int:
    """Delete all ChromaDB entries belonging to a project. Returns count deleted."""
    collection = get_or_create_collection()
    try:
        matches = collection.get(where={"project_id": project_id}, include=[])
        ids = matches["ids"]
        if ids:
            collection.delete(ids=ids)
        return len(ids)
    except Exception as e:
        logger.warning(f"delete_memory_by_project failed: {e}")
        return 0
