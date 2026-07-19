You are closing out two deferred items from the M10 Projects milestone, then committing and pushing the result. Phase-gated as before: complete a phase, report, stop, wait for sign-off.

Full spec: see ARIA_M11_Fixes_Spec.md for rationale and phase detail.

## The two issues
1. Concept `episode_count` never decrements — only increments, drifting upward on episode/project deletion.
2. Memory Browser (episodes/concepts/reflections views) has no project-scoping — shows everything regardless of active project.

## Locked design decision
Episode and Reflection views in the Memory Browser scope to the active project. Concept view stays global (Concepts aren't project-scoped by design), but shows both "episodes in this project" and "total episodes" per Concept.

## Hard constraints
- M9 theming (grayscale tokens, radius 0) must not regress.
- M10 project scoping (recall, consolidation, tool system) must not regress.
- No new shadcn component overrides.
- Do not push directly to a protected/default branch (main/master) without explicit confirmation — stop and ask if that's the current branch.

## Execution model
Work through phases 0 → 4 in order. Stop after each phase and report: what you found/changed, files touched, anything that broke, open questions.

## Phase 0 — Discovery & Confirmation
- Locate the episode_count increment logic and confirm no decrement path exists anywhere.
- Locate the Memory Browser frontend components and confirm active-project state is already accessible to them (should exist from M10).
- Report proposed file-touch list before changing anything.

## Phase 1 — Fix Concept episode_count Decrement
- Add decrement logic on single-episode deletion.
- Add decrement logic on project deletion cascade.
- Write and run a one-off backfill script correcting any already-drifted counts. Report before/after counts.

## Phase 2 — Memory Browser Project Scoping
- Episode view: filter to active project.
- Reflection view: filter to active project.
- Concept view: stays global, show both in-project and total episode counts per Concept.
- Reuse existing shadcn primitives — no new overrides.

## Phase 3 — QA & Regression
- Confirm M9 theming intact.
- Confirm M10 scoping (recall, consolidation, tools) still functions.
- Confirm backfilled counts match a manual spot-check against real Neo4j data.
- Confirm Memory Browser updates correctly when switching projects.

## Phase 4 — Git Commit & Push
- Confirm current branch name first.
- Stage only files touched in Phases 1-2.
- Write a commit message summarizing both fixes.
- If the current branch is main/master or otherwise protected, stop and ask before pushing. Otherwise push and report the commit hash and push result.

Begin with Phase 0 only. Stop and report.
