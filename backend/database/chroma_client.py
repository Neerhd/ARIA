import chromadb
from chromadb.config import Settings as ChromaSettings
from pathlib import Path
from config import settings

Path(settings.chroma_db_path).mkdir(parents=True, exist_ok=True)

_client = None


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_db_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_or_create_collection(name: str = "aria_memory") -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )
