// Layered API base URL resolution — the same order works in the browser dev
// build, the packaged Tauri app, and (later) a remote client over Tailscale,
// so this logic only needs to be written once (see M16 Phase 1).
//
// 1. Explicit override — set via Settings, stored client-side in localStorage.
//    Must stay client-side: M15 provider keys live server-side in
//    key_store.py, which would be circular here — you'd need to already be
//    able to reach the backend to learn the backend's address.
// 2. window.__ARIA_CONFIG__ — injected by the Tauri shell before the app
//    loads (e.g. `{ apiBase: "http://127.0.0.1:8000" }` in the packaged app).
// 3. "/api" — the Vite dev proxy. Unchanged dev behaviour.

const OVERRIDE_KEY = "aria-api-base";

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

export function getApiBaseOverride() {
  return localStorage.getItem(OVERRIDE_KEY) || "";
}

export function setApiBaseOverride(url) {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(OVERRIDE_KEY, stripTrailingSlash(trimmed));
  else localStorage.removeItem(OVERRIDE_KEY);
}

export function resolveApiBase() {
  const override = getApiBaseOverride();
  if (override) return stripTrailingSlash(override);

  if (typeof window !== "undefined" && window.__ARIA_CONFIG__?.apiBase) {
    return stripTrailingSlash(window.__ARIA_CONFIG__.apiBase);
  }

  return "/api";
}
