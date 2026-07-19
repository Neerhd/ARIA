# ARIA UI Theming Spec — Neutral/Grayscale Token Migration

**Status:** Ready for Claude Code handoff
**Scope:** Frontend only. No backend changes. No new features beyond theming.
**Constraint carried over from prior handoff:** shadcn/ui base components stay unmodified — this is a token-level change, not a component override.

---

## Source of truth

Preset: `pnpm dlx shadcn@latest init --preset buFywKm --template vite`

Or paste directly into the frontend's global CSS:

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

### Design principles this encodes
- **Fully grayscale** — zero chroma on every token except `--destructive` (red) and dark-mode `--sidebar-primary` (blue, kept intentionally as the one accent).
- **`--radius: 0`** — sharp corners everywhere, no rounded defaults.
- **Elevation via lightness + borders, not shadows** — no box-shadow tokens. Light mode is flat white with border-only separation; dark mode separates surfaces by lightness steps (`0.145` → `0.205` → `0.269`) plus alpha-white borders.

---

## Phase 0 — Discovery & Confirmation
*Gate: do not proceed to Phase 1 without explicit sign-off.*

- Locate global CSS entry point and confirm current Tailwind config already reads shadcn CSS variables (it should, from the prior refactor)
- Confirm current frontend has no hardcoded hex/rgb colors bypassing tokens — flag any found, do not fix yet
- Confirm no component-level radius overrides exist outside the token
- Report findings and proposed file-touch list before making any edits

## Phase 1 — Token Foundation
- Apply the CSS block above (or run the preset command) to the global stylesheet
- Verify both `:root` and `.dark` blocks are wired to the existing dark-mode toggle mechanism
- No visual QA yet — just confirm tokens compile and the app still builds

## Phase 2 — Typography Layer
- Apply Geist Sans (body/UI) and Geist Mono (code/tabular stats) as the font stack — shadcn's default pairing
- Confirm `font-feature-settings: "tnum"` or equivalent is available for any numeric displays (tier badges, stats)
- **Open decision, not yet locked:** confirm Geist is acceptable or specify an alternative before this phase ships

## Phase 3 — Radius & Elevation Pass
- Sweep all surfaces (cards, dialogs, sheets, popovers, buttons, inputs) for hardcoded `border-radius` that would conflict with `--radius: 0`
- Verify dark-mode elevation reads correctly with lightness-step + border approach — no component should be relying on a shadow that no longer exists
- Flag (don't silently fix) any component that visually breaks at radius 0 due to icon/padding assumptions

## Phase 4 — Component Verification
In-scope components only, per existing constraint: **Badge, AlertDialog, Sheet, Tabs, DataTable, ScrollArea**
- Render each in both light and dark mode against the new tokens
- Confirm Badge pill styling still reads correctly at radius 0 (may look more like a tag/chip than a pill — expected, not a bug)
- Confirm DataTable header/row contrast is legible at the new muted/border values
- No modifications to component internals — token-only

## Phase 5 — QA & Regression Sign-off
- Full app visual pass, light and dark
- Confirm zero backend files touched
- Confirm zero features added beyond theming
- Screenshot before/after for the record (optional but recommended given this feeds the BRD)

---

## Open decisions requiring your input before Phase 2/3 ship
1. Typography: Geist (default assumption) or alternative?
2. Any component outside the original 6 (Badge/AlertDialog/Sheet/Tabs/DataTable/ScrollArea) that also needs radius-0 verification, e.g. buttons/inputs if they exist outside those primitives?
