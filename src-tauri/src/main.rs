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
fn start_neo4j(root: &Path) {
    // Bolt port already open means Neo4j is already running (e.g.
    // scripts/start.sh is active in a terminal) — skip the redundant start
    // and its readiness sleep entirely.
    if port_is_listening(7687) {
        println!("neo4j already listening on :7687 — skipping start");
        return;
    }

    let log = log_file(root, "neo4j-start.log");
    let err_log = log.try_clone().expect("clone neo4j log handle");
    let result = Command::new(neo4j_bin())
        .arg("start")
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .status();
    if let Err(e) = result {
        eprintln!("failed to launch neo4j binary: {e}");
    }
    // start.sh's own readiness wait — Neo4j takes ~5s to accept connections
    // after the daemonizer returns.
    std::thread::sleep(Duration::from_secs(5));
}

// Always run, unconditionally, on quit — matches stop.sh, which stops Neo4j
// via the same binary regardless of which process started it.
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

    let child = Command::new(uvicorn)
        .args(["main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
        .current_dir(&backend_dir)
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err_log))
        .spawn()
        .expect("failed to spawn backend — is backend/.venv set up? run scripts/install.sh");

    // start.sh's own readiness wait before moving on to the next service.
    std::thread::sleep(Duration::from_secs(2));
    Some(child)
}

// Owns only the child processes this instance of the app itself spawned —
// never a backend we merely attached to — so quitting the app never kills
// a backend owned by an independently-running scripts/start.sh.
struct Supervisor {
    backend: Mutex<Option<Child>>,
}

impl Supervisor {
    // Full quit, stop all services — matches stop.sh's semantics. Neo4j is
    // always stopped via its own binary regardless of who started it; the
    // backend is only killed if this app instance spawned it.
    fn shutdown(&self) {
        if let Some(mut child) = self.backend.lock().unwrap().take() {
            // Plain `kill` (SIGTERM), same as stop.sh's `kill "$PID"` — lets
            // uvicorn shut down gracefully rather than SIGKILL.
            let _ = Command::new("kill").arg(child.id().to_string()).status();
            let _ = child.wait();
        }
        stop_neo4j();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Supervisor {
            backend: Mutex::new(None),
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
                start_neo4j(&root);
                let backend_child = start_backend(&root);
                *handle.state::<Supervisor>().backend.lock().unwrap() = backend_child;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Single-window personal app: closing the window is a full
            // quit, not a menu-bar-residency hide. Matches the Phase 0
            // decision — quit really means stopped, predictable while the
            // supervision model is still being proven.
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                window.app_handle().state::<Supervisor>().shutdown();
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
