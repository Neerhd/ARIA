# ARIA Multi-Provider Model Router — Redesign Spec

**Status:** Spec Draft — Phase 0 required before any build work
**Scope:** Replaces Section 5.3 of the BRD (Intelligent Model Router / T1-T2-T3 local+cloud tiers) entirely. Drops Ollama and local model serving. Backend (`router_service.py` rewrite, new provider adapters) + frontend (role/model settings UI, manual model picker).

**Explicit trade-off, on record:** this removes local/free operation for chat. The BRD's "no mandatory cloud dependency" and "zero subscription cost" goals (Sections 3.1/3.2) no longer hold for the chat path once this ships. File access, memory storage, and the graph still run locally — only model inference moves to cloud providers. Flagging this for the BRD update rather than silently changing it.

---

## Core design (locked, per your direction)

- **Ollama and local tiers are removed**, not kept as a fallback.
- **Two routing modes, both available, toggleable like today's tier system:**
  - **Auto** — ARIA classifies the message into a *role* and routes to whatever model you've assigned that role.
  - **Manual** — you pick a specific model for that message directly, bypassing classification.
- **Roles replace tiers.** Instead of complexity-based T1/T2/T3, you define task categories and assign a model to each. Starting set (edit freely once built):
  - Quick Chat — casual/simple questions
  - Coding
  - Research — web-grounded questions
  - Calculation / Reasoning
  - Creative Writing
  - Agentic / Tool-use — anything requiring file_reader, file_writer, calendar (once built), etc.
- **Providers in scope:** Anthropic (already integrated), OpenAI, Perplexity, xAI (Grok), Google (Gemini).

---

## New pieces required

| # | Piece | Why |
|---|-------|-----|
| 1 | Provider adapter layer | Each provider has a different request/response shape and tool-calling format — Anthropic's is already wired in `router_service.py`; OpenAI/Gemini/Grok/Perplexity each need their own adapter behind one common interface |
| 2 | Role classifier | Replaces the old signal-based tier logic (file attached → T2, tools enabled → T3) with intent classification for Auto mode. Recommend keeping the existing hard signals as overrides (e.g. "tools enabled" always forces Agentic role) and adding a lightweight classifier only for the ambiguous cases — cheaper and more predictable than classifying every message from scratch |
| 3 | Role → model settings UI | Where you assign a model to each role, and switch Auto/Manual |
| 4 | Manual model picker | Per-message model selector in the chat UI |
| 5 | API key management | Secure local storage for each provider's key — you'll need accounts/keys for whichever providers you actually want live |
| 6 | Usage/cost tracking | Not in your ask directly, but strongly recommended — there's no more free fallback, so cost is now invisible unless surfaced somewhere. Even a simple per-day token/spend log prevents surprise bills |

---

## Open decisions for Phase 0

1. **Perplexity vs. web_search tool for Research role.** Does Perplexity fully replace the SearXNG-based web_search tool for that role, or run alongside it? Recommend: let Perplexity handle Research natively, keep web_search available to *other* roles that need a quick lookup without switching models.
2. **Classifier model.** Auto mode needs something to decide "which role is this message" before the real model even runs — recommend a small, cheap call (e.g. Haiku-class) rather than spending a full Grok/GPT call just to classify. Confirm which provider you want doing this housekeeping job.
3. **Default role→model mapping.** Needs a sensible starting point before you've configured anything. Proposed default, confirm or edit:
   - Quick Chat → Claude Sonnet
   - Coding → GPT (latest)
   - Research → Perplexity
   - Calculation/Reasoning → Grok
   - Creative Writing → Claude Sonnet
   - Agentic/Tool-use → Claude Sonnet (matches current T3 behavior)
4. **Fallback on provider failure.** If a role's assigned provider is down or rate-limited, what happens — hard error, or silently fall back to a different configured provider? Recommend: surface the error clearly rather than silently substituting, since silent model swaps make output quality unpredictable in exactly the way this whole change is trying to fix.
5. **Existing tool-calling code.** `tool_service.py`'s three tools are currently written against Anthropic's tool-calling format. Confirm scope: does every provider need to support all three tools, or only the ones assigned to the Agentic role?

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*

- Confirm current `router_service.py` structure precisely — what needs to be removed (Ollama dispatch) vs. what's reusable (Anthropic dispatch becomes one of five adapters).
- Confirm `tool_service.py`'s tool schemas and how provider-specific they are — this determines how much adapter work each new provider needs for Agentic role support.
- Confirm which provider API keys you already have vs. need to acquire.
- Propose the role classifier approach and cost (rough $ per classification at expected message volume).
- Report proposed file-touch list and recommendations on the five open decisions above before building anything.

## Phase 1 — Provider adapter layer
- Common interface: `send(messages, tools?) → response` regardless of provider.
- Adapters for OpenAI, Perplexity, Grok, Gemini — Anthropic adapter refactored from existing code, not rewritten.
- Remove Ollama dispatch path entirely.

## Phase 2 — Role system & classifier
- Role definitions (config, editable).
- Classifier call wired into the chat pipeline, with hard-signal overrides preserved from the old router logic.
- Manual mode bypass.

## Phase 3 — Settings UI
- Role → model assignment screen.
- Auto/Manual toggle.
- Manual per-message model picker in chat.
- API key entry per provider.

## Phase 4 — Cost tracking (recommended addition)
- Log tokens/cost per request, per provider, per role.
- Simple daily/weekly view — doesn't need to be elaborate for v1.

## Phase 5 — QA & Regression
- Confirm M9 theming intact (new UI surfaces use existing tokens, no overrides).
- Confirm M10 project scoping unaffected — routing changes shouldn't touch memory scoping at all.
- Confirm existing tools (web_search/file_reader/file_writer) still work under at least one non-Anthropic provider assigned to Agentic role, to prove the adapter layer's tool-calling actually works cross-provider, not just for Claude.
- Confirm removing Ollama doesn't break anything that assumed it was always available (check for hardcoded references).

## Phase 6 — Git & BRD update
- Standard push-gate, confirm before pushing to main.
- Flag for BRD v2.4: Section 5.3 rewritten, Section 6 tech stack table updated (Ollama removed, providers added), Sections 3.1/3.2 goals need an honest amendment given the cost/privacy trade-off.

---

## Explicitly out of scope for this pass
- Local models as a fallback option — dropped per your direction, not deferred.
- Multi-provider support for the STT/voice command layer (separate spec, separate concern).
- Automatic cost caps or spend limits — tracking only for v1, not enforcement.
