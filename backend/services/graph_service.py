"""Neo4j episodic memory — write, recall, and reinforce Episode/Concept nodes."""
from database.neo4j_client import get_neo4j_driver
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


# ─── Schema bootstrap ─────────────────────────────────────────────────────────

async def init_graph_schema():
    """Create uniqueness constraints and indexes (safe to call on every startup)."""
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            await s.run(
                "CREATE CONSTRAINT episode_id IF NOT EXISTS "
                "FOR (e:Episode) REQUIRE e.id IS UNIQUE"
            )
            await s.run(
                "CREATE CONSTRAINT concept_name IF NOT EXISTS "
                "FOR (c:Concept) REQUIRE c.name IS UNIQUE"
            )
            await s.run(
                "CREATE INDEX episode_convo IF NOT EXISTS "
                "FOR (e:Episode) ON (e.conversation_id)"
            )
        logger.info("Neo4j schema ready.")
    except Exception as e:
        logger.warning(f"Neo4j schema init skipped (Neo4j may be unavailable): {e}")


# ─── Write operations ──────────────────────────────────────────────────────────

async def store_episode(
    episode_id: str,
    conversation_id: str,
    prompt: str,
    response: str,
) -> bool:
    """Create an Episode node. Returns True on success."""
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            await s.run(
                """
                MERGE (e:Episode {id: $id})
                ON CREATE SET
                    e.conversation_id = $conversation_id,
                    e.prompt          = $prompt,
                    e.response        = $response,
                    e.timestamp       = $timestamp,
                    e.recall_count    = 0,
                    e.last_recalled   = null
                """,
                id=episode_id,
                conversation_id=conversation_id,
                prompt=prompt[:500],
                response=response[:500],
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        return True
    except Exception as e:
        logger.warning(f"store_episode failed: {e}")
        return False


async def store_concepts(episode_id: str, concepts: list[str]) -> bool:
    """Create/merge Concept nodes and DISCUSSES edges for an episode."""
    if not concepts:
        return True
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            for name in concepts:
                await s.run(
                    """
                    MERGE (c:Concept {name: $name})
                    ON CREATE SET c.episode_count = 1, c.created_at = $ts
                    ON MATCH  SET c.episode_count = c.episode_count + 1
                    WITH c
                    MATCH (e:Episode {id: $episode_id})
                    MERGE (e)-[:DISCUSSES]->(c)
                    """,
                    name=name.lower().strip(),
                    episode_id=episode_id,
                    ts=datetime.now(timezone.utc).isoformat(),
                )
        return True
    except Exception as e:
        logger.warning(f"store_concepts failed: {e}")
        return False


async def link_to_previous(episode_id: str, conversation_id: str) -> bool:
    """Create a NEXT edge from the previous episode in this conversation thread."""
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            await s.run(
                """
                MATCH (prev:Episode {conversation_id: $cid})
                WHERE prev.id <> $eid
                WITH prev ORDER BY prev.timestamp DESC LIMIT 1
                MATCH (curr:Episode {id: $eid})
                MERGE (prev)-[:NEXT]->(curr)
                """,
                cid=conversation_id,
                eid=episode_id,
            )
        return True
    except Exception as e:
        logger.warning(f"link_to_previous failed: {e}")
        return False


# ─── Recall & reinforce ────────────────────────────────────────────────────────

async def reinforce(episode_ids: list[str]) -> None:
    """Increment recall_count and update last_recalled on recalled episodes."""
    if not episode_ids:
        return
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            await s.run(
                """
                MATCH (e:Episode) WHERE e.id IN $ids
                SET e.recall_count  = e.recall_count + 1,
                    e.last_recalled = $ts
                """,
                ids=episode_ids,
                ts=datetime.now(timezone.utc).isoformat(),
            )
    except Exception as e:
        logger.warning(f"reinforce failed: {e}")


async def get_episodes_by_concepts(concepts: list[str], limit: int = 5) -> list[dict]:
    """Find episodes discussing the given concepts, ranked by recall_count."""
    if not concepts:
        return []
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            result = await s.run(
                """
                MATCH (e:Episode)-[:DISCUSSES]->(c:Concept)
                WHERE c.name IN $concepts
                WITH e, collect(c.name) AS topics, count(c) AS overlap
                ORDER BY overlap DESC, e.recall_count DESC, e.timestamp DESC
                LIMIT $limit
                RETURN e.id AS id, e.prompt AS prompt, e.response AS response,
                       e.recall_count AS recall_count, topics
                """,
                concepts=[c.lower() for c in concepts],
                limit=limit,
            )
            return [dict(r) for r in await result.data()]
    except Exception as e:
        logger.warning(f"get_episodes_by_concepts failed: {e}")
        return []


# ─── Memory browser queries ────────────────────────────────────────────────────

async def get_recent_episodes(limit: int = 20) -> list[dict]:
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            result = await s.run(
                """
                MATCH (e:Episode)
                OPTIONAL MATCH (e)-[:DISCUSSES]->(c:Concept)
                WITH e, collect(c.name) AS topics
                ORDER BY e.timestamp DESC
                LIMIT $limit
                RETURN e.id AS id, e.conversation_id AS conversation_id,
                       e.prompt AS prompt, e.response AS response,
                       e.timestamp AS timestamp, e.recall_count AS recall_count,
                       topics
                """,
                limit=limit,
            )
            return [dict(r) for r in await result.data()]
    except Exception as e:
        logger.warning(f"get_recent_episodes failed: {e}")
        return []


async def get_top_concepts(limit: int = 40) -> list[dict]:
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            result = await s.run(
                """
                MATCH (c:Concept)
                RETURN c.name AS name, c.episode_count AS episode_count
                ORDER BY c.episode_count DESC
                LIMIT $limit
                """,
                limit=limit,
            )
            return [dict(r) for r in await result.data()]
    except Exception as e:
        logger.warning(f"get_top_concepts failed: {e}")
        return []


async def get_graph_stats() -> dict:
    try:
        driver = await get_neo4j_driver()
        async with driver.session() as s:
            result = await s.run(
                """
                MATCH (e:Episode) WITH count(e) AS episodes
                MATCH (c:Concept) WITH episodes, count(c) AS concepts
                RETURN episodes, concepts
                """
            )
            row = await result.single()
            return {"episodes": row["episodes"], "concepts": row["concepts"]} if row else {}
    except Exception as e:
        logger.warning(f"get_graph_stats failed: {e}")
        return {"episodes": 0, "concepts": 0}
