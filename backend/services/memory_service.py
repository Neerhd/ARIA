"""Stores and retrieves conversation turns in ChromaDB for semantic memory."""
from database.chroma_client import get_or_create_collection
import uuid
import logging

logger = logging.getLogger(__name__)


def store_memory(text: str, metadata: dict, entry_id: str | None = None) -> str:
    """Persist a piece of text into the vector store. Returns the entry ID.

    Pass entry_id to match the Neo4j Episode id so the two stores stay in sync.
    """
    collection = get_or_create_collection()
    eid = entry_id or str(uuid.uuid4())
    collection.add(
        documents=[text],
        metadatas=[metadata],
        ids=[eid],
    )
    return eid


def search_memory(query: str, n_results: int = 5) -> list[dict]:
    """Return the top-n semantically similar memory entries for a query.

    Each result includes an 'id' field so callers can reinforce the
    matching Neo4j Episode nodes.
    """
    collection = get_or_create_collection()
    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        items = []
        for eid, doc, meta, dist in zip(
            results["ids"][0],
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            items.append({"id": eid, "text": doc, "metadata": meta, "distance": dist})
        return items
    except Exception as e:
        logger.warning(f"Memory search failed: {e}")
        return []
