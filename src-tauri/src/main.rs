#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::{StateFlags, WindowExt};

// Injected before any frontend script runs, so frontend/src/services/apiBase.js
// picks it up on its first read. M16 Phase 3 will make this dynamic (attach vs.
// spawn); for Phase 2 the backend is started manually via scripts/start.sh and
// always listens on 127.0.0.1:8000.
const INIT_SCRIPT: &str = r#"window.__ARIA_CONFIG__ = { apiBase: "http://127.0.0.1:8000" };"#;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
