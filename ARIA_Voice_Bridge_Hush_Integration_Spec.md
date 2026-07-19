# ARIA Voice Bridge — Hush Command Mode

**Status:** Spec Draft — Phase 0 required before any build work
**Scope:** Extends the existing **Hush** repo (OS-level capture/injection) with a second hotkey mode. Adds exactly one new endpoint to ARIA's FastAPI backend, plus one new tool (Calendar). Not a new milestone in the M-series numbering — this is a separate OS-integration component that *talks to* ARIA, not a change to ARIA's core memory/router architecture.

---

## The two modes, end to end

**Dictation mode (unchanged)** — tap hotkey, speak, transcript pastes into the focused field via clipboard. Exactly what Hush does today.

**Command mode (new)** — hold hotkey, speak, release:

1. On hotkey-down: snapshot the current clipboard contents (so we can restore it later), then simulate a copy (Cmd+C) to grab whatever's selected/focused in the active app — this becomes optional context, not the transcript.
2. Record until hotkey-up. Transcribe with Hush's existing STT.
3. Assemble a payload: `{transcript, active_app_name, selection_snapshot, timestamp}`.
4. POST to ARIA's new `/voice/command` endpoint.
5. ARIA reasons over transcript + active app + selection + its own memory/tools, returns final text.
6. Hush pastes the reply via the same clipboard-paste mechanism it already uses for dictation, then restores the original clipboard contents from step 1.

Two examples from your ask, traced through this flow:
- Notes.app open, hold hotkey, "fill this up with today's ARIA decisions with references to the source" → transcript + active_app=`Notes` → ARIA pulls the day's Episodes/Reflections from memory, writes a formatted summary with citations, pastes it in.
- Mail.app open on a specific email, hold hotkey, "write a response to this email" → transcript + active_app=`Mail` + selection_snapshot=the email body (grabbed via the Cmd+C step) → ARIA decides whether a plain reply suffices or whether it needs the Calendar tool, drafts, pastes.

---

## New pieces this requires (none of these exist today)

| # | Piece | Lives in | Why it's new |
|---|-------|----------|---------------|
| 1 | Active-app detection | Hush | Dictation mode never needed to know *what* app it's typing into |
| 2 | Selection-snapshot-on-hotkey-down | Hush | Simulated copy + clipboard read, done safely (see decisions below) |
| 3 | `POST /voice/command` endpoint | ARIA backend | New request shape distinct from normal chat turns |
| 4 | Calendar tool | ARIA backend | Referenced directly in your ask ("uses my calendar") — doesn't exist in the current tool system (web_search / file_reader / file_writer only) |
| 5 | Hard-route command-mode → T3 | ARIA router | Same existing pattern used for all tool-enabled requests |

---

## Design decisions needing your call in Phase 0

1. **Clipboard safety.** Simulating Cmd+C to grab context will clobber whatever the user had copied before. Recommend: snapshot-then-restore (step 1/6 above) so command mode is invisible to normal clipboard use. Flag if you'd rather skip the selection-grab entirely for v1 and only send transcript + app name.
2. **App-name handling.** Hardcode a map (`Notes.app` → notes-behavior, `Mail.app` → email-behavior) vs. just pass the raw app name and let ARIA reason about it in the system prompt. Recommend the latter — a hardcoded map duplicates reasoning ARIA can already do, and doesn't generalize to apps you didn't anticipate.
3. **Latency UX.** A T3 tool-calling round trip is a few seconds with no visible "typing" indicator once you're paste-based. Recommend a short earcon on hotkey-up ("heard you") so silence during those seconds doesn't read as a dropped command.
4. **Repo boundary.** Recommend this stays entirely in the Hush repo as a new module, with ARIA repo only gaining the endpoint + Calendar tool — keeps the OS-integration concern separate from ARIA's server-side stack, consistent with how Hush already exists independently.

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*

- Confirm Hush's current hotkey handler — what triggers start/stop of a capture today, tap vs. hold support already present or not.
- Confirm Hush's STT engine and exactly where the transcript string exists before the clipboard write.
- Confirm target OS — active-app detection and simulated-copy APIs are OS-specific (this matters if Hush is cross-platform; ARIA's own hardware target is Mac Mini / macOS per the BRD, so confirm whether Hush matches or needs to).
- Confirm the current clipboard-write function so command-mode replies can reuse it unchanged.
- Report proposed file-touch list in both repos before changing anything, plus a recommendation on decisions 1–4 above based on what's actually in the codebase.

## Phase 1 — Hush: command-mode capture
- Add hold-vs-tap detection to the existing hotkey handler (tap → dictation, unchanged; hold → command mode).
- Add active-app-name lookup on hotkey-down.
- Add clipboard-snapshot → simulated-copy → selection-read on hotkey-down, restore-original on completion.
- Assemble and send the command payload on hotkey-up.

## Phase 2 — ARIA: `/voice/command` endpoint
- New endpoint accepting `{transcript, active_app_name, selection_snapshot, timestamp}`.
- Hard-routes to T3 (same architectural pattern as existing tool-enabled requests, per Section 5.3/11 of the BRD).
- Reuses existing recall (memory_service) and, once built, the Calendar tool — no new retrieval mechanism beyond what's needed for calendar access.
- Returns plain text ready to paste — not a chat-formatted reply.

## Phase 3 — Calendar tool (dependency)
- New tool in `tool_service.py`, same registration pattern as web_search/file_reader/file_writer.
- Scope for v1: read-only (list upcoming events, check availability) — write access (creating events) explicitly out of scope unless you want it in.
- Hard-routes to T3 like the other tools already do.

## Phase 4 — Integration & QA
- End-to-end test: Notes.app summary-with-citations example.
- End-to-end test: Mail.app reply example, with and without calendar context needed.
- Confirm dictation mode (tap) is completely unaffected — zero regression.
- Confirm clipboard is restored correctly after command mode in every case, including if ARIA's request fails.
- Latency measurement for the T3 round trip; confirm earcon (if built) fires reliably.

## Phase 5 — Git
- Two repos, two push-gates. Confirm current branch in each; stop and ask before pushing to main in either.
- Report commit hashes and push status for both.

---

## Open decisions requiring your input during Phase 0
1. Clipboard safety approach (snapshot+restore vs. skip selection-grab for v1).
2. App-name handling (raw pass-through vs. hardcoded map).
3. Latency UX (earcon or silent).
4. Repo boundary confirmation (Hush-only vs. shared).

## Explicitly out of scope for this spec
- Calendar write access (creating/editing events) — read-only for v1.
- Any change to Hush's existing dictation-mode behavior.
- Multi-turn command conversations (each command is currently a single request/response — follow-up voice commands referencing the same context are a future extension, not v1).
