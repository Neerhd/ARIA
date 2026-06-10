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
┌───────────────────────────────────────────────────────────────────┐
│                         React Frontend                             │
│  Chat · File Attachments · Memory Browser · Settings · Tool Pills │
└──────────────────────────────┬────────────────────────────────────┘
                               │ REST  (localhost:5173 → 8000)
┌──────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Backend                            │
│  /chat · /files/upload · /memory/* · /consolidation/* · /router/* │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Agentic Tool Loop                       │  │
│  │  web_search → SearXNG · file_reader · file_writer           │  │
│  │  Output formats: .pdf  .docx  .xlsx  + any plain text       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────┬─────────────────┬──────────────────┬────────────────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌────────▼──────────────────┐
│   Ollama    │  │   SQLite     │  │      Memory Layer          │
│ T1 llama3.2 │  │ Conversations│  │  ChromaDB (semantic)       │
│ T2 qwen2.5  │  │ Messages     │  │  Neo4j (knowledge graph)   │
│   :11434    │  │ Routing log  │  │  Episodes · Concepts       │
└─────────────┘  └──────────────┘  │  Reflections · Facts       │
                                   │  :7687                     │
┌─────────────┐                    └────────────────────────────┘
│  Anthropic  │
│   Claude    │  ← T3 (tools, complex tasks, reasoning)
│  (cloud)    │
└─────────────┘
```

### Memory system

ARIA's memory is built on a knowledge graph, not flat vector storage. Memories are connected to each other — not just retrieved by similarity score.

| Node type | What it stores | Status |
|---|---|---|
| **Episode** | Raw interaction: prompt, response, timestamp, recall count | ✅ Live |
| **Concept** | Topic node linking related episodes; tracks episode frequency | ✅ Live |
| **Reflection** | Higher-order pattern synthesised from clusters of 3+ episodes | ✅ Live |
| **Fact** | User-pinned permanent facts; never decay, always injected into every session | ✅ Live |

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
| M5 | Model Router | 3-tier action-based router, three modes, tier badges, routing logged | ✅ Complete |
| M6 | Tools + Permanent Memory | Web search, file reader/writer, multi-format export, pinned facts | ✅ Complete |
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
│   │   ├── chat.py             # Chat endpoints + episodic memory + routing pipeline
│   │   ├── consolidation.py    # Consolidation trigger, run log, reflections
│   │   ├── files.py            # File upload and text extraction
│   │   ├── health.py           # Health check for all services
│   │   ├── memory.py           # Memory browser endpoints
│   │   └── router.py           # Router config and routing log endpoints
│   ├── database/
│   │   ├── sqlite.py           # SQLAlchemy async engine and session
│   │   ├── neo4j_client.py     # Neo4j async driver
│   │   └── chroma_client.py    # ChromaDB persistent client
│   ├── models/
│   │   └── schemas.py          # ORM models (Conversation, Message, ConsolidationRun, RoutingLog)
│   └── services/
│       ├── consolidation_service.py  # Reflection synthesis pipeline
│       ├── file_service.py           # PDF and text extraction (PyMuPDF)
│       ├── graph_service.py          # All Neo4j read/write operations
│       ├── memory_service.py         # ChromaDB store and semantic search
│       ├── ollama_service.py         # Ollama chat and health check
│       ├── router_service.py         # Tier classification, Ollama + Anthropic + OpenAI dispatch
│       ├── tool_service.py           # Tool definitions, executors, agentic loop, format writers
│       ├── web_search_service.py     # SearXNG wrapper
│       └── topic_service.py          # Topic tag extraction from conversations
├── frontend/
│   ├── index.html              # Vite entry point
│   ├── vite.config.js          # Vite + PWA config, /api proxy
│   ├── package.json
│   └── src/
│       ├── App.jsx             # Root component, routing state, settings toggle
│       ├── main.jsx            # Entry point
│       ├── components/
│       │   ├── InputBar.jsx        # Chat input, file attachment, tier selector
│       │   ├── MemoryBrowser.jsx   # Episodes, Concepts, Reflections panel
│       │   ├── MessageList.jsx     # Message thread, tier badges, routing prompts
│       │   ├── ModelBadge.jsx      # T1/T2/T3 badge on every assistant message
│       │   ├── RoutingPrompt.jsx   # Ask-mode permission card in chat thread
│       │   ├── RouterSettings.jsx  # Settings overlay — mode selector and tier info
│       │   ├── Sidebar.jsx         # Conversation list
│       │   └── StatusBar.jsx       # Live service health dots
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
| **Pinned** | Permanent facts saved with "remember this" — always injected into every conversation, never decay. Click the delete button to remove a fact. |
| **Episodes** | Every conversation turn stored in Neo4j, with topic tags and recall count. Click a card to expand the full prompt and response. |
| **Concepts** | All topic nodes extracted from conversations, sorted by frequency. Click a concept to filter the Episodes tab. |
| **Reflections** | Higher-order patterns synthesised by the consolidation pipeline. Each card shows the concept, the synthesised insight, and how many episodes it was drawn from. Use the **Run Consolidation Now** button to trigger synthesis on demand. |

Reflections are also generated automatically every 24 hours by the background scheduler.

### Permanent memory

Say **"remember this"**, **"save this"**, **"don't forget"**, or **"note that"** followed by any fact and ARIA will store it permanently in Neo4j as a pinned `Fact` node. Pinned facts are:

- Injected at the top of every conversation's system prompt
- Never subject to memory decay or consolidation
- Visible and deletable in the **Pinned** tab of the Memory Browser

---

## Model Router

ARIA has a three-tier model system. The router automatically picks the right model based on what you are doing, and every response shows a coloured badge (T1/T2/T3) so you always know which model answered.

| Tier | Default model | When it runs |
|---|---|---|
| **T1** | `llama3.2:3b` (local, ~2 GB) | Default — fast responses for casual chat and simple questions |
| **T2** | `qwen2.5:14b` (local, ~9 GB) | File attached, or conversation exceeds 15 messages |
| **T3** | `claude-sonnet-4-6` (cloud) | Any tool enabled (web search, file reader/writer), or manually selected |

T3 auto-activates whenever a tool is enabled because local models do not reliably generate structured tool calls. T3 requires `TIER3_API_KEY` in `.env`.

### Routing modes

Click **⚙ Settings** in the top-right corner to choose how the router behaves:

| Mode | Behaviour |
|---|---|
| **Auto** *(default)* | System upgrades silently when it detects a heavier task. You see which tier responded via the badge. |
| **Ask** | System detects when an upgrade is warranted and shows a permission card in the chat before switching. You approve or decline. |
| **Manual** | T1/T2/T3 selector appears in the input bar. You set the tier for the whole conversation. |

Every routing decision is logged to the `routing_logs` SQLite table with the mode, classified tier, actual tier, model used, and the signals that triggered the classification.

---

## Tools

Enable tools in **⚙ Settings → Tools**. Enabling any tool automatically routes the request to T3 (Claude Sonnet) for reliable agentic execution.

| Tool | What it does | Notes |
|---|---|---|
| **Web Search** 🔍 | Searches the web via a self-hosted SearXNG instance and returns results to ARIA | Requires SearXNG on `localhost:8080` (installed automatically) |
| **File Reader** 📂 | Reads any local file by absolute path | Supports all text formats up to 50,000 characters |
| **File Writer** 💾 | Creates files at any absolute path | Supports rich output formats (see below) |

### File output formats

When using the File Writer tool, ARIA writes content as Markdown and the backend converts it automatically based on the file extension:

| Extension | Format | What gets generated |
|---|---|---|
| `.pdf` | PDF | Formatted A4 PDF — headings, bullet lists, horizontal rules |
| `.docx` | Word document | Styled Word doc — heading styles, bold/italic, lists |
| `.xlsx` | Excel spreadsheet | Parses Markdown tables or CSV content into a formatted sheet |
| `.txt`, `.md`, `.html`, `.json`, `.csv`, `.py`, etc. | Plain text | Written as-is |

Example prompts:
- *"Research X and save a report to ~/Desktop/report.pdf"*
- *"Create a project plan and save it as ~/Documents/plan.docx"*
- *"Make a comparison table and save to ~/Desktop/data.xlsx"*

## Supported file types (attachments)

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

**Core**

| Variable | Default | Description |
|---|---|---|
| `NEO4J_PASSWORD` | — | Must match the password you set in the Neo4j browser |
| `SQLITE_DB_PATH` | `./data/sqlite/aria.db` | Path to the conversation database |
| `CHROMA_DB_PATH` | `./data/chroma` | Path to the vector memory store |

**Model tiers**

| Variable | Default | Description |
|---|---|---|
| `TIER1_MODEL` | `llama3.2:3b` | Fast local model — casual chat, quick questions |
| `TIER2_MODEL` | `qwen2.5:14b` | Capable local model — file analysis, long conversations |
| `TIER3_MODEL` | `claude-sonnet-4-6` | Cloud model name |
| `TIER3_API_KEY` | *(empty)* | API key for Tier 3. For Claude: get a key at [console.anthropic.com](https://console.anthropic.com). Leave empty to disable cloud. |
| `TIER3_BASE_URL` | `https://api.anthropic.com/v1` | Base URL. Set to `https://generativelanguage.googleapis.com/v1beta/openai/` to use Gemini instead. |

Tier 3 is disabled by default. ARIA works fully offline with just Tier 1 and Tier 2.

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
| `GET` | `/memory/stats` | Count of episodes, concepts, reflections, and pinned facts |
| `GET` | `/memory/pinned` | All pinned Fact nodes |
| `DELETE` | `/memory/pinned/{fact_id}` | Delete a pinned fact |

### Consolidation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/consolidation/run` | Manually trigger the consolidation pipeline |
| `GET` | `/consolidation/runs` | List past consolidation run logs (`?limit=`) |
| `GET` | `/consolidation/reflections` | List all synthesised Reflection nodes (`?limit=`) |

### Router

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/router/config` | Tier models, types, availability status, and descriptions |
| `GET` | `/router/logs` | Recent routing decisions with signals (`?limit=`) |

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
