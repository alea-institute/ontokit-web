---
phase: 11-roles-llm-abstraction-cost-controls
plan: "05"
subsystem: frontend/editor-llm-ui
tags: [llm, budget, role-badge, byo-key, member-management, pr-merge]
dependency_graph:
  requires: ["11-03", "11-04"]
  provides: ["LLMBudgetBanner", "LLMRoleBadge", "BYOKeyPopover", "AdminSelfMergeDialog", "member-self-merge-toggle"]
  affects: ["editor-layouts", "member-list", "pr-actions"]
tech_stack:
  added: []
  patterns: ["useLLMGate hook integration", "Zustand byoKeyStore", "CSS toggle pattern (peer/peer-checked)"]
key_files:
  created:
    - components/projects/BYOKeyPopover.tsx
    - components/editor/LLMBudgetBanner.tsx
    - components/editor/LLMRoleBadge.tsx
    - components/pr/AdminSelfMergeDialog.tsx
  modified:
    - components/projects/member-list.tsx
    - components/editor/developer/DeveloperEditorLayout.tsx
    - components/editor/standard/StandardEditorLayout.tsx
    - lib/api/projects.ts
decisions:
  - "LLMBudgetBanner placed above developer sub-header row in DeveloperLayout and above main content in StandardLayout"
  - "StandardEditorLayout wraps content in flex-col to allow banner + badge row + content stack"
  - "AdminSelfMergeDialog uses custom dialog (not ConfirmDialog) to satisfy role=dialog + aria-modal requirements per plan spec"
  - "UI-SPEC copy takes precedence over plan spec copy where they differ (title: 'Merge directly to main?' vs plan's 'Merge directly?')"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-06"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 8
---

# Phase 11 Plan 05: Editor LLM UI, Self-Merge Toggle, and Admin Dialog Summary

**One-liner:** Editor LLM affordances (budget banner, role badge, BYO key popover), member structural self-merge toggle, and admin self-merge confirmation dialog per D-20.

## What Was Built

### Task 1: BYOKeyPopover, LLMBudgetBanner, LLMRoleBadge

**BYOKeyPopover** (`components/projects/BYOKeyPopover.tsx`):
- 280px fixed-width popover anchored via CSS `position: absolute; top: 100%; left: 0; mt-2`
- Password input with Enter key support, validates key via `llmApi.testConnection` with `X-BYO-API-Key` header
- Stores to `byoKeyStore.setKey()` before validation, calls `markValidated()` on success
- Dismisses on Escape key and click-outside (deferred 0ms to prevent self-triggering)
- Inline error display for validation failures

**LLMBudgetBanner** (`components/editor/LLMBudgetBanner.tsx`):
- Renders only when `budgetExhausted` OR `monthlySpentUsd / monthlyBudgetUsd >= 0.8`
- Warning state (80-99%): amber styling, percentage + remaining dollar amount
- Exhausted state (100%+): red styling, `role="alert"`, assertive screen reader announcement via `useAnnounce()`
- Dismissible via X button; `dismissed` resets when `budgetExhausted` changes

**LLMRoleBadge** (`components/editor/LLMRoleBadge.tsx`):
- Returns `null` when `roleLimitLabel` is null (viewers, anonymous)
- Admin/owner: violet; Editor: blue; Suggester: green
- `aria-label="Your LLM access: {roleLimitLabel}"` for screen reader support

### Task 2: Self-merge toggle + editor layout wiring

**`lib/api/projects.ts`**: Added `can_self_merge_structural?: boolean` to both `ProjectMember` and `MemberUpdate`.

**`member-list.tsx`**: Self-merge toggle for `editor`-role members:
- Toggle only renders when `member.role === "editor" && canManageMembers`
- `<label>` wrapper has `min-h-[44px]` for WCAG 2.5.5 touch target
- Uses `peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-primary-600` matching existing toggle pattern

**`DeveloperEditorLayout.tsx`**: Added `userRole?: ProjectRole | null` prop, `useLLMGate` hook, banner above sub-header, badge in sub-header toolbar row.

**`StandardEditorLayout.tsx`**: Same wiring — outer div changed to `flex-col` to stack banner + badge row + content horizontally. Badge only shows when `roleLimitLabel` is non-null.

### Task 3: AdminSelfMergeDialog

**`components/pr/AdminSelfMergeDialog.tsx`**:
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on heading
- Title: "Merge directly to main?", body: structural change warning per UI-SPEC
- Danger variant "Merge directly" button, outline "Cancel" button
- Escape key dismissal, click-outside dismissal on backdrop
- Focus on cancel button at open (safer default)
- Loading spinner state on confirm button
- Integration comment at top of file documents gate check pattern for PRActions.tsx

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ae8d325 | feat | BYOKeyPopover, LLMBudgetBanner, LLMRoleBadge components |
| b400b17 | feat | Wire banner/badge into editor layouts; self-merge toggle |
| 842dce0 | feat | AdminSelfMergeDialog confirmation component (D-20) |

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Clarifications

**1. [UI-SPEC precedence] AdminSelfMergeDialog copy follows UI-SPEC not task spec**
- **Found during:** Task 3
- **Issue:** Plan task spec says title "Merge directly?" and body "You are about to merge this directly. Continue?" but UI-SPEC says title "Merge directly to main?" and body "You are about to merge this structural change without peer review. This cannot be undone."
- **Resolution:** Followed UI-SPEC (approved design contract), which is the canonical source.

**2. [Layout adaptation] StandardEditorLayout wraps in flex-col**
- **Found during:** Task 2
- **Issue:** Standard layout root div was `flex h-full min-w-0 flex-1` (row direction). Adding banner above required column direction.
- **Fix:** Added `flex-col` to root div, wrapped inner row content in `<div className="flex min-h-0 flex-1">`. This preserves the existing tree/detail panel layout while enabling stacked banner+badge+content.

## Known Stubs

None. All components render live data from `useLLMGate`. BYO key popover calls real `llmApi.testConnection`. AdminSelfMergeDialog is a pure UI component with no stubs — it's wired up by the caller.

**AdminSelfMergeDialog integration pending:** The dialog is complete but not yet wired into PRActions.tsx. A code comment in the file documents the exact gate pattern. The plan explicitly states "wiring into the existing PR merge button is NOT required in this task."

## Self-Check: PASSED

- All 8 files exist on disk (verified)
- All 3 commits found in git log (ae8d325, b400b17, 842dce0)
- `npm run type-check` passes with zero errors
- `npx eslint` on all modified files produces zero errors
