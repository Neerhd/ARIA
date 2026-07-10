# Contributing to ARIA

Thank you for your interest in contributing. ARIA is an early-stage open source project and contributions of all kinds are welcome — bug reports, documentation improvements, feature work, and ideas.

## Before you start

Read the [README](README.md) to understand the project vision and milestone roadmap. ARIA has a deliberate scope — contributions that align with the BRD milestones are prioritised over tangential features.

## Reporting bugs

Open a GitHub issue with:
- A clear description of what happened vs what you expected
- Your macOS version and Apple Silicon chip (M1/M2/M3/M4)
- The relevant section of the log file (`logs/backend.log` or `logs/frontend.log`)
- Steps to reproduce

## Suggesting features

Open a GitHub issue labelled `enhancement`. Check the milestone roadmap in the README first — if the feature is already planned for a future milestone, note which one and describe how your idea fits or extends it.

## Submitting a pull request

### Setup

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/ARIA.git
cd ARIA

# Install dependencies
bash scripts/install.sh

# Create a branch
git checkout -b feature/your-feature-name
```

### Guidelines

**Keep changes focused.** One PR per logical change. Don't bundle a bug fix with a refactor.

**Match the existing code style.** Python files use standard FastAPI/SQLAlchemy patterns. React components use functional components with hooks. No class components.

**Don't add unnecessary dependencies.** Every new package is something everyone who clones the repo has to install. If there's a way to do it without adding a dependency, prefer that.

**Backend changes:**
- New endpoints go in `backend/api/`
- New services go in `backend/services/`
- Database models go in `backend/models/schemas.py`
- Always update `requirements.txt` if you add a package

**Frontend changes:**
- Components go in `frontend/src/components/`
- API calls go in `frontend/src/services/api.js`
- Keep styling consistent with the existing design system — Tailwind utility classes bound to the CSS custom properties in `index.css` (grayscale/OKLCH tokens, `--radius: 0`), and shadcn/ui primitives from `frontend/src/components/ui/`. Don't hand-roll new colors or component internals; extend the token system instead

**Never commit:**
- `.env` files
- `data/` directory contents
- `logs/` or `.pids/`
- `.venv/` or `node_modules/`

### Testing your changes

Before submitting:

1. Run the full stack: `bash scripts/start.sh`
2. Open [http://localhost:5173](http://localhost:5173) and verify the chat works end-to-end
3. Test the health check: `curl http://localhost:8000/health`
4. Open the Memory Browser (Memory button) and verify Episodes and Concepts populate after a few messages
5. In the Reflections tab, click **Run Consolidation Now** and verify it returns a result (needs 3+ episodes on one concept to create a reflection)
6. Test the model router: `curl http://localhost:8000/router/config` and verify T1/T2 show as `ready`
7. Test Auto mode — attach a file and confirm the response shows a T2 badge
8. Test Ask mode — attach a file and confirm a permission card appears before the model responds
9. If you changed backend code, check `logs/backend.log` for errors
10. If you changed the file upload feature, test with both a `.txt` and a `.pdf`
11. If you changed `graph_service.py`, verify the Neo4j schema still initialises cleanly on startup (look for "Neo4j schema ready" in the backend log)
12. If you changed `router_service.py` or `api/router.py`, confirm routing decisions appear in the `routing_logs` SQLite table
13. If you changed anything project-scoping related, create a second project and confirm a message in one never recalls memory from the other (check both the reply content and, if relevant, the `/graph` or `/memory/*` responses directly)
14. If you changed `graph_query_service.py` or anything touching `query_graph`, confirm a deliberately malicious question (e.g. "delete all episodes about X") is refused and doesn't change any row counts in SQLite or Neo4j — read-only must hold even if you think your change couldn't affect it
15. If you changed the Memory Browser or chat provenance, confirm the "Based on:" citations under a reply still click through to the right tab

### Submitting

Push your branch and open a pull request against `main`. In the PR description:
- Explain what the change does and why
- Reference the relevant milestone (M1–M14) if applicable
- Include before/after screenshots for UI changes

## Code of conduct

Be constructive. This is a personal project shared publicly — contributions that are disrespectful, dismissive, or that significantly change the project's direction without discussion will be declined.
