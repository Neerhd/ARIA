"""Usage & cost tracking — one row per AI API call, with an estimated cost.

Prices are public per-million-token rates, hard-coded as estimates (they
drift; update the table when providers change pricing). Tracking must never
break a chat request, so recording failures are swallowed with a warning.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Usage rows are enqueued, not written inline: a chat request holds a SQLite
# write transaction for its whole duration (conversation insert flushes at the
# start, commit at the end), so a mid-request insert from a second connection
# just hits "database is locked". The writer task drains the queue in the
# background, retrying until the lock frees.
_queue: asyncio.Queue = asyncio.Queue()

# (input $/MTok, output $/MTok) — estimates, not a billing source of truth.
_PRICES: dict[str, tuple[float, float]] = {
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "gpt-5.1": (1.25, 10.00),
    "gpt-5-mini": (0.25, 2.00),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.30, 2.50),
    "grok-4": (3.00, 15.00),
    "grok-4-fast": (0.20, 0.50),
    "sonar-pro": (3.00, 15.00),
    "sonar": (1.00, 1.00),
}

# Unknown model → assume the provider's strong-model pricing (overestimates,
# which is the safe direction for a budget readout).
_PROVIDER_FALLBACK: dict[str, tuple[float, float]] = {
    "anthropic": (3.00, 15.00),
    "openai": (1.25, 10.00),
    "google": (1.25, 10.00),
    "xai": (3.00, 15.00),
    "perplexity": (3.00, 15.00),
}


def estimate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _PRICES.get(model) or _PROVIDER_FALLBACK.get(provider, (3.00, 15.00))
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000


async def record_usage(
    provider: str, model: str, purpose: str, role: str,
    input_tokens: int, output_tokens: int,
) -> None:
    """Enqueue one usage row for the background writer. Never raises."""
    try:
        _queue.put_nowait({
            "provider": provider,
            "model": model,
            "purpose": purpose,
            "role": role or "",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        logger.warning(f"Usage enqueue failed: {e}")


async def usage_writer() -> None:
    """Background task (started in main's lifespan): drains the usage queue
    into SQLite, retrying while a chat request's transaction holds the write
    lock."""
    from database.sqlite import AsyncSessionLocal
    from models.schemas import UsageLog

    while True:
        item = await _queue.get()
        for attempt in range(10):
            try:
                async with AsyncSessionLocal() as db:
                    db.add(UsageLog(
                        id=str(uuid.uuid4()),
                        cost_usd=estimate_cost(
                            item["provider"], item["model"],
                            item["input_tokens"], item["output_tokens"],
                        ),
                        **item,
                    ))
                    await db.commit()
                break
            except Exception as e:
                if attempt == 9:
                    logger.warning(f"Usage recording dropped after retries: {e}")
                else:
                    await asyncio.sleep(1.5)


async def usage_summary(days: int = 7) -> dict:
    """Aggregate the last N days of usage. Volumes are tiny (one row per API
    call of a single-user app), so aggregation happens in Python."""
    from sqlalchemy import select
    from database.sqlite import AsyncSessionLocal
    from models.schemas import UsageLog

    cutoff = datetime.utcnow() - timedelta(days=days - 1)
    cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UsageLog).where(UsageLog.created_at >= cutoff))
        rows = result.scalars().all()

    total = {"cost_usd": 0.0, "input_tokens": 0, "output_tokens": 0, "calls": 0}
    per_day: dict[str, float] = {}
    by_provider: dict[str, float] = {}
    by_purpose: dict[str, float] = {}

    for r in rows:
        total["cost_usd"] += r.cost_usd
        total["input_tokens"] += r.input_tokens
        total["output_tokens"] += r.output_tokens
        total["calls"] += 1
        day = r.created_at.date().isoformat() if r.created_at else "unknown"
        per_day[day] = per_day.get(day, 0.0) + r.cost_usd
        by_provider[r.provider] = by_provider.get(r.provider, 0.0) + r.cost_usd
        by_purpose[r.purpose] = by_purpose.get(r.purpose, 0.0) + r.cost_usd

    return {
        "days": days,
        "total": total,
        "per_day": [{"date": d, "cost_usd": c} for d, c in sorted(per_day.items(), reverse=True)],
        "by_provider": by_provider,
        "by_purpose": by_purpose,
        "note": "Costs are estimates from public per-token prices — check your provider's console for exact billing.",
    }
