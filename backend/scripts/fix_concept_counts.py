"""
One-off, idempotent fix: recompute every Concept.episode_count from its real,
live DISCUSSES-edge count, correcting drift accumulated before decrement
logic existed (episode_count only ever incremented, never decremented on
episode/project deletion).

Safe to run multiple times — recomputes from ground truth each time.
Run from the backend/ directory: python scripts/fix_concept_counts.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.neo4j_client import close_neo4j_driver
from services.graph_service import recalculate_concept_counts


async def main():
    print("=== ARIA Concept episode_count backfill ===\n")
    changed = await recalculate_concept_counts()

    if not changed:
        print("No drift found — all Concept episode_counts already match reality.")
    else:
        print(f"Corrected {len(changed)} drifted concept(s):")
        for c in changed:
            print(f"  {c['name']!r}: {c['before']} -> {c['after']}")

    await close_neo4j_driver()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
