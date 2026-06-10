"""SearXNG web search integration."""
import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)


async def web_search(query: str, num_results: int = 5) -> list[dict]:
    """Search via SearXNG. Returns list of {title, url, snippet}, or [{error: ...}] on failure."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{settings.searxng_base_url}/search",
                params={"q": query, "format": "json", "categories": "general"},
            )
            r.raise_for_status()
            data = r.json()
            return [
                {
                    "title":   item.get("title", ""),
                    "url":     item.get("url", ""),
                    "snippet": item.get("content", ""),
                }
                for item in data.get("results", [])[:num_results]
            ]
    except Exception as e:
        logger.warning(f"Web search failed for '{query}': {e}")
        return [{"error": f"Search unavailable: {e}"}]
