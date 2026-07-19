# ARIA Memory v2 — Roadmap & Spec

**Status:** Approved 2026-07-19. Layer 2 in build.
**Goal:** memory that remembers and recalls like a person — grounded in what
the user is doing and asking, with zero fabricated recall.

**Canonical target scenarios** (acceptance bar for every layer):
1. **The trip** (Jul 23–28, Rotterdam → Mannheim → Cochem → Luxembourg):
   dated itinerary facts, "what's the plan for the 25th?", research +
   checklist workflows, recall on the road via voice.
2. **The job dilemma** (startup offer vs. Booking process, notice deadline
   Jul 31): dated commitments/deadlines, decision ledger with rationale,
   recall of a month of negotiation history, eventually proactive deadline
   nudges.

---

## The layer stack

| # | Layer | Status |
|---|-------|--------|
| 1 | Foundation — multi-provider router, task roles, tools, voice, cost meter | ✅ shipped (M15 + voice bridge) |
| 2 | **Truthful recall** — relevance threshold, dated snippets, "don't confabulate" rule, Reflections join recall | 🔨 building now |
| 3 | Context-aware recall — cues from recent turns + active project/app; relevance × recency × importance scoring; date-based "yesterday/last week" lookups | next |
| 4 | Structured life knowledge — auto-capture (people, decisions+rationale, preferences, commitments & deadlines, open threads); superseding on contradiction; living editable profile replacing pinned-facts dump | after 3 |
| 5 | Proactivity — deadline nudges, morning/weekly briefings, dropped-thread detection via existing scheduler + macOS notifications. Needs its own mini-spec (silence rules) before build | after 4 |
| 6 | Connectors — mail read, calendar write, phone. Each a separate project with privacy trade-offs | later |

Order rationale: each layer depends on the one below — capture is worthless
if recall garbles it; nudges need dated commitments to nudge about.

---

## Layer 2 — Truthful recall (this build)

Problem being fixed: recall always injects the top-3 nearest snippets even
when none are relevant (the hallucination source), snippets carry no dates
(time questions answered from vibes), the model never says "I don't
remember," and nightly Reflections are never used in replies.

1. **Relevance bar** — retrieve wide, drop snippets beyond an empirically
   calibrated distance threshold (calibrated against the real ChromaDB, not
   guessed), cap what survives. Zero recalled memories is a valid outcome.
2. **Dated snippets** — store timestamps in ChromaDB metadata; render
   recalled memories as `[YYYY-MM-DD] …`. One-off backfill script copies
   timestamps from the matching Neo4j Episodes onto existing entries.
3. **Grounding rule** — chat + voice system prompts: statements about the
   user's past/preferences must be backed by retrieved memory or a
   query_graph result; otherwise say it's not in memory. General knowledge
   is unaffected.
4. **Reflections in recall** — new Reflections are indexed into ChromaDB at
   consolidation time (type="reflection"); existing ones backfilled; they
   appear in provenance as reflection sources.

**Verification:** before/after against real memory — an on-topic query must
recall dated, relevant snippets; a trap question about something never
discussed must produce "I don't have that in memory" with zero sources; a
bare greeting must inject zero memories.
