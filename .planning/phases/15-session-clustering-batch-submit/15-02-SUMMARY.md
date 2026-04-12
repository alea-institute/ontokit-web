---
phase: 15-session-clustering-batch-submit
plan: 2
subsystem: ui-components
tags: [react, zustand, dnd-kit, radix-ui, accessibility, dark-mode]
dependency_graph:
  requires: [15-01]
  provides: [ShardPreviewSummaryBar, ShardPreviewPRGroup, ShardPreviewShardRow, ShardPreviewEntityList, ShardSubmitProgressBar, ShardSubmitComplete]
  affects: [15-03, 15-04]
tech_stack:
  added: []
  patterns: [radix-dropdown-menu-direct-import, dnd-kit-useDraggable-useDroppable, zustand-store-subscription-per-selector]
key_files:
  created:
    - components/suggestions/ShardPreviewSummaryBar.tsx
    - components/suggestions/ShardPreviewPRGroup.tsx
    - components/suggestions/ShardPreviewShardRow.tsx
    - components/suggestions/ShardPreviewEntityList.tsx
    - components/suggestions/ShardSubmitProgressBar.tsx
    - components/suggestions/ShardSubmitComplete.tsx
  modified: []
decisions:
  - "@radix-ui/react-dropdown-menu imported directly (not via ui/ wrapper) — no pre-built wrapper component exists in codebase; direct Radix import is consistent with how other primitives are used in this phase"
  - "ShardPreviewShardRow passes isSplitting/splitSelectedIris/onSplitToggle to children via React.cloneElement — keeps split state co-located with the shard row that triggered it rather than lifting to a shared context"
  - "ShardPreviewEntityList accepts both controlled (via onSplitToggle prop) and uncontrolled (local state) split selection — ShardPreviewShardRow drives it in controlled mode; standalone usage falls back to local state"
  - "max-h-[9999px] used for expand/collapse animation — CSS transition on max-height requires a concrete target value; 9999px is the established Tailwind workaround for unknown content heights"
  - "useDraggable id for entities includes shard.id suffix (entity-{iri}-{shardId}) — prevents ID collisions when same entity IRI could theoretically appear in multiple contexts during store hydration"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-08T00:12:00Z"
  tasks_completed: 2
  files_changed: 6
requirements:
  - CLUSTER-06
  - CLUSTER-09
---

# Phase 15 Plan 02: UI Sub-Components — Shard Preview Tree + Submit Flow

**One-liner:** Six "use client" components covering the shard preview tree (summary bar, PR groups, shard rows, entity lists) and submit flow (multi-step progress bar, success/partial-failure completion screen) with full dark mode, accessibility, and drag-and-drop integration.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create summary bar, PR group, and shard row components | 021b053 | ShardPreviewSummaryBar.tsx, ShardPreviewPRGroup.tsx, ShardPreviewShardRow.tsx |
| 2 | Create entity list, progress bar, and completion screen components | 2ad21ed | ShardPreviewEntityList.tsx, ShardSubmitProgressBar.tsx, ShardSubmitComplete.tsx |

## What Was Built

### components/suggestions/ShardPreviewSummaryBar.tsx

Compact horizontal bar rendering `{N} suggestions → {N} shards → {N} PRs` reactively from `useShardPreviewStore().getSummary()`. Numbers in `font-semibold`, arrows in `text-slate-400 dark:text-slate-500`, updates without animation (per UI-SPEC: instant update during dragging).

### components/suggestions/ShardPreviewPRGroup.tsx

Collapsible PR section with:
- `useDroppable({ id: prGroup.id, data: { type: "pr-group" } })` drop target — highlights with `ring-2 ring-inset ring-primary-500` when a shard is dragged over
- `ChevronRight`/`ChevronDown` toggle button with `aria-expanded` and `aria-label="Expand PR {N}"` / `"Collapse PR {N}"`
- Expand state read from `expandedPrIds.has(prGroup.id)` from store
- Max-height CSS transition for smooth collapse animation

### components/suggestions/ShardPreviewShardRow.tsx

Individual shard row with:
- `useDraggable({ id: shard.id, data: { type: "shard", shardId, fromPrId } })` on the grip handle
- Amber badge for `isMisc` ("Miscellaneous improvements"), violet for `isCrossCutting` ("Cross-cutting changes")
- Radix `DropdownMenu` with three menu items: "Merge into..." (submenu of other shards), "Split shard" (activates inline checkbox mode), "Move to PR..." (submenu of other PR groups)
- Split mode: activates via state, renders action bar with "Split selected (N)" button, passes `isSplitting`/`splitSelectedIris`/`onSplitToggle` to children via `React.cloneElement`
- Empty shard state: "No suggestions in this shard." in italic `text-slate-400`

### components/suggestions/ShardPreviewEntityList.tsx

Entity list shown when shard is expanded:
- Per-entity `useDraggable({ id: "entity-{iri}-{shardId}", data: { type: "entity", entityIri, fromShardId } })`
- `GripVertical` drag handle with `aria-label="Drag {localName} to reorder"`
- Entity display: `getLocalName(iri)` in `font-mono text-xs`, truncated at 48 chars, full IRI in `title` tooltip
- "Move to..." Radix `DropdownMenu` listing all other shards — keyboard-accessible fallback for drag
- Split mode: checkboxes replace drag handles; supports both controlled (via `onSplitToggle` prop) and uncontrolled modes

### components/suggestions/ShardSubmitProgressBar.tsx

Multi-step vertical progress indicator:
- `role="status" aria-live="polite"` container for screen reader announcements
- Per-step icons: `Circle` (idle), `Loader2` with `animate-spin` (active), `CheckCircle2` (done), `XCircle` (error)
- Active step: `border-l-2 border-primary-600 dark:border-primary-500` left accent with `transition-opacity duration-200 ease-out`
- Error message rendered below label in `text-xs text-red-500`

### components/suggestions/ShardSubmitComplete.tsx

Completion screen:
- All-success heading: "Suggestions submitted" / partial: "{N} of {M} PRs created"
- PR links: `target="_blank" rel="noopener noreferrer"` with `aria-label="Open PR #{N} on GitHub (opens in new tab)"` — T-15-03 mitigated
- Failed PRs: `bg-red-50 dark:bg-red-900/20` row with error message
- Footer: "Retry failed" (secondary) when `failed > 0` + "Done" (primary) buttons

## Verification

- `npm run type-check`: PASSES (clean output, no errors)
- `npm run lint`: Pre-existing ESLint config error (`eslint-config-next/core-web-vitals` import issue) — not caused by this plan
- All 6 files exist in `components/suggestions/`
- All 6 files have dark: variant classes (9, 7, 25, 6, 9, 10 instances respectively)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Adjustment:** `@radix-ui/react-dropdown-menu` imported directly (no `components/ui/dropdown-menu.tsx` wrapper exists in the codebase). This is the correct approach — `@radix-ui/react-dropdown-menu` is already installed per `package.json`, and all component classes are set inline as specified.

## Known Stubs

None. All components are fully implemented against the UI-SPEC contract.

- `ShardPreviewSummaryBar`: reads live store state — no stubs
- `ShardPreviewPRGroup`: drop target wired to `useDroppable` — no stubs
- `ShardPreviewShardRow`: all three context menu actions (merge/split/move) wired to store mutations — no stubs
- `ShardPreviewEntityList`: drag and "Move to..." dropdown fully wired to `moveEntity` store action — no stubs
- `ShardSubmitProgressBar`: stateless display component, no stub placeholders
- `ShardSubmitComplete`: PR links and retry/done callbacks are prop-driven — consumed by Plan 03 modal orchestrator

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-15-03 mitigated | components/suggestions/ShardSubmitComplete.tsx | All PR links use `target="_blank"` + `rel="noopener noreferrer"` — prevents reverse tabnabbing. URL source is trusted backend response, not user input. |

## Self-Check: PASSED

- components/suggestions/ShardPreviewSummaryBar.tsx: FOUND
- components/suggestions/ShardPreviewPRGroup.tsx: FOUND
- components/suggestions/ShardPreviewShardRow.tsx: FOUND
- components/suggestions/ShardPreviewEntityList.tsx: FOUND
- components/suggestions/ShardSubmitProgressBar.tsx: FOUND
- components/suggestions/ShardSubmitComplete.tsx: FOUND
- Commit 021b053: FOUND (feat(15-02): create summary bar, PR group, and shard row components)
- Commit 2ad21ed: FOUND (feat(15-02): create entity list, progress bar, and completion screen components)
- npm run type-check: PASSES
