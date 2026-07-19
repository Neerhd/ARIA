# ARIA M12 — 3D Knowledge Graph Visualizer

**Status:** Ready for Claude Code handoff
**Scope:** New backend graph-data endpoint + new frontend 3D visualization view. No changes to existing memory write/recall/consolidation logic.

---

## Design decisions (locked)

**Library:** `react-three-fiber` + `three-forcegraph` (or `3d-force-graph` if it proves simpler to wire up) for force-directed 3D layout. Chosen over a 2D graph library specifically because you asked for 3D traversal.

**Scoping, consistent with M10/M11 precedent:**
- Default view = active project's Episode and Reflection nodes, plus the Concept nodes they connect to (Concepts render even though they're global, since they're the connective tissue).
- Toggle to "all projects" view for cross-project Concept exploration — this is where a Concept like "client management" showing up in two projects actually becomes visible and useful.

**Readability at scale:** current graph is small (49 episodes, 96 concepts) so this won't be an issue yet, but the design must not paint itself into a corner:
- Concept nodes act as visual hubs (per the memory system's own "bus stop" model) — cluster Episodes around their Concept by default rather than a flat force-directs-everything layout.
- Set a node-count threshold (proposed: 300) above which the view auto-collapses to Concept-level only, with Episodes revealed on click-in. Confirm this threshold or propose a better one during Phase 0.

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*
- Confirm current Memory Browser code (from M11) for reusable patterns — data fetching, project-context access
- Confirm three.js / react-three-fiber isn't already a dependency conflict
- Propose the node-count auto-collapse threshold based on realistic growth (confirm or revise the 300 default above)
- Report proposed file-touch list and new dependencies before installing anything

## Phase 1 — Backend Graph Endpoint
- New endpoint, e.g. `GET /graph?project_id={id}&scope={project|all}`
- Returns nodes (id, type, label, metadata) and edges (source, target, type) for Episode/Concept/Reflection nodes and DISCUSSES/NEXT/SYNTHESISED_FROM/ABOUT edges
- `scope=project` (default): Episodes/Reflections filtered to project_id, connected Concepts included regardless of their (nonexistent) project scoping
- `scope=all`: full graph, all projects
- Keep payload lean — no full episode/response text in the graph payload, just what's needed to render + a reference id for drill-in detail fetch

## Phase 2 — 3D Rendering Foundation
- New "Graph" view (Tabs entry, consistent with existing navigation)
- Render nodes with type-based visual encoding (distinct shape or size per Episode/Concept/Reflection — colors should respect the M9 grayscale token system, use shape/size for differentiation rather than color)
- Render edges with type-based styling (line style or thickness per DISCUSSES/NEXT/SYNTHESISED_FROM/ABOUT)
- Force-directed layout with Concept nodes as natural hubs

## Phase 3 — Interaction & Traversal UX
- Click a node to focus/expand its immediate connections
- Hover for a lightweight tooltip (label, type, recall count)
- Click-through to full detail (reuses Memory Browser's existing detail view from M11 rather than duplicating it)
- Project scope toggle (project / all) wired to the Phase 1 endpoint

## Phase 4 — Performance & Scale Safeguards
- Implement the node-count auto-collapse threshold from Phase 0
- Confirm smooth interaction at current real data volume (49/96/etc.) — this is a floor, not a ceiling, so also sanity-test with synthetic data at 2-3x the threshold if feasible

## Phase 5 — QA, Regression, Git
- Confirm M9 theming intact (grayscale tokens honored in the 3D view's UI chrome, even if node/edge rendering needs color for differentiation — justify any deviation)
- Confirm M10/M11 scoping unaffected — this is a read-only new view, should not touch write paths
- Confirm current branch before committing; same push-gate as M11 (stop and confirm before pushing to main/master)
- Report commit hash and push status

---

## Open decisions requiring your input before Phase 1 ships
1. Confirm or revise the 300-node auto-collapse threshold
2. Confirm `three-forcegraph` vs `3d-force-graph` — default to whichever Phase 0 discovery finds lower-friction to integrate, but flag the choice
