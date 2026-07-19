# ARIA M13 — Chat With The Graph

**Status:** Ready for Claude Code handoff
**Scope:** New agent tool (NL → Cypher → natural-language answer), backend only + tool registration. No new frontend view required — this surfaces through the existing chat interface as a fourth tool alongside web_search/file_reader/file_writer.

---

## Design decisions (locked)

**Routing:** Hard-routed to T3, same as the other three tools (Section 5.4 of the BRD — "local models do not reliably generate structured tool_calls"). No exception for this tool; NL-to-Cypher generation needs T3's reliability even more than the existing tools do, since a malformed Cypher query is a worse failure mode than a malformed file path.

**Safety boundary:** Read-only. This tool must only ever execute `MATCH`/`RETURN`-style Cypher — no `CREATE`, `DELETE`, `SET`, `MERGE`, `DETACH DELETE`. Enforce this at the query-execution layer (allowlist query patterns or reject on write-clause keywords), not just via prompt instruction — the M12 incident (raw Cypher `DETACH DELETE` bypassing app logic during manual testing) is exactly the failure mode this must be structurally immune to, not just discouraged from.

**Scoping:** Consistent with M10/M11/M12 precedent — queries scope to the active project's Episodes/Reflections by default; Concepts remain global and queryable regardless of active project, since that's their designed role as cross-project hubs.

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*
- Confirm the existing tool registration pattern (tool_service.py) and how the other three tools are schema-defined
- Confirm Neo4j driver/connection access available to a new tool executor
- Propose the write-clause rejection mechanism (regex/keyword denylist vs. a proper Cypher parser check) — flag tradeoffs
- Report proposed file-touch list before changing anything

## Phase 1 — NL-to-Cypher Generation
- New tool: `query_graph(question: str)` — takes a natural-language question, generates a read-only Cypher query via T3, executes it, returns results
- System prompt for the generation step should include the four node types and four edge types (Episode/Concept/Reflection/Fact, DISCUSSES/NEXT/SYNTHESISED_FROM/ABOUT) so generated queries use real schema, not hallucinated labels
- Reject and retry (once) if the generated query contains a write clause; surface a clear error to the user if it still fails, do not silently execute anyway

## Phase 2 — Result Synthesis
- Raw Cypher results get passed back to the model to produce a natural-language answer, not returned as raw graph data to the user
- Handle empty-result case gracefully ("no matching memories found" rather than a confusing blank answer)

## Phase 3 — Scoping & Tool Registration
- Wire project_id into the generated query's parameters, consistent with existing scoping
- Register as a fourth tool in the Settings UI tool list (Section 5.4) — reuse the existing pill/toggle pattern, no new component overrides
- Confirm it correctly hard-routes to T3 like the other three tools

## Phase 4 — Safety Verification
- Explicitly attempt to prompt-inject a write query through the NL interface (e.g. "delete all episodes about X") and confirm it's rejected at the execution layer, not just refused by the model's judgment
- Confirm read-only behavior the same way M12 confirmed it: hit the tool repeatedly, verify zero row-count movement in SQLite/Neo4j

## Phase 5 — QA, Regression, Git
- Confirm M9/M10/M11/M12 unaffected
- Same git discipline as M11/M12: confirm branch, stop and ask before pushing to main/master
- Report commit hash and push status
- **Explicitly flag for the founder to manually verify**: actually ask ARIA a few real questions through this tool and confirm the answers are sensible — a "read-only and doesn't crash" verification is not the same as "gives useful answers," and that gap should not be silently assumed closed the way M12's visual gap almost was

---

## Open decisions requiring your input before Phase 1 ships
1. Write-clause rejection mechanism: keyword denylist (fast, some false-negative risk) or a lightweight Cypher parse check (more robust, more Phase 0 effort) — confirm preference or let Claude Code propose during Phase 0.
