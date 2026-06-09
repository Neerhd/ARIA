#!/bin/bash
# ARIA – Start all services
ARIA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ARIA_DIR/.pids"
mkdir -p "$PID_DIR"

cleanup() {
  echo ""
  echo "⏹  Stopping ARIA services..."
  [ -f "$PID_DIR/ollama.pid" ]   && kill "$(cat $PID_DIR/ollama.pid)"   2>/dev/null; rm -f "$PID_DIR/ollama.pid"
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

# ─── Ollama ───────────────────────────────────────────────────────────────────
echo "▶  Starting Ollama..."
ollama serve > "$ARIA_DIR/logs/ollama.log" 2>&1 &
echo $! > "$PID_DIR/ollama.pid"
sleep 2
echo "✅  Ollama started  →  http://localhost:11434"

# ─── Backend ──────────────────────────────────────────────────────────────────
echo "▶  Starting FastAPI backend..."
mkdir -p "$ARIA_DIR/logs"
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
echo "╔══════════════════════════════════════════╗"
echo "║   ARIA is running!                       ║"
echo "║                                          ║"
echo "║   Open: http://localhost:5173            ║"
echo "║   API:  http://localhost:8000/docs       ║"
echo "║   Neo4j: http://localhost:7474           ║"
echo "║                                          ║"
echo "║   Press Ctrl+C to stop everything       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Keep script running so Ctrl+C triggers cleanup
wait
