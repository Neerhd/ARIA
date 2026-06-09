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
- Keep styling consistent with existing inline styles

**Never commit:**
- `.env` files
- `data/` directory contents
- `logs/` or `.pids/`
- `.venv/` or `node_modules/`

### Testing your changes

Before submitting:

1. Run the full stack: `bash scripts/start.sh`
2. Open [http://localhost:5173](http://localhost:5173) and verify the chat works
3. Test the health check: `curl http://localhost:8000/health`
4. If you changed backend code, check `logs/backend.log` for errors
5. If you changed the file upload feature, test with both a `.txt` and a `.pdf`

### Submitting

Push your branch and open a pull request against `main`. In the PR description:
- Explain what the change does and why
- Reference the relevant milestone (M1–M8) if applicable
- Include before/after screenshots for UI changes

## Code of conduct

Be constructive. This is a personal project shared publicly — contributions that are disrespectful, dismissive, or that significantly change the project's direction without discussion will be declined.
