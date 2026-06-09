import httpx
from config import settings
import logging

logger = logging.getLogger(__name__)


async def check_ollama_alive() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def list_local_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            r.raise_for_status()
            data = r.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        logger.error(f"Could not list Ollama models: {e}")
        return []


async def chat(messages: list[dict], model: str | None = None) -> str:
    """Send a chat request to Ollama and return the assistant reply."""
    target_model = model or settings.ollama_model
    payload = {
        "model": target_model,
        "messages": messages,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json=payload,
        )
        r.raise_for_status()
        return r.json()["message"]["content"]


async def generate_embedding(text: str, model: str = "nomic-embed-text") -> list[float]:
    """Generate an embedding vector for the given text using Ollama."""
    payload = {"model": model, "prompt": text}
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json=payload,
        )
        r.raise_for_status()
        return r.json()["embedding"]
