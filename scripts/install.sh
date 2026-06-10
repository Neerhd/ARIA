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

# ─── 7. SearXNG (self-hosted web search) ──────────────────────────────────────
echo ""
echo "🔍  Installing SearXNG (self-hosted web search)..."
SEARXNG_DIR="$ARIA_DIR/searxng"
mkdir -p "$SEARXNG_DIR"

# Clone source (shallow) if not already present
if [ ! -d "$SEARXNG_DIR/src/.git" ]; then
  echo "    Cloning SearXNG source (shallow)..."
  git clone --depth 1 https://github.com/searxng/searxng.git "$SEARXNG_DIR/src"
else
  echo "    SearXNG source already present — skipping clone"
fi

# Create dedicated venv if needed
if [ ! -d "$SEARXNG_DIR/.venv" ]; then
  $PYTHON -m venv "$SEARXNG_DIR/.venv"
fi
"$SEARXNG_DIR/.venv/bin/pip" install --upgrade pip --quiet

# SearXNG's __init__.py imports msgspec at module level, so pip's isolated build
# environment fails before any deps are installed. Install requirements.txt first
# so msgspec (and everything else) is present, then use --no-build-isolation so
# the editable install reuses the venv instead of a clean temp environment.
echo "    Installing SearXNG dependencies..."
"$SEARXNG_DIR/.venv/bin/pip" install -r "$SEARXNG_DIR/src/requirements.txt" --quiet
echo "    Installing SearXNG package (editable)..."
"$SEARXNG_DIR/.venv/bin/pip" install -e "$SEARXNG_DIR/src" --no-build-isolation --quiet
echo "✅  SearXNG installed"

# Write minimal settings.yml
if [ ! -f "$SEARXNG_DIR/settings.yml" ]; then
  cat > "$SEARXNG_DIR/settings.yml" << 'YAML'
use_default_settings: true

server:
  port: 8080
  bind_address: "127.0.0.1"
  secret_key: "aria-searxng-local-secret-key"
  limiter: false
  image_proxy: false

search:
  safe_search: 0
  default_lang: "auto"
  formats:
    - html
    - json
YAML
  echo "✅  SearXNG settings written →  searxng/settings.yml"
else
  echo "✅  SearXNG settings already present"
fi

# ─── 8. Pull Ollama model ─────────────────────────────────────────────────────
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
