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


def _ranking_score(distance: float, metadata: dict) -> float:
    """Human-style ordering among candidates that already passed the
    relevance bar: closer is better, recent gets a boost, memories that
    have proven useful before (recall_count) get a nudge. Lower is better."""
    score = distance
    ts = (metadata or {}).get("timestamp") or ""
    try:
        age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(ts)).days
        if age_days <= 2:
            score -= 0.12
        elif age_days <= 7:
            score -= 0.08
        elif age_days <= 30:
            score -= 0.04
    except (ValueError, TypeError):
        pass
    try:
        score -= min(int((metadata or {}).get("recall_count") or 0), 5) * 0.01
    except (ValueError, TypeError):
        pass
    return score


def search_memory(
    query: str | list[str], project_id: str | None, n_results: int = 5
) -> list[dict]:
    """Return the top-n relevant memory entries for one or more recall cues,
    scoped to a single project so recall never crosses project boundaries.
    project_id=None searches across ALL projects — used by voice commands,
    which have no project context of their own.

    The relevance bar gates on raw distance (honesty is never affected by
    the ranking bonuses); survivors are re-ranked by relevance × recency ×
    reinforcement. Each result includes an 'id' field so callers can
    reinforce the matching Neo4j Episode nodes.
    """
    cues = [query] if isinstance(query, str) else [c for c in query if c and c.strip()]
    if not cues:
        return []
    collection = get_or_create_collection()
    try:
        kwargs = {
            "query_texts": cues,
            # Retrieve wide, then filter by the relevance bar below and cap
            # at n_results — so weak matches get dropped, not padded in.
            "n_results": max(n_results * 3, 10),
            "include": ["documents", "metadatas", "distances"],
        }
        if project_id is not None:
            kwargs["where"] = {"project_id": project_id}
        results = collection.query(**kwargs)

        # Merge candidates across cues, keeping each entry's best distance.
        best: dict[str, dict] = {}
        for cue_idx in range(len(results["ids"])):
            for eid, doc, meta, dist in zip(
                results["ids"][cue_idx],
                results["documents"][cue_idx],
                results["metadatas"][cue_idx],
                results["distances"][cue_idx],
            ):
                if eid not in best or dist < best[eid]["distance"]:
                    best[eid] = {"id": eid, "text": doc, "metadata": meta, "distance": dist}

        items = [c for c in best.values() if c["distance"] <= _MAX_RELEVANCE_DISTANCE]
        dropped = len(best) - len(items)
        items.sort(key=lambda c: _ranking_score(c["distance"], c["metadata"]))
        if dropped:
            logger.info(f"Memory recall: kept {len(items[:n_results])}, dropped {dropped} below relevance bar")
        return items[:n_results]
    except Exception as e:
        logger.warning(f"Memory search failed: {e}")
        return []


def bump_recall_counts(entry_ids: list[str]) -> None:
    """Mirror Neo4j's reinforce() into Chroma metadata so ranking can use
    recall_count without a per-query graph round-trip. Best-effort."""
    if not entry_ids:
        return
    try:
        collection = get_or_create_collection()
        existing = collection.get(ids=entry_ids, include=["metadatas"])
        for eid, meta in zip(existing["ids"], existing["metadatas"]):
            meta = meta or {}
            try:
                meta["recall_count"] = int(meta.get("recall_count") or 0) + 1
            except (ValueError, TypeError):
                meta["recall_count"] = 1
            collection.update(ids=[eid], metadatas=[meta])
    except Exception as e:
        logger.warning(f"bump_recall_counts failed: {e}")


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
