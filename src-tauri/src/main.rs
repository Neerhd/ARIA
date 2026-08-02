#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::{StateFlags, WindowExt};

// Injected before any frontend script runs, so frontend/src/services/apiBase.js
// picks it up on its first read.
const INIT_SCRIPT: &str = r#"window.__ARIA_CONFIG__ = { apiBase: "http://127.0.0.1:8000" };"#;

// Baked in at compile time. src-tauri/ is always a sibling of backend/,
// frontend/, and logs/ in the ARIA repo checkout — M16 is explicitly scoped
// to a personal app on the founder's own already-provisioned machine, not a
// redistributable bundle (see spec's "explicitly out of scope"), so a
// compile-time path is the right tool here, not a runtime guess.
fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri always has a parent directory")
        .to_path_buf()
}

fn logs_dir(root: &Path) -> PathBuf {
    let dir = root.join("logs");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

// Reuses the existing logs/ directory rather than inventing a new location,
// truncating on each launch the same way start.sh's `>` redirection does.
fn log_file(root: &Path, name: &str) -> std::fs::File {
    OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(logs_dir(root).join(name))
        .unwrap_or_else(|e| panic!("failed to open log file {name}: {e}"))
}

fn brew_prefix() -> String {
    Command::new("brew")
        .arg("--prefix")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "/opt/homebrew".to_string())
}

fn neo4j_bin() -> String {
    format!("{}/opt/neo4j/bin/neo4j", brew_prefix())
}

fn port_is_listening(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        Duration::from_millis(300),
    )
    .is_ok()
}

// Mirrors scripts/start.sh: Neo4j via its own daemonizer binary, never
// `brew services` — launchd was observed wedging the job ("Running: false"
// right after a successful start). Do not "fix" this to use brew services;
// that comment in start.sh documents a real problem that was already hit.
//
// Returns whether this call actually spawned Neo4j, mirroring
// start_backend's Option<Child> — so main() can record it and shutdown()
// can decide whether stopping Neo4j is this instance's responsibility.
fn start_neo4j(root: &Path) -> bool {
    // Bolt port already open means Neo4j is already running (e.g.
    // scripts/start.sh is active in a terminal) — attach to it instead of
    // spawning a redundant one, and never stop it on quit.
    if port_is_listening(7687) {
        println!("neo4j already listening on :7687 — attaching instead of spawning");
        return false;
    }

    println!("neo4j not listening on :7687 — spawning it");
    let log = log_file(root, "neo4j-start.log");
    let err_log = log.try_clone().expect("clone neo4j log handle");
    let status = Command::new(neo4j_bin())
        .arg("start")
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("neo4j spawned by this app instance");
            // start.sh's own readiness wait — Neo4j takes ~5s to accept
            // connections after the daemonizer returns.
            std::thread::sleep(Duration::from_secs(5));
            true
        }
        Ok(s) => {
            eprintln!("neo4j start exited with status {s}");
            false
        }
        Err(e) => {
            eprintln!("failed to launch neo4j binary: {e}");
            false
        }
    }
}

// Stops Neo4j via the same binary stop.sh uses. Only called from
// shutdown() when this app instance is the one that spawned Neo4j.
fn stop_neo4j() {
    let _ = Command::new(neo4j_bin()).arg("stop").status();
}

// Spawns the backend the same way start.sh does — the venv's own uvicorn
// binary, cwd'd into backend/, no `source activate` needed since venv
// console scripts are self-contained. Returns None when a backend is
// already listening on :8000 (e.g. scripts/start.sh is already running),
// so main() attaches to it instead of spawning — and, symmetrically,
// never kills it on quit.
fn start_backend(root: &Path) -> Option<Child> {
    if port_is_listening(8000) {
        println!("backend already listening on :8000 — attaching instead of spawning");
        return None;
    }

    let backend_dir = root.join("backend");
    let uvicorn = backend_dir.join(".venv/bin/uvicorn");
    let log = log_file(root, "backend.log");
    let err_log = log.try_clone().expect("clone backend log handle");

    println!("backend not listening on :8000 — spawning it");
    let child = Command::new(uvicorn)
        .args(["main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
        .current_dir(&backend_dir)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .spawn()
        .expect("failed to spawn backend — is backend/.venv set up? run scripts/install.sh");
    println!("backend spawned by this app instance (pid {})", child.id());

    // start.sh's own readiness wait before moving on to the next service.
    std::thread::sleep(Duration::from_secs(2));
    Some(child)
}

// Voice has no port to probe — it's a keyboard listener, not a server — so
// "already running" is checked via pgrep against recorder.py's filename
// instead, matching the same spawned-vs-attached contract port checks give
// backend/searxng/neo4j. Without this, a voice already started by
// scripts/start.sh (or another ARIA.app instance) wouldn't be detected, and
// this app would launch a second recorder.py — a second CGEventTap racing
// the first one for the same Ctrl+H/Ctrl+J events.
//
// Matches on the bare filename, not recorder.py's absolute path: start.sh
// invokes it as `cd voice/ && python recorder.py`, a relative argv that a
// path-based pgrep pattern would silently miss — confirmed by testing
// against a start.sh-launched instance. `recorder.py` is distinctive enough
// on a personal single-user machine that this is fine.
fn voice_already_running() -> bool {
    Command::new("pgrep")
        .args(["-f", "recorder.py"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// Voice is optional (start.sh: "run ./scripts/install.sh to enable it").
// Missing venv is a warn-and-continue, matching SearXNG's treatment; it must
// never block app launch any more than it blocks start.sh.
//
// This is the Phase 0 supervised-child relationship: as long as this app
// process stays running, macOS TCC attributes recorder.py's Microphone and
// Accessibility/Input Monitoring checks to ARIA.app rather than to whatever
// shell launched the app. First launch still needs a manual grant in System
// Settings for Accessibility — that cannot be prompted programmatically, so
// don't try; a documented one-time grant is the expected outcome here, not
// a bug to route around.
fn start_voice(root: &Path) -> Option<Child> {
    if voice_already_running() {
        println!("voice already running — attaching instead of spawning");
        return None;
    }

    let voice_dir = root.join("voice");
    let python = voice_dir.join(".venv/bin/python");

    if !python.exists() {
        println!("voice not installed (no voice/.venv) — run scripts/install.sh to enable it");
        return None;
    }

    let log = log_file(root, "voice.log");
    let err_log = log.try_clone().expect("clone voice log handle");

    println!("starting ARIA Voice...");
    match Command::new(python)
        .arg("recorder.py")
        .current_dir(&voice_dir)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .spawn()
    {
        Ok(child) => {
            println!("voice spawned by this app instance (pid {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("failed to spawn voice: {e}");
            None
        }
    }
}

// Mirrors start.sh's SearXNG block exactly: warn and continue if not
// installed, run from source tree with the same PYTHONPATH / settings env
// vars, never block launch on it.
fn start_searxng(root: &Path) -> Option<Child> {
    if port_is_listening(8080) {
        println!("searxng already listening on :8080 — attaching instead of spawning");
        return None;
    }

    let searxng_dir = root.join("searxng");
    let python = searxng_dir.join(".venv/bin/python");
    let webapp = searxng_dir.join("src/searx/webapp.py");
    let settings = searxng_dir.join("settings.yml");

    if !python.exists() || !webapp.exists() {
        println!("searxng not installed — run scripts/install.sh to enable web search");
        return None;
    }

    let log = log_file(root, "searxng.log");
    let err_log = log.try_clone().expect("clone searxng log handle");

    println!("starting SearXNG...");
    let child = Command::new(python)
        .arg(&webapp)
        .env("PYTHONPATH", searxng_dir.join("src"))
        .env("SEARXNG_SETTINGS_PATH", &settings)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .spawn();

    match child {
        Ok(child) => {
            println!("searxng spawned by this app instance (pid {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("failed to spawn searxng: {e}");
            None
        }
    }
}

// Owns only the services this instance of the app itself spawned — never
// one of the four (backend, Neo4j, voice, SearXNG) it merely attached to —
// so quitting the app never kills a service owned by an
// independently-running scripts/start.sh or another ARIA.app instance.
struct Supervisor {
    backend: Mutex<Option<Child>>,
    neo4j_spawned: Mutex<bool>,
    voice: Mutex<Option<Child>>,
    searxng: Mutex<Option<Child>>,
}

impl Supervisor {
    // Full quit, stop what this instance owns — matches stop.sh's
    // semantics but scoped to services this app actually spawned. Both
    // Neo4j and the backend are left running if this instance only
    // attached to an already-running one.
    fn shutdown(&self) {
        if let Some(mut child) = self.backend.lock().unwrap().take() {
            // Plain `kill` (SIGTERM), same as stop.sh's `kill "$PID"` — lets
            // uvicorn shut down gracefully rather than SIGKILL.
            let _ = Command::new("kill").arg(child.id().to_string()).status();
            let _ = child.wait();
        }
        if let Some(mut child) = self.voice.lock().unwrap().take() {
            let _ = Command::new("kill").arg(child.id().to_string()).status();
            let _ = child.wait();
        }
        if let Some(mut child) = self.searxng.lock().unwrap().take() {
            let _ = Command::new("kill").arg(child.id().to_string()).status();
            let _ = child.wait();
        }
        // take(), not just read — ExitRequested can fire more than once on
        // the way down (e.g. after the window's own CloseRequested), and
        // this must not try to stop Neo4j twice.
        if std::mem::take(&mut *self.neo4j_spawned.lock().unwrap()) {
            stop_neo4j();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Supervisor {
            backend: Mutex::new(None),
            neo4j_spawned: Mutex::new(false),
            voice: Mutex::new(None),
            searxng: Mutex::new(None),
        })
        .setup(|app| {
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("ARIA")
                    .inner_size(1200.0, 800.0)
                    .min_inner_size(860.0, 600.0)
                    .initialization_script(INIT_SCRIPT)
                    .build()?;

            // Restores the previous session's size/position, if any is saved.
            window.restore_state(StateFlags::all())?;

            // Off the main thread so the window paints immediately — the
            // frontend's launch overlay polls /health and shows this work
            // in progress rather than the window itself blocking on it.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let root = repo_root();
                let neo4j_spawned = start_neo4j(&root);
                let backend_child = start_backend(&root);
                let voice_child = start_voice(&root);
                let searxng_child = start_searxng(&root);
                let supervisor = handle.state::<Supervisor>();
                *supervisor.neo4j_spawned.lock().unwrap() = neo4j_spawned;
                *supervisor.backend.lock().unwrap() = backend_child;
                *supervisor.voice.lock().unwrap() = voice_child;
                *supervisor.searxng.lock().unwrap() = searxng_child;
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Single-window personal app: quitting is always a full stop,
            // not menu-bar residency (Phase 0 decision). RunEvent::Exit is
            // the very last event the run loop delivers, but that's fine —
            // run() doesn't return (and the process doesn't exit) until
            // this callback does.
            //
            // Verified empirically: a prior version hooked only
            // WindowEvent::CloseRequested. Quitting any other way — Cmd+Q,
            // Dock > Quit, or `osascript -e 'quit app "ARIA"'` (the same
            // Apple Event path Cmd+Q takes) — never fires CloseRequested,
            // and RunEvent::ExitRequested (which looked like the obvious
            // app-level fix) never fired for these either; only Exit did.
            // Without this, backend/voice/searxng were left running as
            // orphans after every quit that wasn't a literal click on the
            // window's own close button.
            if let tauri::RunEvent::Exit = event {
                app_handle.state::<Supervisor>().shutdown();
            }
        });
}
