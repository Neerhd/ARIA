# ARIA — Adaptive Reasoning Intelligence Assistant

**A self-hosted, privacy-first personal AI that learns, grows, and evolves with you over time.**

ARIA runs entirely on your own hardware. No subscriptions. No data sent to the cloud. No conversation history stored on someone else's server. Everything — the model, the memory, the chat history — lives on your machine.

> Inspired by [Pewdiepie's Odysseus project](https://github.com/pewdiepie-archdaemon/odysseus). ARIA borrows the modular architecture and replaces the flat vector memory system with a novel graph-based memory that mirrors how human memory actually works.

---

## What makes ARIA different

Most self-hosted AI tools are just a chat interface pointed at a local model. ARIA is designed to be something more: a system that gets smarter the longer you use it — not because the model improves, but because it *knows you better*.

| Feature | Standard RAG tools | ARIA |
|---|---|---|
| Memory | Vector similarity search | Knowledge graph + vector search |
| Learning | None — resets every session | Episodic → Semantic consolidation |
| Model routing | One model for everything | 3-tier router (fast/capable/cloud) |
| File access | Varies | Built-in — attach any file in chat |
| Privacy | Depends on setup | 100% local by design |
| Cost | Often subscription-based | Free after hardware |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│          Chat UI · File Attachments · Status         │
└───────────────────┬─────────────────────────────────┘
                    │ REST (localhost:5173 → 8000)
┌───────────────────▼─────────────────────────────────┐
│                FastAPI Backend                       │
│   /chat  ·  /files/upload  ·  /health               │
└────┬──────────────┬──────────────┬──────────────────┘
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼──────────────────┐
│ Ollama  │  │   SQLite    │  │  Memory Layer         │
│ LLM     │  │ Conversations│  │  ChromaDB (vectors)  │
│ :11434  │  │ & Messages  │  │  Neo4j (graph) :7687 │
└─────────┘  └─────────────┘  └──────────────────────┘
```

### Memory system (primary innovation)

ARIA's memory is built on a knowledge graph, not flat vector storage. This means memories are connected to each other — not just retrieved by similarity score.

| Node type | What it stores |
|---|---|
| **Episode** | Raw interaction: prompt, response, timestamp, tools used |
| **Fact** | Atomic information extracted from episodes by the model |
| **Reflection** | Higher-order pattern synthesised from clusters of episodes |
| **Concept** | Topic node connecting related episodes, facts, and reflections |

Memory operations: **Write** → **Extract** → **Consolidate** → **Recall** → **Reinforce** → **Decay** *(Phase 2)*

---

## Milestone roadmap

| # | Milestone | Deliverables | Status |
|---|---|---|---|
| M1 | Infrastructure | Ollama, FastAPI, React UI, SQLite, Neo4j, ChromaDB | ✅ Complete |
| M2 | Core Chat | Multi-turn chat, file attachments, session persistence | ✅ Complete |
| M3 | Memory Layer v1 | Episodic memory capture in knowledge graph | ⬜ Planned |
| M4 | Consolidation Pipeline | Background job extracts semantic memories | ⬜ Planned |
| M5 | Model Router | 3-tier prompt classifier, routing logged | ⬜ Planned |
| M6 | Tool System | File reader + SearXNG web search as agent tools | ⬜ Planned |
| M7 | MVP Testing | End-to-end testing, memory pattern validation | ⬜ Planned |
| M8 | MVP Complete | Stable system, ready for Phase 2 | ⬜ Planned |

---

## Prerequisites

- **macOS with Apple Silicon** (M1/M2/M3/M4) — tested on Mac Mini
- **Homebrew** — [install here](https://brew.sh)
- **Node.js 18+** — `brew install node`

Everything else (Python 3.12, Ollama, Neo4j, and all packages) is installed automatically by the setup script.

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/Neerhd/ARIA.git
cd ARIA
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` in any text editor. The defaults work for local development — the only value you **must** set later is `NEO4J_PASSWORD` (see step 4).

### 3. Run the installer

```bash
bash scripts/install.sh
```

This will:
- Install Python 3.12, Ollama (macOS app), and Neo4j via Homebrew
- Create a Python virtual environment and install all packages
- Install all frontend npm packages
- Pull the `llama3.2:3b` model (~2 GB — takes a few minutes on first run)

### 4. Set your Neo4j password

On first run, you need to set a Neo4j password:

1. Start ARIA: `bash scripts/start.sh`
2. Open [http://localhost:7474](http://localhost:7474)
3. Log in with `neo4j` / `neo4j` (factory default)
4. Neo4j will force you to set a new password
5. Update `NEO4J_PASSWORD` in your `.env` file to match
6. Restart ARIA: `Ctrl+C`, then `bash scripts/start.sh`

### 5. Start ARIA

```bash
bash scripts/start.sh
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Stop ARIA

Press `Ctrl+C` in the terminal running `start.sh`, or in a separate terminal:

```bash
bash scripts/stop.sh
```

---

## Project structure

```
ARIA/
├── .env.example            # Environment variable template
├── .env                    # Your local config (never committed)
├── scripts/
│   ├── install.sh          # One-time setup
│   ├── start.sh            # Start all services
│   └── stop.sh             # Stop all services
├── backend/
│   ├── main.py             # FastAPI app entry point
│   ├── config.py           # Settings loaded from .env
│   ├── requirements.txt    # Python dependencies
│   ├── api/
│   │   ├── chat.py         # Chat endpoints
│   │   ├── files.py        # File upload endpoint
│   │   └── health.py       # Health check
│   ├── database/
│   │   ├── sqlite.py       # SQLAlchemy async setup
│   │   ├── neo4j_client.py # Neo4j driver
│   │   └── chroma_client.py# ChromaDB client
│   ├── models/
│   │   └── schemas.py      # Pydantic + SQLAlchemy models
│   └── services/
│       ├── ollama_service.py   # Ollama API calls
│       ├── memory_service.py   # ChromaDB memory operations
│       └── file_service.py     # File text extraction
├── frontend/
│   ├── vite.config.js      # Vite + PWA config
│   ├── package.json
│   └── src/
│       ├── App.jsx          # Root component
│       ├── main.jsx         # Entry point
│       ├── components/
│       │   ├── InputBar.jsx     # Chat input + file attach
│       │   ├── MessageList.jsx  # Message thread
│       │   ├── Sidebar.jsx      # Conversation list
│       │   └── StatusBar.jsx    # Service health indicators
│       └── services/
│           └── api.js       # Backend API calls
└── data/                   # Local databases (never committed)
    ├── sqlite/
    ├── chroma/
    └── neo4j/
```

---

## Supported file types

You can attach files directly in the chat interface. ARIA will read the content and answer questions about it.

| Category | Extensions |
|---|---|
| Documents | `.pdf`, `.txt`, `.md`, `.rst` |
| Code | `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.go`, `.rb`, `.java`, `.c`, `.cpp`, `.h`, `.rs`, `.swift`, `.kt` |
| Data | `.json`, `.csv`, `.yaml`, `.yml`, `.toml`, `.xml` |
| Web | `.html`, `.css` |
| Shell | `.sh`, `.bash`, `.sql` |

Files larger than 20 MB are rejected. Files whose text exceeds 16,000 characters are automatically truncated with a warning.

---

## Configuration

All configuration lives in `.env`. Key values:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for chat. Change to any model you've pulled with `ollama pull` |
| `NEO4J_PASSWORD` | — | Must match the password you set in the Neo4j browser |
| `SQLITE_DB_PATH` | `./data/sqlite/aria.db` | Path to the conversation database |
| `CHROMA_DB_PATH` | `./data/chroma` | Path to the vector memory store |

### Changing the AI model

```bash
# Pull a larger model (better quality, slower)
ollama pull llama3.1:8b

# Then update .env
OLLAMA_MODEL=llama3.1:8b

# Restart the backend
bash scripts/stop.sh && bash scripts/start.sh
```

---

## API reference

The backend exposes a REST API documented interactively at [http://localhost:8000/docs](http://localhost:8000/docs) when running.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service status for all components |
| `POST` | `/chat` | Send a message (with optional file content) |
| `GET` | `/chat/conversations` | List all conversations |
| `GET` | `/chat/conversations/{id}/messages` | Get messages in a conversation |
| `POST` | `/files/upload` | Upload and extract text from a file |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- [Pewdiepie's Odysseus](https://github.com/pewdiepie-archdaemon/odysseus) — architectural inspiration
- [Ollama](https://ollama.com) — local LLM serving
- [GAAMA](https://arxiv.org/abs/2406.14429) — graph-augmented associative memory research
- [Graphiti](https://github.com/getzep/graphiti) — temporal knowledge graph reference
- [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) — spaced repetition algorithm (planned for memory decay)
