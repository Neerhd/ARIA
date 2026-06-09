#!/bin/bash
# ARIA – Stop all services
ARIA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ARIA_DIR/.pids"

echo "⏹  Stopping ARIA services..."

for svc in ollama backend frontend; do
  PID_FILE="$PID_DIR/$svc.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" && echo "  ✅  $svc stopped"
    fi
    rm -f "$PID_FILE"
  fi
done

brew services stop neo4j 2>/dev/null && echo "  ✅  Neo4j stopped"
echo "Done."
