#!/bin/bash
# ARIA – One-time installation script for macOS Apple Silicon
set -e

ARIA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ARIA – Installing dependencies         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── 1. Homebrew check ────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "❌  Homebrew not found. Install it first: https://brew.sh"
  exit 1
fi
echo "✅  Homebrew found"

# ─── 2. Python 3.12 ───────────────────────────────────────────────────────────
if ! brew list python@3.12 &>/dev/null; then
  echo "📦  Installing Python 3.12..."
  brew install python@3.12
else
  echo "✅  Python 3.12 already installed"
fi
PYTHON=$(brew --prefix)/bin/python3.12

# ─── 3. Ollama ────────────────────────────────────────────────────────────────
# Use --cask (the full macOS app) — the formula-only install is missing llama-server
if ! command -v ollama &>/dev/null; then
  echo "📦  Installing Ollama (macOS app)..."
  brew install --cask ollama
else
  echo "✅  Ollama already installed"
fi

# ─── 4. Neo4j ─────────────────────────────────────────────────────────────────
if ! brew list neo4j &>/dev/null; then
  echo "📦  Installing Neo4j Community Edition..."
  brew install neo4j
else
  echo "✅  Neo4j already installed"
fi

# Set Neo4j password (matches .env)
NEO4J_CONF="$(brew --prefix)/etc/neo4j/neo4j.conf"
if [ -f "$NEO4J_CONF" ]; then
  # Disable auth requirement for local dev
  sed -i '' 's/#dbms.security.auth_enabled=false/dbms.security.auth_enabled=false/' "$NEO4J_CONF" 2>/dev/null || true
fi

# ─── 5. Python virtual environment ───────────────────────────────────────────
echo ""
echo "🐍  Setting up Python virtual environment..."
cd "$ARIA_DIR/backend"
$PYTHON -m venv .venv
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt
echo "✅  Python dependencies installed"

# ─── 6. Node / npm ────────────────────────────────────────────────────────────
echo ""
echo "📦  Installing frontend dependencies..."
cd "$ARIA_DIR/frontend"
npm install
echo "✅  Frontend dependencies installed"

# ─── 7. Pull Ollama model ─────────────────────────────────────────────────────
echo ""
echo "🤖  Starting Ollama and pulling llama3.2:3b model..."
echo "    (This is ~2 GB — may take a few minutes on first run)"
ollama serve &>/dev/null &
OLLAMA_PID=$!
sleep 4
ollama pull llama3.2:3b
kill $OLLAMA_PID 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  ARIA installation complete!         ║"
echo "║   Run: ./scripts/start.sh                ║"
echo "╚══════════════════════════════════════════╝"
echo ""
