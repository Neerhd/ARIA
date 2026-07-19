# ARIA BRD v2.4 — Amendments (Multi-Provider Model Router / M15)

**Purpose:** the exact changes to fold into `ARIA_BRD_v2_3.docx` to produce v2.4.
Written as a redline companion because the BRD lives in Word format. Once
applied, this file can be deleted.

**What shipped (M15, July 2026):** the local three-tier router (Ollama
llama3.2 / qwen2.5 + optional cloud T3) was replaced by a multi-provider,
task-role-based router. Ollama and local model serving were removed entirely
— not kept as a fallback (explicit product decision, on record in
`ARIA_MultiProvider_Router_Spec.md`).

---

## 1. Section 3.1 / 3.2 — Goals (honest amendment)

The following original goals **no longer hold for model inference** and must
be amended rather than silently left in place:

> ~~"No mandatory cloud dependency"~~ / ~~"Zero subscription cost"~~ /
> ~~"Works fully offline"~~

**Replacement text:**

> ARIA's data layer — conversation history, semantic memory, the knowledge
> graph, pinned facts, and attached files — remains 100% local with no cloud
> dependency. Model inference (chat replies, task classification, topic
> extraction, and memory consolidation) runs through third-party AI providers
> using the user's own pay-per-use API keys. There is no subscription and no
> ARIA-operated cloud service; the trade-offs accepted are (a) chat requires
> an internet connection and at least one funded provider account, and
> (b) message content is sent to the selected provider at inference time.
> A built-in usage meter keeps this per-use cost visible (Section 5.3.6).

Note the scope is wider than the original spec draft stated: memory-layer
inference (topic tagging, reflection synthesis) also moved to cloud, since it
previously ran on the local model. Storage stays local; synthesis does not.

## 2. Section 5.3 — Intelligent Model Router (full rewrite)

Replace the entire T1/T2/T3 tier description with:

### 5.3.1 Providers
Five providers behind one adapter layer: **Anthropic, OpenAI, Google, xAI,
Perplexity** — two wire formats total (Anthropic native; OpenAI-compatible
for the rest). Any subset may be configured. **The first configured provider
(priority order: Anthropic → OpenAI → Google → xAI → Perplexity) becomes the
default**; no provider is hardcoded as required. Perplexity is flagged
`supports_tools: false` (no function calling) and is dispatched without tools.

### 5.3.2 Task roles (replaces tiers)
Six user-editable roles: Quick Chat, Coding, Research, Calculation &
Reasoning, Creative Writing, Agentic & Tools. Each role maps to a
provider+model; unassigned roles follow the default provider dynamically
(budget model for Quick Chat, main model otherwise). Assignments persist in
`backend/data/role_assignments.json`.

### 5.3.3 Routing modes
- **Auto** — a budget-model classifier (~$0.0005/message) labels each message
  with a role; the role's assigned model answers. Classifier failure falls
  back to the default model (never blocks a reply).
- **Manual** — standing per-conversation model pick via pills above the
  composer, plus a one-shot retry-with-model menu on any reply.
- **Ask mode is removed.** Its premise (permission before escalating to a
  *paid* tier) is meaningless when all inference is paid; the usage meter
  replaces it. Legacy "ask" requests are treated as Auto.

### 5.3.4 API key management
Keys enter via `.env` or the Settings UI (verified with a live provider call
before acceptance; stored in `backend/data/provider_keys.json`, chmod 600,
write-only through the API — never returned to the frontend; UI-stored keys
take precedence over `.env`). A first-run welcome screen handles the zero-key
state.

### 5.3.5 Tool calling
Tool schemas are OpenAI-format and pass unchanged to OpenAI-compatible
providers; a converter targets Anthropic's format. Four tools: web_search,
file_reader, file_writer, query_graph. Tools are always available; the model
decides relevance. The old tier-escalation/refusal-regex machinery is deleted.

### 5.3.6 Usage & cost tracking (new)
Every AI call (chat, classifier, memory upkeep, graph queries, key checks)
logs provider/model/purpose/role/tokens plus an **estimated** cost from a
hard-coded public-price table, via an in-memory queue drained by a background
writer (required: chat requests hold the SQLite write lock for their
duration). Settings shows a 7-day view: total, per-day, per-activity.
Tracking only — no spend caps in v1 (unchanged from spec).

## 3. Section 6 — Tech stack table

- **Remove rows:** Ollama, llama3.2:3b, qwen2.5:14b (local model serving).
- **Add row:** "Model inference — Anthropic / OpenAI / Google / xAI /
  Perplexity APIs via user-supplied keys; two adapter wire-formats."
- **Unchanged:** FastAPI, React/Vite, SQLite, ChromaDB (embeddings use
  Chroma's built-in local embedder — never depended on Ollama), Neo4j,
  SearXNG (still local and free, backs the web_search tool).

## 4. Milestone table

Add: **M15 — Multi-Provider Model Router — ✅ Complete (2026-07-18).**
Mark M5 as "Superseded by M15".

## 5. Known gap (for the QA section)

Cross-provider tool-calling is **implemented but unverified against a live
non-Anthropic provider** (no second key was available at build time; owner
declined acquiring one for now). The code path is shared, so risk is low, but
the first time a non-Anthropic key is added, run: assign Agentic role to that
provider → ask ARIA to write a file → confirm the file lands.
