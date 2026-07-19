# ARIA — Adaptive Reasoning Intelligence Assistant

**A self-hosted personal AI that learns, grows, and evolves with you over time.**

ARIA's memory, chat history, and knowledge graph live entirely on your machine — no conversation history stored on someone else's server, no subscriptions. Model inference runs through AI providers you connect with your own pay-per-use API keys (Anthropic, OpenAI, Google, xAI, Perplexity — any one is enough to start), and a task-based router picks the right model for each message.

> Inspired by [Pewdiepie's Odysseus project](https://github.com/pewdiepie-archdaemon/odysseus). ARIA borrows the modular architecture and replaces the flat vector memory system with a novel graph-based memory that mirrors how human memory actually works.

---

## What makes ARIA different

Most self-hosted AI tools are just a chat interface pointed at a model. ARIA is designed to be something more: a system that gets smarter the longer you use it — not because the model improves, but because it *knows you better*.

| Feature | Standard RAG tools | ARIA |
|---|---|---|
| Memory | Vector similarity search | Knowledge graph + vector search, visually explorable in 3D |
| Learning | None — resets every session | Episodic → Semantic consolidation |
| Transparency | Black box — no way to see why it said something | Inline citations on every memory-informed reply, plus a natural-language query tool over the graph itself |
| Organization | One flat history | Multi-project scoping — conversations and episodic memory partitioned per project, topics stay connected across them |
| Model routing | One model for everything | Multi-provider, task-based routing — each kind of task answered by the model you assign to it |
| File access | Varies | Built-in — attach any file in chat |
| Privacy | Depends on setup | Memory, history, and graph 100% local; model inference via your own provider API keys |
| Cost | Often subscription-based | Pay-per-use API metering with a built-in cost tracker — no subscription |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         React Frontend                             │
│  Chat · Project Switcher · 3D Graph View · Memory Browser         │
│  File Attachments · Settings · Tool Pills                         │
└──────────────────────────────┬────────────────────────────────────┘
                               │ REST  (localhost:5173 → 8000)
┌──────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Backend                            │
│  /chat · /projects · /graph · /files/upload                       │
│  /memory/* · /consolidation/* · /router/*                         │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Agentic Tool Loop                       │  │
│  │  web_search → SearXNG · file_reader · file_writer            │  │
│  │  query_graph → NL-to-Cypher (read-only, project-scoped)     │  │
│  │  Output formats: .pdf  .docx  .xlsx  + any plain text       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────┬─────────────────┬──────────────────┬────────────────────────┘
       │                 │                  │
┌──────▼──────────┐  ┌───▼──────────┐  ┌────▼──────────────────────┐
│  AI Providers   │  │   SQLite     │  │      Memory Layer          │
│  (your keys)    │  │ Projects     │  │  ChromaDB (semantic,       │
│  Anthropic      │  │ Conversations│  │   project-scoped)          │
│  OpenAI         │  │ Messages     │  │  Neo4j (knowledge graph)   │
│  Google         │  │ Routing log  │  │  Episodes (project-scoped) │
│  xAI            │  │ Usage log    │  │  Concepts (global hubs)    │
│  Perplexity     │  └──────────────┘  │  Reflections · Facts       │
└─────────────────┘                    │  :7687                     │
  ↑ task-role router picks the         └────────────────────────────┘
    model per message (Auto) or
    you pick it yourself (Manual)
```

### Memory system

ARIA's memory is built on a knowledge graph, not flat vector storage. Memories are connected to each other — not just retrieved by similarity score.

| Node type | What it stores | Status |
|---|---|---|
| **Episode** | Raw interaction: prompt, response, timestamp, recall count, `project_id` | ✅ Live |
| **Concept** | Topic node linking related episodes; tracks episode frequency. Global — not scoped to a project, since a recurring topic across projects is real signal | ✅ Live |
| **Reflection** | Higher-order pattern synthesised from clusters of 3+ episodes *within a single project* | ✅ Live |
| **Fact** | User-pinned permanent facts; never decay, always injected into every session, global across projects | ✅ Live |

**Memory pipeline (currently active):**

1. **Write** — Every assistant reply is stored as an Episode node in Neo4j (shared ID with ChromaDB and SQLite)
2. **Extract** — Topic tags are extracted from each turn using the default provider's budget model; Concept nodes are created or incremented
3. **Link** — Episodes are connected to their Concepts (`DISCUSSES`) and to the previous episode in the conversation (`NEXT`)
4. **Recall** — ChromaDB semantic search finds relevant past episodes before each response
5. **Reinforce** — Recalled episodes have their `recall_count` incremented in Neo4j
6. **Consolidate** — A nightly background job clusters episodes by Concept (min 3 episodes, scoped per project), prompts the model to synthesise a Reflection, and stores it with `SYNTHESISED_FROM` and `ABOUT` edges

---

## Projects

ARIA scopes conversations and episodic memory by project. Click the **Projects** button in the header to switch, create, rename, or delete a project.

- **Conversations and Episodes belong to exactly one project.** New chats default to the active project; the Sidebar's conversation list filters to it.
- **Concepts stay global.** A topic like "client management" showing up across two different projects is real signal ARIA keeps connecting — full siloing would lose that.
- **Recall and consolidation are project-scoped.** A message in Project A never surfaces memories from Project B — enforced at the semantic-recall (ChromaDB) and Neo4j query layers, not just by convention.
- **Deleting a project cascades**: its conversations, messages, Episode nodes, and semantic-memory entries are removed. Concept nodes are left untouched, since they may still serve other projects.
- Every conversation created before Projects existed was migrated into a **Default** project — nothing was lost.

---

## 3D Knowledge Graph Visualizer

Click **Graph** in the header to switch the main view into an interactive 3D force-directed graph of your memory — Episodes, Concepts, and Reflections rendered as distinct shapes (sphere / cube / octahedron), with Concept nodes acting as visual hubs that Episodes cluster around.

- **Hover** a node for a lightweight tooltip (label, type, recall count).
- **Click** a node to focus it — its immediate connections highlight, everything else dims, and an info panel appears with a **View in Memory Browser** button.
- **Toggle** between the active project's graph and an all-projects view, useful for seeing where a Concept bridges multiple projects.
- Above 300 nodes, the view auto-collapses to Concept-only with click-to-reveal, so it stays readable as memory grows.

---

## Memory Provenance

Every reply that draws on memory shows a **"Based on:"** row of clickable citations under the message — the recalled past conversations or pinned facts that shaped the answer. Click one to jump straight into the Memory Browser.

This surfaces retrieval that already happens on every turn (ChromaDB semantic recall, pinned facts) rather than adding a new lookup — the goal is making an AI's reasoning auditable instead of a black box: you can see *why* ARIA said something, not just trust that it did.

---

## Milestone roadmap

| # | Milestone | Deliverables | Status |
|---|---|---|---|
| M1 | Infrastructure | Ollama, FastAPI, React UI, SQLite, Neo4j, ChromaDB | ✅ Complete |
| M2 | Core Chat | Multi-turn chat, file attachments, session persistence | ✅ Complete |
| M3 | Memory Layer v1 | Episodic memory capture, topic extraction, knowledge graph | ✅ Complete |
| M4 | Consolidation Pipeline | Reflection synthesis, nightly scheduler, memory browser UI | ✅ Complete |
| M5 | Model Router | 3-tier action-based router, three modes, tier badges, routing logged | ✅ Superseded by M15 |
| M6 | Tools + Permanent Memory | Web search, file reader/writer, multi-format export, pinned facts | ✅ Complete |
| M7 | MVP Testing | End-to-end testing, memory pattern validation | Planned |
| M8 | MVP Complete | Stable system, ready for Phase 2 | Planned |
| M9 | UI Theming | Grayscale/OKLCH design system, Geist typography, shadcn/ui primitives, dark mode | ✅ Complete |
| M10 | Projects | Multi-project scoping for conversations and memory, project switcher, cascading delete | ✅ Complete |
| M11 | Deferred Fixes | Concept episode-count decrement on deletion, Memory Browser project-scoping | ✅ Complete |
| M12 | 3D Knowledge Graph Visualizer | Interactive force-directed 3D graph of Episodes/Concepts/Reflections, click-to-focus, project/all-projects toggle | ✅ Complete |
| M13 | Chat With The Graph | Natural-language querying of the memory graph via a fourth agent tool — read-only, enforced at the Neo4j transaction level | ✅ Complete |
| M14 | Inline Memory Provenance | "Based on:" citations on memory-informed replies, click-through to Memory Browser | ✅ Complete |
| M15 | Multi-Provider Model Router | Five cloud providers behind one adapter layer, task-role classification, per-role model assignment, manual per-message picker, in-app API key management, cost tracking. Replaces the M5 local tiers; Ollama removed | ✅ Complete |

---

## Prerequisites

- **macOS with Apple Silicon** (M1/M2/M3/M4) — tested on Mac Mini
- **Homebrew** — [install here](https://brew.sh)
- **Node.js 18+** — `brew install node`
- **An API key from at least one AI provider** — Anthropic, OpenAI, Google, xAI, or Perplexity. Pay-per-use, no subscription; typical light use costs a few dollars a month. You can paste the key into ARIA's first-run screen after starting — no file editing required.

Everything else (Python 3.12, Neo4j, and all packages) is installed automatically by the setup script.

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
- Install Python 3.12 and Neo4j via Homebrew
- Create a Python virtual environment and install all packages
- Install all frontend npm packages
- Set up SearXNG (self-hosted web search)

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

Open **[http://localhost:5173](http://localhost:5173)** in your browser. On first launch ARIA shows a welcome screen: pick a provider, follow the link to create an API key, paste it in — the key is verified live before you continue. (Alternatively, set a key in `.env`, e.g. `ANTHROPIC_API_KEY=…`.)

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
│   ├── scripts/                # One-off data migration / repair scripts
│   │   ├── migrate_projects.py     # Backfills pre-M10 data into a "Default" project
│   │   └── fix_concept_counts.py   # Recomputes Concept.episode_count from live graph edges
│   ├── api/
│   │   ├── chat.py             # Chat endpoint + episodic memory, routing, and provenance pipeline
│   │   ├── consolidation.py    # Consolidation trigger, run log, reflections
│   │   ├── files.py            # File upload and text extraction
│   │   ├── health.py           # Health check for all services
│   │   ├── memory.py           # Memory browser endpoints (project-scoped)
│   │   ├── router.py           # Router config and routing log endpoints
│   │   ├── projects.py         # Project CRUD (M10)
│   │   └── graph.py            # Read-only graph-data endpoint for the 3D visualizer (M12)
│   ├── database/
│   │   ├── sqlite.py           # SQLAlchemy async engine and session
│   │   ├── neo4j_client.py     # Neo4j async driver
│   │   └── chroma_client.py    # ChromaDB persistent client
│   ├── models/
│   │   └── schemas.py          # ORM models (Project, Conversation, Message, ConsolidationRun, RoutingLog, UsageLog)
│   └── services/
│       ├── consolidation_service.py  # Reflection synthesis pipeline (per-project clustering)
│       ├── file_service.py           # PDF and text extraction (PyMuPDF)
│       ├── graph_service.py          # All Neo4j read/write operations
│       ├── graph_query_service.py    # NL-to-Cypher generation + read-only execution (M13)
│       ├── key_store.py              # Runtime provider API keys (added via Settings UI) (M15)
│       ├── memory_service.py         # ChromaDB store and semantic search (project-scoped)
│       ├── project_service.py        # Default-project resolution (M10)
│       ├── role_service.py           # Task-role definitions + role→model assignments (M15)
│       ├── role_classifier_service.py # Budget-model message classification for Auto mode (M15)
│       ├── router_service.py         # Provider registry + Anthropic/OpenAI-compatible adapters (M15)
│       ├── tool_service.py           # Tool definitions, executors, agentic loop, format writers
│       ├── usage_service.py          # Token/cost tracking with background writer (M15)
│       ├── web_search_service.py     # SearXNG wrapper
│       └── topic_service.py          # Topic tag extraction from conversations
├── frontend/
│   ├── index.html              # Vite entry point
│   ├── vite.config.js          # Vite + PWA config, /api proxy
│   ├── package.json
│   └── src/
│       ├── App.jsx             # Root component, view/project state, provenance click-through
│       ├── main.jsx            # Entry point
│       ├── index.css           # M9 design tokens — OKLCH grayscale palette, radius 0, Geist fonts
│       ├── components/
│       │   ├── FirstRunSetup.jsx   # Welcome screen when no provider key exists yet (M15)
│       │   ├── GraphView.jsx       # 3D force-directed graph (react-three-fiber) (M12)
│       │   ├── ProjectSwitcher.jsx # Project list/create/rename/delete (M10)
│       │   ├── InputBar.jsx        # Chat input, file attachment, manual-mode model picker
│       │   ├── MemoryBrowser.jsx   # Pinned/Episodes/Concepts/Reflections panel
│       │   ├── MessageList.jsx     # Message thread, retry-with-model menu, provenance citations
│       │   ├── RouterSettings.jsx  # Settings sheet — routing mode, usage, roles, providers
│       │   ├── Sidebar.jsx         # Conversation list, filtered to the active project
│       │   ├── memory/             # Memory Browser tab contents (one file per tab + shared cards)
│       │   ├── settings/           # Settings sheet sections (mode, usage, role assignments, provider keys)
│       │   └── ui/                 # shadcn/ui primitives (Badge, Sheet, Tabs, AlertDialog, ScrollArea, Table, …)
│       ├── hooks/
│       │   ├── useMemoryBrowser.js # Memory Browser data fetching + tab/filter state
│       │   └── useGraphData.js     # 3D graph data fetching (M12)
│       └── services/
│           └── api.js          # All backend API calls
├── voice/                      # ARIA Voice — system-wide dictation + voice commands
│   ├── recorder.py             # Hotkey listener (Ctrl+H dictation, Ctrl+J commands) + audio capture
│   ├── transcriber.py          # Local Whisper (faster-whisper) speech-to-text
│   ├── injector.py             # Clipboard-paste text injection
│   ├── command_mode.py         # Context capture (app/selection), ARIA client, clipboard restore
│   └── requirements.txt        # Voice-only Python dependencies (own .venv)
└── data/                       # Local databases (never committed)
    ├── sqlite/
    ├── chroma/
    └── neo4j/
```

---

## Memory Browser

Click **Memory** in the top-right corner to open the memory panel. It has four tabs, scoped to the active project (Concepts stay global — see [Projects](#projects)):

| Tab | What it shows |
|---|---|
| **Pinned** | Permanent facts saved with "remember this" — always injected into every conversation, never decay, global across projects. Click the delete button to remove a fact. |
| **Episodes** | Every conversation turn in the active project, with topic tags and recall count. Click a card to expand the full prompt and response. |
| **Concepts** | All topic nodes, sorted by frequency, shown with both an in-this-project count and a total-across-all-projects count. Click a concept to filter the Episodes tab. |
| **Reflections** | Higher-order patterns synthesised by the consolidation pipeline, scoped to the active project. Each card shows the concept, the synthesised insight, and how many episodes it was drawn from. Use the **Run Consolidation Now** button to trigger synthesis on demand. |

Reflections are also generated automatically every 24 hours by the background scheduler.

### Permanent memory

Say **"remember this"**, **"save this"**, **"don't forget"**, or **"note that"** followed by any fact and ARIA will store it permanently in Neo4j as a pinned `Fact` node. Pinned facts are:

- Injected at the top of every conversation's system prompt
- Never subject to memory decay or consolidation
- Visible and deletable in the **Pinned** tab of the Memory Browser

---

## Model Router

ARIA routes each message by **what kind of task it is**, across five supported providers — Anthropic (Claude), OpenAI (GPT), Google (Gemini), xAI (Grok), and Perplexity. Connect any subset with your own API keys; the first configured provider becomes the default, and every unassigned role follows it automatically.

### Task roles

In **Auto** mode, a small budget-model call (a fraction of a cent) classifies each message into one of six roles, and the message is answered by whatever model you've assigned to that role in **Settings → Task Roles**:

| Role | Covers | Default assignment |
|---|---|---|
| **Quick Chat** | Casual conversation, greetings, quick questions | Default provider's budget model |
| **Coding** | Writing, debugging, reviewing, explaining code | Default provider's main model |
| **Research** | Questions needing current/web information | Default provider's main model (+ web_search tool) |
| **Calculation & Reasoning** | Math, logic, step-by-step analysis | Default provider's main model |
| **Creative Writing** | Stories, poems, copywriting, brainstorming | Default provider's main model |
| **Agentic & Tools** | File reading/writing, document export, memory queries | Default provider's main model |

If classification ever fails, the message falls back to the default model — a routing hiccup can never block a reply.

### Routing modes

| Mode | Behaviour |
|---|---|
| **Auto** *(default)* | Classify each message into a task role, answer with that role's assigned model. |
| **Manual** | Model pills appear above the chat input — pick one and every message goes to it; deselect to fall back to the default model. |

Any reply's **Retry** button also opens a model menu ("Auto" + every available model) for a one-shot second opinion from a different AI.

### API keys

Keys are managed in **Settings → AI Providers** (or via `.env`). Pasted keys are verified with a live request before being accepted, and stored locally with owner-only file permissions. Providers without keys simply appear as "no key" — nothing breaks. Perplexity can't drive tools (no function calling), so it's best assigned to Research.

### Cost tracking

Every AI call — replies, message routing, memory upkeep — is logged with token counts and an estimated cost. **Settings → Usage** shows the last 7 days: total, per-day, and per-activity. Estimates come from public per-token prices; check your provider's console for exact billing.

Every routing decision is also logged to the `routing_logs` SQLite table with the mode, classified role, and model used.

---

## Tools

Tools are always available — the model decides per message whether one is relevant (a message needing file access typically classifies as **Agentic & Tools** and routes accordingly).

| Tool | What it does | Notes |
|---|---|---|
| **Web Search** | Searches the web via a self-hosted SearXNG instance and returns results to ARIA | Requires SearXNG on `localhost:8080` (installed automatically) |
| **File Reader** | Reads any local file by absolute path | Supports all text formats up to 50,000 characters |
| **File Writer** | Creates files at any absolute path | Supports rich output formats (see below) |
| **Query Memory Graph** | Ask a natural-language question about past conversations and topics — translated into Cypher, executed read-only, answered in plain English | Scoped to the active project (Concepts remain global). Strictly read-only, enforced at the Neo4j transaction level, not just by prompting. Doesn't yet produce inline citations the way regular memory recall does (see [Memory Provenance](#memory-provenance)) — a natural follow-up, not yet built |

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

## Voice — system-wide dictation and voice commands

ARIA Voice runs alongside the app (started automatically by `start.sh`) and works in **any** macOS app, not just ARIA's chat window:

| Mode | Hotkey | What happens |
|---|---|---|
| **Dictation** | Tap `Ctrl+H` to start, tap again to stop | Your words are transcribed locally (Whisper — audio never leaves the machine) and typed into whatever field has focus |
| **Command** | **Hold** `Ctrl+J`, speak, release | Your request goes to ARIA with context — which app you're in, plus anything you had selected — and ARIA's *answer* is pasted in its place. A soft pop confirms it heard you; an error tone means ARIA was unreachable (nothing is pasted) |

Command-mode examples:

- In **Notes**: *"fill this with today's ARIA decisions, with references"* → a formatted summary drawn from memory appears
- In **Mail**, with an email selected: *"write a response to this"* → a paste-ready draft (ARIA checks your calendar on its own if availability matters)

Voice commands have their own **Voice** task role — the budget model by default for snappy replies, reassignable in **Settings → Task Roles** if you prefer depth over speed. They search memory **across all projects**, are stored in a rolling **Voice Commands** conversation (Default project), and enter memory like normal chat. Your clipboard is snapshotted and restored around each command (text-only fidelity — a copied image won't survive it). First run needs one-time **microphone** and **accessibility** permissions for the terminal app that runs ARIA. Dictation is 100% local; command-mode transcripts go to your configured AI provider like any chat message.

---

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

**AI providers**

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| `XAI_API_KEY` | [console.x.ai](https://console.x.ai) |
| `PERPLEXITY_API_KEY` | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |

At least one key is required for chat. Keys can also be added (and verified live) in **Settings → AI Providers** — keys added there are stored in `backend/data/provider_keys.json` and take precedence over `.env`. The first configured provider (in the order above) becomes the default.

---

## API reference

The backend exposes a REST API documented interactively at [http://localhost:8000/docs](http://localhost:8000/docs) when running.

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a message (optional file content, `project_id`, `tools_enabled`). Response includes `sources` — provenance citations for any recalled memory used |
| `GET` | `/chat/conversations` | List conversations (`?project_id=` to filter) |
| `GET` | `/chat/conversations/{id}/messages` | Get messages in a conversation |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{id}` | Get a project |
| `PATCH` | `/projects/{id}` | Rename or update a project's description |
| `DELETE` | `/projects/{id}` | Delete a project — cascades to its conversations, messages, and memory (Concepts are untouched) |

### Graph

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/graph` | Nodes and edges for the 3D visualizer. `?project_id=&scope=project` (default, Episodes/Reflections scoped, connected Concepts included) or `?scope=all` |

### Files

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/files/upload` | Upload a file and extract its text content |

### Memory

All endpoints below require `?project_id=` (Concepts are returned globally but annotated with a per-project count alongside the total).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/memory/episodes` | Recent episodes with topics, scoped to the project (`?limit=`) |
| `GET` | `/memory/concepts` | Top concepts by episode count — global, with `project_episode_count` and total `episode_count` per concept (`?limit=`) |
| `GET` | `/memory/stats` | Episode/reflection counts scoped to the project; concept/fact counts global |
| `GET` | `/memory/pinned` | All pinned Fact nodes (global) |
| `DELETE` | `/memory/pinned/{fact_id}` | Delete a pinned fact |

### Consolidation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/consolidation/run` | Manually trigger the consolidation pipeline — clusters per project, not globally |
| `GET` | `/consolidation/runs` | List past consolidation run logs (`?limit=`) |
| `GET` | `/consolidation/reflections` | Synthesised Reflection nodes, scoped to a project (`?project_id=&limit=`) |

### Router

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/router/config` | Providers with model catalogs, key status, and the current default |
| `PUT` | `/router/providers/{id}/key` | Store a provider API key (verified with a live request before accepting) |
| `DELETE` | `/router/providers/{id}/key` | Remove a stored key (an `.env` key, if any, resurfaces) |
| `GET` | `/router/roles` | Effective role→model assignments |
| `PUT` | `/router/roles/{id}` | Assign a provider+model to a task role |
| `DELETE` | `/router/roles/{id}` | Reset a role to its dynamic default |
| `GET` | `/router/usage` | Estimated spend, by day/provider/activity (`?days=`) |
| `GET` | `/router/logs` | Recent routing decisions (`?limit=`) |

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
- [GAAMA](https://arxiv.org/abs/2406.14429) — graph-augmented associative memory research
- [Graphiti](https://github.com/getzep/graphiti) — temporal knowledge graph reference
- [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) — spaced repetition algorithm (planned for memory decay)
