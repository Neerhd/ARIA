---
name: project-progress
description: ARIA milestone completion state — what's been built in each milestone
metadata:
  type: project
---

M1–M6 complete (MVP core). M9–M14 complete (theming, Projects, deferred fixes, 3D graph visualizer, NL graph querying, inline provenance). M7/M8 (MVP testing/hardening) remain planned but were deprioritised in favor of the M9–M14 track.

**Why:** BRD-driven milestones, but scope shifted after M6 toward UI polish, multi-project scoping, and memory transparency/explorability rather than a testing pass.

**How to apply:** Next work should reference M14 as the current milestone. M7/M8 are still open if a dedicated hardening pass is wanted later.

## Milestone summary

- M1: Local Ollama chat with SQLite persistence
- M2: ChromaDB vector memory (semantic recall)
- M3: Neo4j episodic memory (Episode + Concept nodes, DISCUSSES/NEXT edges)
- M4: Consolidation pipeline (Reflection nodes, nightly scheduler)
- M5: Action-based model router (auto/manual/ask modes, Tier 1–3)
- M6: Permanent memory — Fact nodes with user_pinned=true; remember-intent detection in chat; pinned facts injected into every system prompt; Pinned tab in Memory Browser with delete (two-click confirm)
- M9: UI theming — grayscale/OKLCH token system, radius 0, Geist Sans/Mono, dark mode, shadcn/ui primitives; removed all emoji and hardcoded brand colors from the interface
- M10: Projects — SQLite `projects` table + migration, Neo4j `Episode.project_id`, project-scoped recall/consolidation (Neo4j and ChromaDB both), CRUD API with cascading delete, frontend project switcher. Concepts stay global by design
- M11: Deferred fixes — `Concept.episode_count` now decrements on episode/project deletion (was increment-only, causing drift); Memory Browser scoped by project (Episodes/Reflections filtered, Concepts global with dual project/total count)
- M12: 3D knowledge graph visualizer — react-three-fiber + three-forcegraph, Concepts as force-layout hubs, click-to-focus with neighbor highlighting, hover tooltip, click-through to Memory Browser, project/all-projects toggle, auto-collapse above 300 nodes
- M13: Chat With The Graph — fourth agent tool `query_graph(question)`, NL-to-Cypher via T3, read-only enforced at two independent layers (string-literal-aware keyword denylist + Neo4j `execute_read` transaction, the latter verified to reject writes at the database engine level regardless of query text)
- M14: Inline memory provenance — "Based on:" citation footer on memory-informed chat replies, surfacing what ARIA already retrieves (ChromaDB recall, pinned facts) rather than new retrieval; click-through reuses the M12 Memory Browser mechanism. Not yet persisted to SQLite — citations don't survive reloading an older conversation (known follow-up)
