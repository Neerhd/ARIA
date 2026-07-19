# ARIA Model Router — Spec, Scope & BRD

## 1. Problem (BRD)

The tier router (T1 local-small / T2 local-large / T3 Claude Sonnet cloud) is supposed to minimize cost and latency by defaulting to local models and escalating only when a message genuinely needs more. In practice:

- **Tools force T3 permanently.** `toolsEnabled` is global, localStorage-persisted app state (`frontend/src/App.jsx:124-134`), sent on every message (`App.jsx:190`) regardless of conversation. `router_service.py:46-49` forces tier 3 the instant any tool is enabled, so once a tool is toggled on, every message — even plain text — gets routed to paid Claude Sonnet.
- **Manual mode is a sticky floor, not a per-message choice.** `App.jsx:187-188` sends the last-used `conversationTier` as `override_tier` on every message in manual mode; `chat.py:127-133` treats that as authoritative and skips signal classification entirely.
- **T2 is structurally starved.** T2 has one narrow trigger (file attached / 15+-message thread); T3 has four broad triggers (any tool), and `tier = max(...)` means T3 always wins on conflict. Result: T2 is almost never selected.
- **Users can't meaningfully choose a tier.** Exposing raw T1/T2/T3 picking assumes technical knowledge users don't have.

## 2. Goals

- Every message is classified fresh from its own signals — no cross-message/cross-conversation carry-over.
- Tools are always available to the model; tier is no longer pre-committed by a standing toggle.
- T3 (cloud, costs money) is reserved for confirmed tool use or genuinely hard reasoning — not "a tool is enabled somewhere."
- T2 becomes the real default working tier for non-trivial messages.
- Manual mode gives users control without exposing tier numbers they can't reason about.
- Ask mode's confirm-before-upgrade prompt becomes rare and trustworthy, not constant noise.

## 3. Non-Goals

- Not changing which models back each tier (`llama3.2:3b` / `qwen2.5:14b` / `claude-sonnet-4-6`, `backend/config.py:22-26`).
- Not building a full cost-tracking/budget UI (future work).
- Not changing memory/graph/episode storage behavior.

## 4. Proposed Design

### 4.1 Tools

Remove the tools toggle as a tier gate. Tools (`web_search`, `file_reader`, `file_writer`, `query_graph`) are always passed to the agentic loop (`tool_service.py:118-120`, `chat.py:262-266`); the model decides per-message whether to invoke one via function-calling, same as any other capability.

### 4.2 Tier boundaries (revised `classify_action`)

- **T1** — short, simple, stateless exchange; no attachment; short thread; no tool call needed.
- **T2** — default for real conversations: file attached, longer thread, moderate reasoning, or a tool call that a capable local model can execute reliably.
- **T3** — reactive escalation only: the model attempts a tool call the local tier can't execute reliably, or reasoning demonstrably exceeds T2 capability. Not pre-declared by a standing flag.

### 4.3 Routing modes (UX)

- **Auto** — fully automatic, recomputed per message, no confirmation.
- **Ask** — same computation as Auto, but pauses for confirmation only when escalating above T1 (unchanged trigger logic at `chat.py:136`), which will now fire rarely since T3's surface narrows.
- **Manual** — replace raw tier picker with a coarse preference ("fast & free" vs "best quality") that nudges classifier thresholds; tier becomes a passive, display-only badge (already exists at `InputBar.jsx:154-166`), never a per-message input the user must set.

### 4.4 State scoping fix (applies regardless of above)

- `conversationTier` must never be sent as an input/floor for the next message's classification — display-only.
- Remove `toolsEnabled` from request payload as a tier signal (still sent as available capabilities, not as an escalation trigger).

## 5. Scope

**In scope:** `backend/services/router_service.py` (`classify_action`), `backend/api/chat.py` (routing branch), `frontend/src/App.jsx` (state scoping), `frontend/src/components/input-bar/InputBar.jsx` (manual mode UI), `frontend/src/components/settings/ToolsSection.jsx` / `RoutingModeSection.jsx`.

**Out of scope:** model swap, new tiers, budget/cost UI, non-router backend changes.
