# ARIA M14 — Inline Memory Provenance & Transparency

**Status:** Ready for Claude Code handoff
**Scope:** Backend (expose what memory a reply actually drew on) + frontend (show it inline, by default, in every reply that used memory). No new retrieval mechanism — this makes existing retrieval visible, it doesn't invent new ways to fetch things.

---

## The problem this solves

Memory in most AI assistants — ARIA included, today — is a black box. The assistant "knows" things about you and quietly folds them into its answers, but there's no way to see *why* it said something, *which* past conversations shaped a given claim, or *whether* the thing it's drawing on is still accurate. When ARIA says "you tend to gravitate toward complex systems in your design work," there's currently no way to ask "wait, what specifically made you think that?" — you either trust it or you don't.

That opacity is the actual trust problem with memory-augmented AI: personalization feels like it's happening *to* the user rather than something they can inspect and correct. Two ways to attack this were discussed:

1. **Click-a-node interrogation** (a natural extension of M12's graph view + M13's `query_graph` tool) — select a specific Episode/Concept/Reflection and ask it directly about its own connections. Powerful, genuinely differentiating, but power-user: it only helps the person who knows the Graph view exists, opens it, and goes looking.
2. **Inline provenance in the default chat reply** — every reply that draws on memory shows *what it's based on*, with zero extra steps. This is the one that benefits every user of every reply, not just the curious minority — and it's the one this spec covers. Click-a-node interrogation remains a valuable follow-on (M15+), not a replacement.

The core insight de-risking this: **ARIA already retrieves grounded material before every memory-informed answer** — it just never shows its work. This is a disclosure problem, not a retrieval problem.

---

## Where retrieval already happens silently (for Phase 0 to confirm precisely)

- `services/memory_service.py::search_memory()` — called on **every** chat turn in `api/chat.py::send_message()`, regardless of which tools are enabled. Returns recalled Episode ids/text/distance, folded invisibly into the system prompt as `memory_context`.
- `services/graph_service.py::get_pinned_facts()` — permanent user-pinned facts, injected into every turn's system prompt, also invisible.
- `services/graph_query_service.py::query_graph()` (M13) — the NL-to-Cypher tool. Generates and executes a query, gets rows back, synthesizes an answer — the rows themselves are discarded after synthesis rather than surfaced.

All three already know exactly what they retrieved. None of it reaches the user today.

---

## Design decisions (locked)

- **Surfacing, not new retrieval.** This feature exposes what's already fetched (recalled episodes, pinned facts, `query_graph` result rows) — it does not add new queries or a new retrieval path.
- **On by default, in the normal reply.** No separate view, no opt-in tool required to see provenance — contrast with M12's graph view and M13's `query_graph` tool, which remain the deeper "go interrogate it yourself" surfaces.
- **Respects existing scoping.** Whatever provenance shows must never surface memory from a project other than the active one (M10), and must never break M9 theming or regress M11/M12/M13.

## Hard constraints

- No regression to M9 (theming), M10 (project scoping), M11 (Memory Browser + counter fix), M12 (graph endpoint, read-only), or M13 (`query_graph`, read-only safety boundary).
- No added LLM round-trip purely for provenance — reuse data already being fetched during the normal reply, don't spend an extra generation call summarizing what was retrieved unless Phase 0 finds a concrete reason one is needed.
- Provenance must never display raw prompt/response text from a *different* project's Episodes, even as a citation — same boundary M10/M12/M13 already enforce.

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*
- Confirm the three silent-retrieval paths above still match reality (function names, call sites, what data is available at each point).
- Confirm what's structurally available to build a citation from at each path (e.g. `search_memory` returns Episode ids — confirm what's cheaply fetchable from those: timestamp, conversation, topics).
- **Open decision — coverage scope:** does provenance apply to (a) the always-on ChromaDB semantic recall + pinned facts (runs on literally every message, touches the core `send_message()` path), (b) only opt-in tool-based retrieval (`query_graph`, already isolated), or (c) both? These have very different blast radii — (a) is a broad, core-path change; (b) is narrow and already isolated in `graph_query_service.py`. Recommend based on what's found, don't assume.
- **Open decision — display format:** a compact inline footer (e.g. "Based on 2 past conversations, Jun 3 & Jul 1") vs. an expandable/clickable citation (click to see the actual snippet, or jump straight into the M11 Memory Browser on that item)? Propose based on effort vs. value, flag the tradeoff.
- Report proposed file-touch list and both open-decision recommendations before changing anything.

## Phase 1 — Backend: capture and expose provenance data
- Thread the retrieved-source metadata (not full prompt/response text — ids, timestamps, topic/concept names, same "lean payload" discipline as M12's `/graph` endpoint) through to the chat response, scoped per whatever Phase 0 decided for coverage.
- `ChatResponse` gains a structured `sources` field (or equivalent) alongside `reply`.

## Phase 2 — Frontend: render inline provenance
- `MessageList.jsx` shows the sources indicator on assistant messages that used memory, per the format decided in Phase 0.
- Click-through reuses the M11 Memory Browser detail view (same precedent M12/M13 already established) — no duplicate detail UI.
- M9 theming governs the chrome; no new component overrides.

## Phase 3 — QA & Regression
- Confirm M9 theming intact.
- Confirm M10 project scoping still holds in what provenance displays (no cross-project leakage in a citation).
- Confirm M11 Memory Browser, M12 graph endpoint, and M13 `query_graph` are all unaffected (this is additive, not a rewrite of any of their paths).
- Confirm no added latency from a redundant LLM call.

## Phase 4 — Git
- Confirm current branch, same push-gate as M11/M12/M13 — stop and ask before pushing to main/master.
- Report commit hash and push status.

---

## Open decisions requiring input during Phase 0
1. Coverage scope: always-on recall + pinned facts, `query_graph` only, or both.
2. Display format: compact footer vs. expandable/clickable citation.

## Explicitly out of scope for this spec
- Click-a-node interrogation from the Graph view (the "talk to a specific node" idea) — a strong follow-on, not part of this pass.
