#!/bin/bash
# ARIA – Seed a new Conductor workspace with this developer's existing chat
# history and semantic memory, so every workspace can exercise real data
# instead of starting empty. Personal/local only — wired up via
# .conductor/settings.local.toml (gitignored), never .conductor/settings.toml,
# since it copies one developer's own data and only makes sense on this machine.
set -e

# Not a local Conductor workspace (e.g. cloud) — nothing to seed from.
if [ "$CONDUCTOR_IS_LOCAL" != "1" ] || [ -z "$CONDUCTOR_ROOT_PATH" ]; then
  exit 0
fi

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DATA="$CONDUCTOR_ROOT_PATH/backend/data"
DEST_DATA="$WORKSPACE_DIR/backend/data"

# Don't clobber a workspace that already has its own data (e.g. re-running setup).
if [ -d "$DEST_DATA" ]; then
  echo "backend/data already present in this workspace — skipping seed."
  exit 0
fi

if [ -f "$SOURCE_DATA/sqlite/aria.db" ]; then
  mkdir -p "$DEST_DATA/sqlite"
  cp "$SOURCE_DATA/sqlite/aria.db" "$DEST_DATA/sqlite/aria.db"
  echo "✅  Seeded chat history from $SOURCE_DATA/sqlite"
fi

if [ -d "$SOURCE_DATA/chroma" ]; then
  mkdir -p "$DEST_DATA/chroma"
  cp -R "$SOURCE_DATA/chroma/." "$DEST_DATA/chroma/"
  echo "✅  Seeded semantic memory from $SOURCE_DATA/chroma"
fi
