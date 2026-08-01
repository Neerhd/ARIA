# Claude Code Prompts — M16 Native macOS Desktop App

**How to use this file:** Save `ARIA_M16_Desktop_App_Spec.md` to the ARIA repo root first, then paste these prompts one at a time. **Do not paste the next prompt until you've reviewed and signed off the previous phase.** The gates are the point — they're what stopped M10, M11, and M12 from going sideways.

---

## PROMPT 1 — Phase 0 (Discovery)

```
Read ARIA_M16_Desktop_App_Spec.md in the repo root. This is Phase 0 only — the
discovery gate. Do not write, install, or change ANY code in this phase. No Rust
toolchain install, no npm install, no file edits. Investigation and a report only.

Work through the Phase 0 checklist in the spec and report back on all of it:

1. Verify the "What was found in the repo" section against the actual code. I had
   a read of this repo before writing the spec but you should confirm rather than
   trust it. Specifically confirm: the BASE = "/api" constant in
   frontend/src/services/api.js, the /api proxy in frontend/vite.config.js, the
   CORS allow_origins list in backend/main.py, the exact service startup order and
   sleep durations in scripts/start.sh, and the response shape of
   backend/api/health.py. Tell me where I was wrong.

2. Report the Rust/Tauri toolchain status on this machine and what would need
   installing, with rough download size. Do NOT install anything.

3. Confirm the current major version of Tauri and what webview origin it presents
   on macOS — I need this to know what to add to the CORS list.

4. Inventory EVERY place in the frontend that builds a request URL. I believe
   api.js is the only one but confirm it. Check useGraphData.js, anything hitting
   /voice, file upload, and the streaming path in particular.

5. Investigate how voice/recorder.py expects to be launched — does it need a TTY?
   Are mic and accessibility permissions granted to the parent process, and would
   a child process spawned by a packaged .app inherit them? The spec flags this as
   the highest-uncertainty item in the milestone, so dig properly rather than
   guessing.

Then give me your recommendations on the three open decisions listed in the spec:
API base URL resolution, launch UX while services boot, and quit behaviour
(full quit vs menu-bar residency). For each, give me your recommendation and the
tradeoff, not just options.

Important context on decision 1: I want a phone app later, reaching this backend
over Tailscale. Weigh that future explicitly — I don't want to do this refactor
twice.

Finish with the proposed file-touch list for Phases 1-6. Then stop and wait for
my sign-off.
```

---

## PROMPT 2 — Phase 1 (Decouple frontend from the dev proxy)

```
Phase 0 is signed off. Proceed to Phase 1 of ARIA_M16_Desktop_App_Spec.md only.

Implement the API base URL resolution we agreed, and update the CORS origins in
backend/main.py to accept the Tauri origin. Keep the existing dev origins working
— npm run dev must be unaffected. Do not use allow_origins=["*"] with
allow_credentials=True.

Two things I want explicitly verified before you call this done, not assumed:

1. `vite build` produces a bundle that can talk to a running backend WITHOUT the
   Vite dev proxy in the path. Actually serve the built output and prove it.

2. NDJSON streaming still works end to end — including a turn that makes a tool
   call and emits round_reset. A plain non-streaming reply passing is not
   sufficient evidence. Streaming is the thing most likely to break silently here.

Nothing else. No Tauri work yet, no changes to memory, routing, or chat logic.
Report what you changed and how you verified both points, then stop.
```

---

## PROMPT 3 — Phase 2 (Tauri shell)

```
Phase 1 signed off. Proceed to Phase 2 of ARIA_M16_Desktop_App_Spec.md only.

Scaffold Tauri v2 in src-tauri/, loading the built frontend. App name "ARIA",
icon generated from frontend/public/aria-logo.png (or aria-icon.ico if that gives
better fidelity — your call, tell me which you used). Sensible default window
size, remembered window position.

Flag the Rust toolchain install to me BEFORE you run it — same as you did with
drei in M12.

Check one thing specifically: index.html reads localStorage before first paint to
set dark mode. Confirm localStorage actually persists across app launches in the
Tauri webview, because if it doesn't the theme will flash or reset every launch.

For this phase the backend can still be started manually via scripts/start.sh —
supervision is Phase 3. What I want at the end of this phase is: the app launches
from the Dock, shows ARIA, and is fully usable against a manually started backend.

Before you report done, click through and confirm these render and work: chat,
Memory Browser, the 3D graph, and Settings. The 3D graph especially — WebGL in a
webview is a real risk and I want it visually confirmed, not assumed.

Then stop.
```

---

## PROMPT 4 — Phase 3 (Service supervision)

```
Phase 2 signed off. Proceed to Phase 3 of ARIA_M16_Desktop_App_Spec.md only.

The app now owns service lifecycle. Read scripts/start.sh properly first — it is
the spec for this phase, including its ordering and readiness waits, and the
comment explaining why Neo4j is started via its own binary rather than
`brew services`. Do not switch to brew services; that comment documents a real
launchd problem that was already hit once.

Requirements:
- Start Neo4j and the FastAPI backend on app launch, in start.sh's order.
- Poll /health until ready and drive the launch UX we agreed from it.
- On quit, stop children cleanly, Neo4j via its own binary, matching stop.sh.
- Handle the already-running case: if something is already listening on 8000
  because start.sh is running, attach to it rather than starting a second backend
  or crashing.
- Send backend logs to the existing logs/ directory. Don't invent a new location.

scripts/start.sh and scripts/stop.sh must keep working unchanged — they are my
fallback if the app misbehaves.

Success condition: from a fully stopped machine state, clicking the Dock icon gets
me to a working ARIA with no terminal involvement at all. Test that specific cold
path and report the timing. Then stop.
```

---

## PROMPT 5 — Phase 4 (Voice and optional services)

```
Phase 3 signed off. Proceed to Phase 4 of ARIA_M16_Desktop_App_Spec.md only.

Start the voice recorder as a supervised child, based on what you found about
permissions in Phase 0.

The thing I actually care about: do the global hotkeys still work — Ctrl+H for
dictation, hold Ctrl+J for commands — when voice is launched by the app instead of
by Terminal? Test it for real.

If macOS permissions block this, do NOT work around it silently or disable the
feature quietly. Report the options and let me decide. A documented manual
permission-granting step is an acceptable outcome; a silently broken hotkey is not.

SearXNG: start it if installed, warn and continue if not. It must never block app
launch — same treatment start.sh already gives it.

Report status of both, then stop.
```

---

## PROMPT 6 — Phase 5 (QA & Regression)

```
Phase 4 signed off. Proceed to Phase 5 of ARIA_M16_Desktop_App_Spec.md — QA and
regression only. No new code unless it's fixing something this phase finds.

Work the full checklist in the spec: M9 theming light and dark, M10 project
scoping, M11 Memory Browser counts, M12 3D graph (visually, in the app), M13
query_graph, M14 provenance citations and click-through, M15 Settings / provider
keys / role assignments / per-message picker / cost tracking. Plus file attachment
upload and file writer export — I want to know the OS file dialogs behave inside a
packaged app.

Two things I care about most:

1. Confirm the app is opening my REAL existing data. Same conversations, same
   memory graph, same counts as I see in the browser version. If the app is
   pointing at a different SQLite or Chroma path than the scripts do, I need to
   know now, not later.

2. Confirm scripts/start.sh and scripts/stop.sh still work unchanged.

Also: if you did any test cleanup that touched the graph, re-run
fix_concept_counts.py afterwards — this bit us in M11 and we've caught it every
time since.

Report cold-boot timing from Dock click to usable UI. Then stop.
```

---

## PROMPT 7 — Phase 6 (Git)

```
Phase 5 signed off. Proceed to Phase 6 of ARIA_M16_Desktop_App_Spec.md.

Confirm the current branch first. Same push gate as M11 through M15 — stop and ask
me before pushing to main.

Add .gitignore entries for the Rust/Tauri build artifacts. src-tauri/target/ is
large and must not end up committed — double check it isn't staged.

Update README.md: add M16 to the milestone table, and add the app launch path to
Quick Start alongside the existing script path (the scripts stay documented, they're
still the fallback).

Report the commit hash and push status.
```

---

## Notes for the founder

- **The gates are the value.** Each prompt ends with "then stop" on purpose. Phase 1 in particular is worth reviewing carefully — if streaming breaks there, everything after it is built on sand.
- **Expect Phase 0 to change the plan.** The voice permissions question genuinely might come back with an answer that reshapes Phase 4. That's the gate working, not the plan failing.
- **Phase 2 is the moment it becomes real** — that's when you get a Dock icon. Phase 3 is when it becomes pleasant.
- If Claude Code proposes scope beyond the spec (feature tweaks, UI improvements, "while I'm in here" refactors), decline it. M16 is a packaging milestone. Anything else goes in a separate ticket.
