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
| Model routing | One model for everything | 3-tier router (fast/capable/cloud) *(M5)* |
| File access | Varies | Built-in — attach any file in chat |
| Privacy | Depends on setup | 100% local by design |
| Cost | Often subscription-based | Free after hardware |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       React Frontend                          │
│      Chat UI · File Attachments · Memory Browser · Status    │
└─────────────────────────┬────────────────────────────────────┘
                          │ REST  (localhost:5173 → 8000)
┌─────────────────────────▼────────────────────────────────────┐
│                     FastAPI Backend                           │
│  /chat  ·  /files/upload  ·  /memory/*  ·  /consolidation/*  │
└────┬────────────────┬───────────────────┬─────────────────────┘
     │                │                   │
┌────▼────┐    ┌──────▼──────┐    ┌───────▼─────────────────┐
│ Ollama  │    │   SQLite    │    │      Memory Layer        │
│ Chat    │    │ Conversations│   │  ChromaDB (semantic)     │
│ Topics  │    │ Messages    │    │  Neo4j (knowledge graph) │
│ Reflect │    │ Consol. log │    │  Episodes · Concepts     │
│ :11434  │    │             │    │  Reflections  · :7687    │
└─────────┘    └─────────────┘    └──────────────────────────┘
```

### Memory system

ARIA's memory is built on a knowledge graph, not flat vector storage. Memories are connected to each other — not just retrieved by similarity score.

| Node type | What it stores | Status |
|---|---|---|
| **Episode** | Raw interaction: prompt, response, timestamp, recall count | ✅ Live |
| **Concept** | Topic node linking related episodes; tracks episode frequency | ✅ Live |
| **Reflection** | Higher-order pattern synthesised from clusters of 3+ episodes | ✅ Live |
| **Fact** | Atomic information extracted from episodes by the model | Planned M6+ |

**Memory pipeline (currently active):**

1. **Write** — Every assistant reply is stored as an Episode node in Neo4j (shared ID with ChromaDB and SQLite)
2. **Extract** — Topic tags are extracted from each turn using the local model; Concept nodes are created or incremented
3. **Link** — Episodes are connected to their Concepts (`DISCUSSES`) and to the previous episode in the conversation (`NEXT`)
4. **Recall** — ChromaDB semantic search finds relevant past episodes before each response
5. **Reinforce** — Recalled episodes have their `recall_count` incremented in Neo4j
6. **Consolidate** — A nightly background job clusters episodes by Concept (min 3 episodes), prompts the model to synthesise a Reflection, and stores it with `SYNTHESISED_FROM` and `ABOUT` edges

---

## Milestone roadmap

| # | Milestone | Deliverables | Status |
|---|---|---|---|
| M1 | Infrastructure | Ollama, FastAPI, React UI, SQLite, Neo4j, ChromaDB | ✅ Complete |
| M2 | Core Chat | Multi-turn chat, file attachments, session persistence | ✅ Complete |
| M3 | Memory Layer v1 | Episodic memory capture, topic extraction, knowledge graph | ✅ Complete |
| M4 | Consolidation Pipeline | Reflection synthesis, nightly scheduler, memory browser UI | ✅ Complete |
| M5 | Model Router | 3-tier prompt classifier, routing logged | Planned |
| M6 | Tool System | File reader + SearXNG web search as agent tools | Planned |
| M7 | MVP Testing | End-to-end testing, memory pattern validation | Planned |
| M8 | MVP Complete | Stable system, ready for Phase 2 | Planned |

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
├── .env.example                # Environment variable template
├── .env                        # Your local config (never committed)
├── scripts/
│   ├── install.sh              # One-time setup
│   ├── start.sh                # Start all services
│   └── stop.sh                 # Stop all services
├── backend/
│   ├── main.py                 # FastAPI app + nightly consolidation scheduler
│   ├── config.py               # Settings loaded from .env
│   ├── requirements.txt        # Python dependencies
│   ├── api/
│   │   ├── chat.py             # Chat endpoints + episodic memory pipeline
│   │   ├── consolidation.py    # Consolidation trigger, run log, reflections
│   │   ├── files.py            # File upload and text extraction
│   │   ├── health.py           # Health check for all services
│   │   └── memory.py           # Memory browser endpoints
│   ├── database/
│   │   ├── sqlite.py           # SQLAlchemy async engine and session
│   │   ├── neo4j_client.py     # Neo4j async driver
│   │   └── chroma_client.py    # ChromaDB persistent client
│   ├── models/
│   │   └── schemas.py          # ORM models (Conversation, Message, ConsolidationRun)
│   └── services/
│       ├── consolidation_service.py  # Reflection synthesis pipeline
│       ├── file_service.py           # PDF and text extraction (PyMuPDF)
│       ├── graph_service.py          # All Neo4j read/write operations
│       ├── memory_service.py         # ChromaDB store and semantic search
│       ├── ollama_service.py         # Ollama chat and health check
│       └── topic_service.py          # Topic tag extraction from conversations
├── frontend/
│   ├── index.html              # Vite entry point
│   ├── vite.config.js          # Vite + PWA config, /api proxy
│   ├── package.json
│   └── src/
│       ├── App.jsx             # Root component, memory panel toggle
│       ├── main.jsx            # Entry point
│       ├── components/
│       │   ├── InputBar.jsx    # Chat input + file attachment
│       │   ├── MemoryBrowser.jsx # Episodes, Concepts, Reflections panel
│       │   ├── MessageList.jsx # Message thread with file badge
│       │   ├── Sidebar.jsx     # Conversation list
│       │   └── StatusBar.jsx   # Live service health dots
│       └── services/
│           └── api.js          # All backend API calls
└── data/                       # Local databases (never committed)
    ├── sqlite/
    ├── chroma/
    └── neo4j/
```

---

## Memory Browser

Click **🧠 Memory** in the top-right corner to open the memory panel. It has three tabs:

| Tab | What it shows |
|---|---|
| **Episodes** | Every conversation turn stored in Neo4j, with topic tags and recall count. Click a card to expand the full prompt and response. |
| **Concepts** | All topic nodes extracted from conversations, sorted by frequency. Click a concept to filter the Episodes tab. |
| **Reflections** | Higher-order patterns synthesised by the consolidation pipeline. Each card shows the concept, the synthesised insight, and how many episodes it was drawn from. Use the **Run Consolidation Now** button to trigger synthesis on demand. |

Reflections are also generated automatically every 24 hours by the background scheduler.

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
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for chat, topic extraction, and reflection synthesis |
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

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a message (with optional file content) |
| `GET` | `/chat/conversations` | List all conversations |
| `GET` | `/chat/conversations/{id}/messages` | Get messages in a conversation |

### Files

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/files/upload` | Upload a file and extract its text content |

### Memory

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/memory/episodes` | Recent episodes with topics (`?limit=`) |
| `GET` | `/memory/concepts` | Top concepts by episode count (`?limit=`) |
| `GET` | `/memory/stats` | Count of episodes, concepts, and reflections |

### Consolidation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/consolidation/run` | Manually trigger the consolidation pipeline |
| `GET` | `/consolidation/runs` | List past consolidation run logs (`?limit=`) |
| `GET` | `/consolidation/reflections` | List all synthesised Reflection nodes (`?limit=`) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service status for all components |

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
