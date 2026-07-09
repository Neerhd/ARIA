"""Consolidation pipeline — clusters Episodes by Concept, synthesises Reflection nodes."""
import httpx
import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from config import settings
from database.sqlite import AsyncSessionLocal
from models.schemas import Project
from services.graph_service import get_clusters_for_consolidation, store_reflection

logger = logging.getLogger(__name__)

_REFLECT_PROMPT = """\
You are ARIA's memory consolidation system. Below are {count} conversations all related to "{concept}".

Identify a pattern, lesson, or recurring theme across these conversations. Write a 2-3 sentence reflection that captures what you have learned about the user's interests or needs regarding this topic.

Start your reflection with "The user..." or "When discussing {concept}...".

Conversations:
{episodes}

Reflection:"""


async def synthesise_reflection(concept: str, episodes: list[dict]) -> str | None:
    """Call Ollama to generate a reflection from a cluster of related episodes."""
    episode_text = ""
    for i, ep in enumerate(episodes, 1):
        prompt_snippet = (ep.get("prompt") or "")[:200].replace("\n", " ")
        response_snippet = (ep.get("response") or "")[:200].replace("\n", " ")
        episode_text += f"{i}. User: {prompt_snippet}\n   ARIA: {response_snippet}\n\n"

    payload = {
        "model": settings.ollama_model,
        "prompt": _REFLECT_PROMPT.format(
            count=len(episodes),
            concept=concept,
            episodes=episode_text.strip(),
        ),
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 150},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip()
            return text if len(text) >= 30 else None
    except Exception as e:
        logger.warning(f"Reflection synthesis failed for concept '{concept}': {e}")
        return None


async def run_consolidation(triggered_by: str = "manual") -> dict:
    """Run the full consolidation pipeline, per project. Returns a result summary dict.

    Clustering is scoped to each project independently so patterns synthesise
    per-project, not globally — a concept shared across projects clusters
    separately within each one.
    """
    results: dict = {
        "triggered_by": triggered_by,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "clusters_found": 0,
        "reflections_created": 0,
        "details": [],
        "errors": [],
    }

    async with AsyncSessionLocal() as db:
        project_rows = await db.execute(select(Project.id))
        project_ids = [row[0] for row in project_rows.all()]

    all_clusters = []
    for project_id in project_ids:
        clusters = await get_clusters_for_consolidation(project_id, min_episodes=3)
        for cluster in clusters:
            cluster["project_id"] = project_id
        all_clusters.extend(clusters)

    results["clusters_found"] = len(all_clusters)
    logger.info(f"Consolidation: {len(all_clusters)} cluster(s) found across {len(project_ids)} project(s).")

    for cluster in all_clusters:
        concept = cluster["concept"]
        episodes = cluster["episodes"][:6]  # cap at 6 episodes per reflection
        try:
            reflection_text = await synthesise_reflection(concept, episodes)
            if not reflection_text:
                results["details"].append({
                    "concept": concept,
                    "episodes": len(episodes),
                    "status": "skipped: model returned empty reflection",
                })
                continue

            reflection_id = str(uuid.uuid4())
            episode_ids = [e["id"] for e in episodes]
            ok = await store_reflection(reflection_id, concept, reflection_text, episode_ids)

            if ok:
                results["reflections_created"] += 1
                results["details"].append({
                    "concept": concept,
                    "episodes": len(episodes),
                    "reflection_id": reflection_id,
                    "status": "reflected",
                })
                logger.info(f"Reflection stored for concept '{concept}' ({len(episodes)} episodes).")
            else:
                results["details"].append({
                    "concept": concept,
                    "episodes": len(episodes),
                    "status": "failed: store_reflection returned False",
                })
        except Exception as e:
            msg = f"{concept}: {e}"
            logger.warning(f"Consolidation error for '{concept}': {e}")
            results["errors"].append(msg)
            results["details"].append({"concept": concept, "status": f"error: {e}"})

    results["completed_at"] = datetime.now(timezone.utc).isoformat()
    return results
