"""Stores and retrieves conversation turns in ChromaDB for semantic memory."""
from database.chroma_client import get_or_create_collection
import uuid
import logging

logger = logging.getLogger(__name__)


def store_memory(text: str, metadata: dict) -> str:
    """Persist a piece of text into the vector store. Returns the entry ID."""
    collection = get_or_create_collection()
    entry_id = str(uuid.uuid4())
    collection.add(
        documents=[text],
        metadatas=[metadata],
        ids=[entry_id],
    )
    return entry_id


def search_memory(query: str, n_results: int = 5) -> list[dict]:
    """Return the top-n semantically similar memory entries for a query."""
    collection = get_or_create_collection()
    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
        items = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            items.append({"text": doc, "metadata": meta, "distance": dist})
        return items
    except Exception as e:
        logger.warning(f"Memory search failed: {e}")
        return []
