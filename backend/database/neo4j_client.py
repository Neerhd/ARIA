from neo4j import AsyncGraphDatabase
from config import settings
import logging

logger = logging.getLogger(__name__)

_driver = None


async def get_neo4j_driver():
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


async def close_neo4j_driver():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


async def verify_neo4j_connection() -> bool:
    try:
        driver = await get_neo4j_driver()
        await driver.verify_connectivity()
        return True
    except Exception as e:
        logger.warning(f"Neo4j not available: {e}")
        return False
