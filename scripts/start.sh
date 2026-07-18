#!/bin/bash
# ARIA – Start all services
ARIA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ARIA_DIR/.pids"
mkdir -p "$PID_DIR" "$ARIA_DIR/logs"

cleanup() {
  echo ""
  echo "⏹  Stopping ARIA services..."
  [ -f "$PID_DIR/searxng.pid" ]  && kill "$(cat $PID_DIR/searxng.pid)"  2>/dev/null; rm -f "$PID_DIR/searxng.pid"
  [ -f "$PID_DIR/backend.pid" ]  && kill "$(cat $PID_DIR/backend.pid)"  2>/dev/null; rm -f "$PID_DIR/backend.pid"
  [ -f "$PID_DIR/frontend.pid" ] && kill "$(cat $PID_DIR/frontend.pid)" 2>/dev/null; rm -f "$PID_DIR/frontend.pid"
  brew services stop neo4j 2>/dev/null || true
  echo "✅  All services stopped."
  exit 0
}
trap cleanup INT TERM

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   🚀  Starting ARIA                      ║"
echo "╚══════════════════════════════════════════╝"

# ─── Neo4j ────────────────────────────────────────────────────────────────────
echo "▶  Starting Neo4j..."
brew services start neo4j
sleep 3
echo "✅  Neo4j started  →  http://localhost:7474"

# ─── SearXNG ──────────────────────────────────────────────────────────────────
echo "▶  Starting SearXNG..."
SEARXNG_DIR="$ARIA_DIR/searxng"
SEARXNG_PYTHON="$SEARXNG_DIR/.venv/bin/python"
SEARXNG_WEBAPP="$SEARXNG_DIR/src/searx/webapp.py"
SEARXNG_SETTINGS="$SEARXNG_DIR/settings.yml"

if [ ! -f "$SEARXNG_PYTHON" ] || [ ! -f "$SEARXNG_WEBAPP" ]; then
  echo "⚠️  SearXNG not installed — run ./scripts/install.sh first"
  echo "    Web search tool will be unavailable until SearXNG is installed."
else
  # Run directly from source tree — no editable install required
  PYTHONPATH="$SEARXNG_DIR/src" \
  SEARXNG_SETTINGS_PATH="$SEARXNG_SETTINGS" \
    "$SEARXNG_PYTHON" "$SEARXNG_WEBAPP" > "$ARIA_DIR/logs/searxng.log" 2>&1 &
  echo $! > "$PID_DIR/searxng.pid"
  sleep 4
  # Quick health check
  if curl -sf "http://localhost:8080" &>/dev/null; then
    echo "✅  SearXNG started →  http://localhost:8080"
  else
    echo "⚠️  SearXNG may still be starting — check logs/searxng.log if web search fails"
  fi
fi

# ─── Backend ──────────────────────────────────────────────────────────────────
echo "▶  Starting FastAPI backend..."
cd "$ARIA_DIR/backend"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$ARIA_DIR/logs/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"
sleep 2
echo "✅  Backend started  →  http://localhost:8000  (API docs: /docs)"

# ─── Frontend ─────────────────────────────────────────────────────────────────
echo "▶  Starting React frontend..."
cd "$ARIA_DIR/frontend"
npm run dev > "$ARIA_DIR/logs/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"
sleep 2
echo "✅  Frontend started →  http://localhost:5173"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ARIA is running!                           ║"
echo "║                                              ║"
echo "║   Open:    http://localhost:5173             ║"
echo "║   API:     http://localhost:8000/docs        ║"
echo "║   Neo4j:   http://localhost:7474             ║"
echo "║   SearXNG: http://localhost:8080             ║"
echo "║                                              ║"
echo "║   Press Ctrl+C to stop everything           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Keep script running so Ctrl+C triggers cleanup
wait
