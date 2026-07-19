You are executing a phased UI theming migration on the ARIA frontend. This is a token-level restyle only — you are not modifying shadcn/ui component internals, not touching any backend code, and not adding any feature beyond theming.

Full spec: see ARIA_UI_Theming_Spec.md (attached/provided alongside this prompt) for the exact CSS token block, design rationale, and phase-by-phase acceptance criteria.

## Hard constraints (carried over from the original frontend refactor handoff)
- Use unmodified shadcn/ui base components. No custom overrides to component internals.
- Do not touch backend code.
- Do not add features that weren't requested.
- In-scope components: Badge, AlertDialog, Sheet, Tabs, DataTable, ScrollArea.

## Execution model — phase-gated
Work through phases 0 → 5 in order. After completing each phase, STOP and report:
- what you found / what you changed
- any file you touched
- anything that broke or looks visually wrong
- the specific question(s) listed at the end of that phase, if any

Do not proceed to the next phase until I confirm. This is deliberate — I want to catch problems early rather than unwind a full pass.

## Phase 0 — Discovery & Confirmation
- Locate the global CSS entry point.
- Confirm the Tailwind config already consumes shadcn CSS variables from the prior refactor.
- Search for hardcoded hex/rgb colors bypassing tokens — list them, do not fix yet.
- Search for component-level radius overrides outside the token system — list them, do not fix yet.
- Report a proposed file-touch list for Phases 1-4 before doing anything else.

## Phase 1 — Token Foundation
Apply this exact CSS to the global stylesheet (light + dark):

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

Note: `--sidebar-primary` in dark mode is intentionally blue (`oklch(0.488 0.243 264.376)`) — this is deliberate, not a bug to fix. Every other token is zero-chroma except `--destructive`.

Confirm the app builds and both root/dark blocks wire into the existing dark-mode toggle. No visual QA yet.

## Phase 2 — Typography Layer
- Apply Geist Sans (UI/body) and Geist Mono (code, tabular stats) as the font stack.
- Add tabular-number support for any numeric displays (tier badges, stats).
- If Geist isn't already a dependency, flag it before installing anything new.

## Phase 3 — Radius & Elevation Pass
- Sweep all surfaces (cards, dialogs, sheets, popovers, buttons, inputs) for hardcoded border-radius conflicting with `--radius: 0`.
- Verify dark-mode elevation reads correctly using lightness steps + alpha-white borders — there are no shadow tokens in this system, don't add any.
- Flag anything that visually breaks at radius 0. Don't silently patch it — report and wait.

## Phase 4 — Component Verification
For each of Badge, AlertDialog, Sheet, Tabs, DataTable, ScrollArea:
- Render in light and dark mode against the new tokens.
- Confirm Badge reads correctly as a sharp-cornered tag (expected look, not a bug).
- Confirm DataTable contrast is legible against the new muted/border values.
- Token-only — no internal component edits.

## Phase 5 — QA & Regression Sign-off
- Full light/dark visual pass across the app.
- Confirm zero backend files touched.
- Confirm zero unrequested features added.
- Take before/after screenshots for the record.

Begin with Phase 0 only. Stop and report.
