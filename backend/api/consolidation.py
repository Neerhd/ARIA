"""Consolidation API — manual trigger, run history, and reflections viewer."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import ConsolidationRun
from database.sqlite import get_db, AsyncSessionLocal
from services.consolidation_service import run_consolidation as _run
from services.graph_service import get_reflections
from datetime import datetime, timezone
import uuid
import logging

router = APIRouter(prefix="/consolidation", tags=["consolidation"])
logger = logging.getLogger(__name__)


async def run_consolidation_with_log(triggered_by: str = "scheduler") -> dict:
    """Run consolidation and write a ConsolidationRun log entry. Used by the scheduler."""
    run_id = str(uuid.uuid4())

    async with AsyncSessionLocal() as db:
        run = ConsolidationRun(
            id=run_id,
            triggered_by=triggered_by,
            started_at=datetime.now(timezone.utc),
            status="running",
        )
        db.add(run)
        await db.commit()

    try:
        result = await _run(triggered_by=triggered_by)
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(ConsolidationRun).where(ConsolidationRun.id == run_id)
            )
            run = res.scalar_one()
            run.status = "complete"
            run.clusters_found = result["clusters_found"]
            run.reflections_created = result["reflections_created"]
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
        return {**result, "run_id": run_id}
    except Exception as e:
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(ConsolidationRun).where(ConsolidationRun.id == run_id)
            )
            run = res.scalar_one_or_none()
            if run:
                run.status = "failed"
                run.error = str(e)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
        raise


@router.post("/run")
async def trigger_consolidation(db: AsyncSession = Depends(get_db)):
    """Manually trigger the memory consolidation pipeline."""
    run_id = str(uuid.uuid4())
    run = ConsolidationRun(
        id=run_id,
        triggered_by="manual",
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    db.add(run)
    await db.commit()

    try:
        result = await _run(triggered_by="manual")
        run.status = "complete"
        run.clusters_found = result["clusters_found"]
        run.reflections_created = result["reflections_created"]
        run.completed_at = datetime.now(timezone.utc)
    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        run.completed_at = datetime.now(timezone.utc)
        logger.error(f"Consolidation run failed: {e}")
        result = {"clusters_found": 0, "reflections_created": 0, "errors": [str(e)], "details": []}

    await db.commit()
    return {"run_id": run_id, **result}


@router.get("/runs")
async def list_runs(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """List past consolidation runs."""
    result = await db.execute(
        select(ConsolidationRun)
        .order_by(ConsolidationRun.started_at.desc())
        .limit(min(limit, 50))
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "triggered_by": r.triggered_by,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "clusters_found": r.clusters_found,
            "reflections_created": r.reflections_created,
            "status": r.status,
        }
        for r in runs
    ]


@router.get("/reflections")
async def list_reflections(project_id: str, limit: int = 20):
    """List synthesised Reflection nodes from the knowledge graph, scoped to a project."""
    return await get_reflections(project_id, limit=min(limit, 50))
