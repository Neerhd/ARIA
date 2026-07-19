# ARIA Projects — Phased Implementation Spec

**Status:** Ready for Claude Code handoff
**Scope:** Backend (FastAPI, SQLite, Neo4j) + Frontend (project switcher UI). This is the dependency root for per-project subgraphs — do not skip ahead to subgraph work until this closes.

---

## Core design decision (locked)
**Concepts are global. Episodes are project-scoped.**
- Episode nodes gain a `project_id` property.
- Concept nodes are unchanged — no `project_id`, no duplication per project.
- Recall and consolidation queries filter at the Episode level when traversing DISCUSSES/ABOUT edges.
- Rationale: a topic recurring across projects (e.g. "client management") is real signal ARIA should keep connecting. Full siloing would lose that and is harder to undo later than to add.

If this turns out wrong in practice, the fix is adding `project_id` to Concept and duplicating hub nodes per project — flag if you'd rather build that from the start.

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*
- Locate current session/conversation storage in SQLite — confirm schema (conv_id, table structure)
- Confirm how the frontend currently creates/lists conversations
- Confirm current Neo4j Episode node write path (from the memory system explainer: FastAPI → Ollama enrichment → Episode node)
- Propose a migration path for existing conversations/episodes (default: assign all to a "Default" project on migration, not delete or block)
- Report proposed file-touch list before changing anything

## Phase 1 — Data Model
- SQLite: new `projects` table (id, name, description, created_at)
- SQLite: `project_id` FK added to the sessions/conversations table
- Neo4j: `project_id` property added to Episode node creation (Section 3.3/3.4 of the memory system explainer)
- Concept, Reflection nodes: **no schema change**
- Migration script: existing episodes/sessions backfilled to a "Default" project — never silently drop data

## Phase 2 — Backend API
- `POST /projects`, `GET /projects`, `GET /projects/{id}`, `PATCH /projects/{id}`, `DELETE /projects/{id}`
- `project_id` becomes a required/default param on chat endpoints (new sessions must belong to a project)
- Recall query update: Neo4j traversal (Section 7.2 of the memory explainer) adds `WHERE e.project_id = $projectId` when matching Episode nodes reached via Concept edges — Concept lookup itself stays unfiltered
- Consolidation pipeline update: episode clustering (Section 6.1) scoped to `project_id` — patterns synthesise per-project, not globally, for MVP
- Routing logs, recall counters: no change needed, these are per-episode already

## Phase 3 — Frontend
- Project switcher in the nav (list, create, rename, delete)
- New conversation defaults to the active project
- Existing conversations show which project they belong to
- No new shadcn component overrides — reuse Tabs/Sheet/DataTable primitives from the M9 token system already in place

## Phase 4 — Memory Scoping Verification
- Confirm recall for a message in Project A never surfaces Episodes from Project B
- Confirm a Concept shared across two projects still traverses correctly to both projects' Episodes when queried from within either project
- Confirm consolidation only clusters Episodes within the same project

## Phase 5 — QA & Regression
- Confirm M9 theming untouched
- Confirm tool system (web_search/file_reader/file_writer) still functions with project-scoped sessions
- Confirm migrated "Default" project contains all pre-existing conversations, none lost
- Screenshot/log the before/after for the BRD record

---

## Open decision carried forward
None outstanding — the Concepts-global design is locked above. Revisit only if Phase 4 verification surfaces cross-project bleed that global Concepts can't cleanly resolve.
