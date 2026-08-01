# ARIA M16 — Native macOS Desktop App

**Status:** Ready for Claude Code handoff
**Scope:** Packaging and process lifecycle only. ARIA stops being "a Vite dev server you visit in a browser tab" and becomes a real `.app` you launch from the Dock. **Zero feature changes.** Every capability that works today must work identically inside the app — same chat, same memory, same tools, same graph, same voice.

---

## The problem this solves

ARIA today is functionally strong but ergonomically a dev tool. To use it you run `scripts/start.sh`, keep a terminal window alive, and open `localhost:5173` in a browser tab that competes with every other tab. Claude's Mac app wins by default because it's *there* — one icon, one window, always running.

This milestone closes that gap. Nothing about ARIA's intelligence changes; only how it is launched, hosted, and lived in.

### What this milestone is NOT

- Not a feature milestone. No new capability, no UI redesign, no memory changes.
- Not the mobile app. Phone access is a separate, later milestone — but see "Forward compatibility" below, because one decision here determines whether that milestone is easy or painful.
- Not a redistributable product. This is a personal app for the founder's own Mac. It may assume the ARIA repo is checked out locally with its venvs and databases already in place. **Do not spend effort on installers, notarization, or a self-contained bundle for strangers.**

---

## What was found in the repo (pre-spec reconnaissance)

Claude Code should verify all of this in Phase 0 rather than trusting it, but this is the current read:

**The single structural blocker — the frontend cannot reach its own backend without the dev server.**
`frontend/src/services/api.js` opens with `const BASE = "/api";` — a relative path. `frontend/vite.config.js` proxies `/api` → `http://localhost:8000` and strips the prefix. That proxy is a feature of the **Vite dev server**. In a packaged app there is no dev server, so `/api` resolves to nothing and every request fails. This is the one thing that must change before anything else works.

**CORS is pinned to the dev origins.**
`backend/main.py` sets `allow_origins=["http://localhost:5173", "http://localhost:3000"]`. A Tauri webview presents a different origin and will be rejected.

**Lifecycle already exists as a shell script — the app's job is to become it.**
`scripts/start.sh` already starts Neo4j (via the binary's own daemonizer, deliberately *not* `brew services` — see the comment in that file, it documents a real launchd wedging problem), then SearXNG, then the FastAPI backend, then the voice recorder, then the Vite dev server. It tracks PIDs in `.pids/` and cleans up on `Ctrl+C`. `scripts/stop.sh` mirrors this. **This script is the specification for what the desktop app must do on launch and quit.** Read it carefully before designing the supervisor.

**Streaming is NDJSON over `fetch`.**
`api.js` consumes a line-delimited JSON stream (`meta`, `text_delta`, `round_reset` events). This works in a Tauri webview, but it must be verified live, not assumed — streaming is the highest-risk thing to silently break in a webview.

**A health endpoint already exists and is exactly what the launch gate needs.**
`backend/api/health.py` reports `sqlite`, `chroma`, `neo4j`, and configured providers, returning `ok` or `degraded`. The app should poll this rather than inventing a readiness check.

**PWA config exists but is currently broken.**
`vite.config.js` includes `VitePWA` with a manifest referencing `/icon-192.png` and `/icon-512.png`. Neither file exists in `frontend/public/` (which holds `aria-icon.ico`, `aria-logo.png`, `aria-logo-black.png`, `aria-logo-white.png`). `index.html` also hand-links `/manifest.json` while VitePWA generates its own. Flag this; **fixing it is out of scope for M16** — it belongs to the mobile milestone.

---

## Design decisions (locked)

**1. Tauri, not Electron, not native Swift.**
The existing React frontend is reused as-is. Tauri gives a real `.app`, Dock icon, own window, and a Rust supervisor process capable of managing child processes. Electron is rejected on bundle size and memory overhead for a personal always-on app. Native Swift is rejected because it means abandoning the entire existing frontend — a rewrite, not a packaging change.

**2. Supervise, do not bundle.**
The app manages processes that are already installed on the machine (Neo4j via Homebrew, the backend venv, the voice venv). It does **not** compile Python into a sidecar binary or embed a JVM. Rationale: Neo4j is a JVM service that resists bundling, and this app has exactly one user whose machine is already provisioned by `scripts/install.sh`. Bundling is weeks of work for zero benefit here.

**3. The API base URL becomes configurable, with a sane default.**
Not a hardcoded swap from `/api` to `http://127.0.0.1:8000`. A resolution order that works in all three contexts — browser dev, packaged desktop, and (later) a remote client over Tailscale. See "Forward compatibility."

**4. `scripts/start.sh` keeps working, untouched in behaviour.**
The shell path stays as a fallback and a debugging tool. If the app misbehaves, the founder must still be able to run ARIA the old way. Do not delete or repurpose these scripts.

**5. Backend, Neo4j, and voice are owned by the app. SearXNG is optional.**
Neo4j and the backend are non-negotiable — ARIA is dead without them. Voice is owned because it's part of daily use. SearXNG failing should degrade the web-search tool, not block app launch, exactly as `start.sh` already treats it.

---

## Forward compatibility (why one decision here matters more than the rest)

The desktop app wants the backend at `127.0.0.1`. A future phone app wants it at a Tailscale hostname. **These are the same change if the API base URL is made properly configurable, and two separate painful changes if it's hardcoded twice.**

So the base-URL work in Phase 1 must land as *"the frontend can be pointed at any host"* — not *"the frontend now points at 127.0.0.1 instead of /api."* CORS must be widened thoughtfully for the same reason. Get this right and the mobile milestone is mostly client work; get it wrong and it's a second refactor.

---

## Hard constraints

- **No feature regressions.** M9 theming, M10 project scoping, M11 Memory Browser, M12 3D graph, M13 `query_graph`, M14 provenance, M15 multi-provider router and Settings must all behave identically inside the app.
- **No changes to memory, routing, or chat logic.** If a phase touches `services/memory_service.py`, `services/router_service.py`, or `api/chat.py` for anything beyond the base-URL/CORS concerns, stop and ask — that is out of scope.
- **No data loss and no data path change.** SQLite and ChromaDB live at the paths in `backend/config.py`. The app must read the same databases the shell scripts do. The founder's existing chats and memory graph must appear on first launch of the app.
- **`npm run dev` must still work** after every phase.
- **No secrets in the frontend.** Provider API keys are backend-side (`key_store.py`, M15) and stay there.
- **Ask before installing anything.** Tauri requires a Rust toolchain. Flag it before installing, per the M12 precedent where `@react-three/drei` was flagged before install.

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed without sign-off.*

- Confirm the repo findings above still match reality — `BASE = "/api"`, the Vite proxy, the CORS origins list, `start.sh`'s exact service order and startup delays, and the `/health` response shape.
- Confirm the Rust/Tauri toolchain status on this machine and report what would need installing, with rough download size. **Do not install yet.**
- Confirm Tauri v2 is the current major version and report the macOS webview origin it will present to the backend (this determines the CORS change).
- Inventory every place in the frontend that constructs a URL — confirm `api.js` is genuinely the only one, or list the others. Check `useGraphData.js` and anything touching `/voice`, file upload, or streaming in particular.
- Confirm how the voice recorder (`voice/recorder.py`) expects to be launched and whether it needs a TTY, mic permissions granted to the *parent* process, or accessibility permissions — this determines whether a Tauri-spawned child inherits them or silently fails. **This is the highest-uncertainty item in the milestone; investigate it properly.**
- **Open decision — API base resolution.** Propose the mechanism: build-time env var, runtime config file, in-app Settings field, or a layered default. Weigh it explicitly against the Tailscale/mobile future described above. Recommend one.
- **Open decision — launch UX while services boot.** Neo4j takes ~5s in `start.sh`. Options: a splash/status window showing per-service progress, a normal window with a blocking overlay until `/health` returns, or launch straight into the UI and let it error until ready. Recommend one, noting effort vs. how it feels on a cold start.
- **Open decision — quit behaviour.** Does closing the window quit ARIA and stop all services, or should it live in the menu bar with services running? Note the tradeoff: menu-bar residency means ARIA is always warm (better daily-driver ergonomics) but services run indefinitely.
- Report the proposed file-touch list and all three recommendations before changing anything.

## Phase 1 — Decouple the frontend from the dev proxy
*The unblocker. Nothing else can work before this.*

- Implement the API base resolution decided in Phase 0, defaulting to current behaviour in dev so `npm run dev` is unaffected.
- Update `backend/main.py` CORS to accept the Tauri origin alongside the existing dev origins. Keep the list explicit — do not use `allow_origins=["*"]` with `allow_credentials=True`.
- Verify `vite build` produces a working static bundle, and that the built bundle can talk to a running backend when served without the dev proxy.
- **Verify NDJSON streaming still works end-to-end**, including a tool-calling turn that emits `round_reset`. A non-streaming reply passing is not sufficient evidence.
- Gate: confirm dev mode and built mode both work before moving on.

## Phase 2 — Tauri shell
- Scaffold Tauri v2 in the repo (`src-tauri/`), configured to load the built frontend.
- App identity: name "ARIA", icon generated from the existing `frontend/public/aria-logo.png` (or `aria-icon.ico` if higher fidelity), sensible default window size, remembered window position.
- Confirm dark mode still initialises correctly — `index.html` reads `localStorage` before first paint and toggles the `dark` class; verify `localStorage` persists across app launches in the Tauri webview.
- At this phase the app may still require the backend to be started manually by `start.sh`. That is expected and fine.
- Gate: the app launches, shows ARIA, and is fully usable against a manually-started backend. Confirm chat, memory browser, 3D graph, and Settings all render and function.

## Phase 3 — Service supervision
- The Rust layer starts Neo4j and the FastAPI backend on app launch, mirroring the order and readiness waits in `scripts/start.sh`.
- Poll `/health` until ready; drive the launch UX chosen in Phase 0 from it.
- On quit, stop child processes cleanly, including Neo4j via its own binary (matching `stop.sh` — **not** `brew services`, per the documented launchd issue).
- Handle the already-running case: if a backend is already listening on 8000 (because `start.sh` is running), attach to it rather than starting a second one or crashing.
- Surface backend logs somewhere reachable — reuse the existing `logs/` directory rather than inventing a new location.
- Gate: cold launch from a fully stopped machine state reaches a working ARIA with no terminal involvement.

## Phase 4 — Voice and optional services
- Start the voice recorder as a supervised child, per the Phase 0 permissions findings.
- **Verify the global hotkeys still work** (`Ctrl+H` dictation, hold `Ctrl+J` for commands) when launched by the app rather than by Terminal. If macOS permissions block this, report the options rather than working around it silently — this may need to be a documented manual step.
- SearXNG: start it if installed, warn and continue if not. Never block launch.
- Gate: voice and web search confirmed working from the app, or the blocker clearly documented.

## Phase 5 — QA & Regression
- M9 theming intact, light and dark.
- M10 project scoping — switch projects, confirm correct isolation.
- M11 Memory Browser — episode/reflection/concept counts correct.
- M12 3D graph renders and interacts (WebGL in the Tauri webview is a real risk — verify visually, do not assume).
- M13 `query_graph` returns results.
- M14 provenance citations render and click through.
- M15 Settings, provider keys, role assignments, per-message model picker, cost tracking.
- File attachment upload and file writer export — confirm the OS file dialogs behave inside a packaged app.
- **Confirm the app opens the founder's real existing data** — same conversations, same memory graph, same counts as the browser version.
- Confirm `scripts/start.sh` and `scripts/stop.sh` still work unchanged.
- Cold-boot timing: report how long from Dock click to usable UI.

## Phase 6 — Git
- Confirm current branch. Same push-gate as M11–M15 — **stop and ask before pushing to main.**
- `.gitignore` additions for Rust/Tauri build artifacts (`src-tauri/target/` is large — must not be committed).
- Update `README.md`: milestone table gains M16, and the Quick Start gains the app launch path alongside the existing script path.
- Report commit hash and push status.

---

## Open decisions requiring input during Phase 0
1. API base URL resolution mechanism (weighing the mobile/Tailscale future).
2. Launch UX while services boot.
3. Quit behaviour — full quit vs. menu-bar residency.

## Known risks
- **Voice hotkeys and mic permissions** under a Tauri-spawned child process. Highest-uncertainty item; Phase 0 must investigate before Phase 4 is planned in detail.
- **WebGL / 3D graph** rendering in the Tauri webview. Verify visually in Phase 5.
- **Streaming responses** through the webview. Verified early, in Phase 1, deliberately.
- **Rust toolchain install** is a new dependency class for this repo. Flag before installing.

## Explicitly out of scope
- Mobile app / PWA fixes (including the missing PWA icons found above).
- Tailscale or any remote access configuration.
- Code signing, notarization, or distribution to other machines.
- Bundling Python or Neo4j into a self-contained app.
- Any feature, UI, memory, or routing change.
