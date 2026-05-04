---
phase: 16-reviewer-enhancements
plan: "03"
subsystem: suggestions-ui
tags: [ui, components, tdd, duplicate-detection, review, suggestions]
dependency_graph:
  requires:
    - lib/api/suggestions.ts::EntityReviewMetadata (Plan 16-01)
    - lib/api/suggestions.ts::DuplicateCandidate (via lib/api/generation.ts, Plan 16-01)
    - lib/api/client.ts::OWLClassDetail (existing)
    - lib/api/client.ts::projectOntologyApi.getClassDetail (existing)
  provides:
    - components/suggestions/SimilarEntitiesInlinePanel.tsx::SimilarEntitiesInlinePanel
    - components/suggestions/DuplicateComparisonExpander.tsx::DuplicateComparisonExpander
    - components/suggestions/ShardReviewMarker.tsx::ShardReviewMarker
    - components/suggestions/ShardReviewMarker.tsx::ShardMark
    - components/suggestions/ShardReviewMarker.tsx::ShardMarkStatus
  affects:
    - plan 16-04 (review page integration consumes all three components)
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN) with vi.mock for API client
    - Collapsible accordion pattern from SimilarConceptsPanel
    - scoreColor() function reused locally (green/amber/slate thresholds)
    - Lazy fetch on mount (DuplicateComparisonExpander) — not pre-fetched
    - Three-state component pattern (unmarked/approved/rejected) with local state
key_files:
  created:
    - components/suggestions/SimilarEntitiesInlinePanel.tsx
    - components/suggestions/DuplicateComparisonExpander.tsx
    - components/suggestions/ShardReviewMarker.tsx
    - __tests__/components/suggestions/SimilarEntitiesInlinePanel.test.tsx
    - __tests__/components/suggestions/ShardReviewMarker.test.tsx
  modified: []
decisions:
  - scoreColor() defined locally in each component (not shared util) — matches SimilarConceptsPanel pattern, avoids premature abstraction
  - DuplicateComparisonExpander fetches on mount (useEffect []) not on first-expand — component is only mounted when a candidate is clicked so lazy-load semantics are preserved
  - ShardReviewMarker localFeedback state initialized from mark?.feedback so textarea retains pre-existing feedback on re-render
  - AnnotationProperty.values[0].value used for annotation display — field is values[] not value string (per actual type definition)
metrics:
  duration_minutes: 2
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 5
---

# Phase 16 Plan 03: Duplicate Panel + Shard Marker UI Components Summary

**One-liner:** Three new review-page components — collapsible duplicate candidates panel (0.40 threshold), lazy-loading side-by-side entity comparison, and per-shard approve/reject strip with feedback textarea — all with TDD unit tests.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | SimilarEntitiesInlinePanel + DuplicateComparisonExpander with 5 tests (TDD) | d010e43 | components/suggestions/SimilarEntitiesInlinePanel.tsx, components/suggestions/DuplicateComparisonExpander.tsx, __tests__/components/suggestions/SimilarEntitiesInlinePanel.test.tsx |
| 2 | ShardReviewMarker with 8 tests (TDD) | 3871635 | components/suggestions/ShardReviewMarker.tsx, __tests__/components/suggestions/ShardReviewMarker.test.tsx |

## What Was Built

### SimilarEntitiesInlinePanel

Collapsible panel showing duplicate candidates per entity in the review diff. Filters candidates by `score > 0.40` (D-04) and renders nothing if no candidates meet the threshold. Uses exact collapsible trigger pattern from `SimilarConceptsPanel` (`aria-expanded`, `aria-controls`, `ChevronRight`/`ChevronDown`). Each candidate is clickable — opens `DuplicateComparisonExpander` in accordion style (one at a time).

### DuplicateComparisonExpander

Side-by-side comparison of proposed vs existing entity. Lazy-loads existing entity via `projectOntologyApi.getClassDetail` on mount (only mounted when candidate is clicked, so lazy semantics hold). Shows 4 skeleton rows while loading, inline retry button on error. Two-column layout (`grid grid-cols-2 gap-4`, `min-w-[200px]` per column), `max-h-[400px] overflow-y-auto`. Matching labels highlighted in `bg-amber-100`. Annotation values use `line-clamp-3` with "Show more" toggle.

### ShardReviewMarker

Per-shard action strip with three states:
- **Unmarked**: green-outline "Approve shard" + red-outline "Reject shard" buttons
- **Approved**: `CheckCircle` icon + "Shard approved" in green-600 + Clear button; `role="status"` + `aria-live="polite"`
- **Rejected**: `XCircle` icon + "Shard rejected" in red-600 + inline `textarea` (maxLength=500, resize-none) + Clear button

All mark changes route through `onChange(shardId, mark | undefined)`. Clear resets to undefined (unmarked). Threat mitigation T-16-07: `maxLength={500}` enforced; content rendered as text nodes (no dangerouslySetInnerHTML).

## Test Results

- **SimilarEntitiesInlinePanel**: 5 tests, all passing
  - Threshold filter (returns null when all ≤ 0.40)
  - Trigger text with correct count
  - Collapsed by default
  - Toggle expands candidates
  - Below-threshold candidate hidden in expanded list
- **ShardReviewMarker**: 8 tests, all passing
  - Unmarked renders both action buttons
  - Approve calls onChange with approved mark
  - Reject calls onChange with rejected + empty feedback
  - Approved state: status text + Clear button visible
  - Rejected state: status text + textarea visible
  - Clear on approved calls onChange(undefined)
  - Textarea change calls onChange with updated feedback
  - Approved state has role=status + aria-live=polite
- **Full suite**: 178 passed, 8 skipped, 0 failures
- **TypeScript**: 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AnnotationProperty.values[] not .value**
- **Found during:** Task 1 implementation
- **Issue:** Plan spec referenced `annotation.value` but `AnnotationProperty` interface has `values: LocalizedString[]` (checked in `lib/api/client.ts` lines 412-416)
- **Fix:** Used `annotation.values[0]?.value ?? ""` for annotation display in DuplicateComparisonExpander
- **Files modified:** components/suggestions/DuplicateComparisonExpander.tsx
- **Commit:** d010e43

## Known Stubs

None — all components receive data via props; no hardcoded mock data in rendered output.

## Threat Surface Scan

No new network endpoints. `DuplicateComparisonExpander` calls `projectOntologyApi.getClassDetail` which uses the existing Authorization header pattern — T-16-08 mitigation confirmed. `ShardReviewMarker` textarea enforces `maxLength={500}` and renders as React text nodes — T-16-07 mitigation confirmed.

## Self-Check

Files exist:
- `components/suggestions/SimilarEntitiesInlinePanel.tsx` — created (contains `export function SimilarEntitiesInlinePanel`, threshold filter, `aria-expanded`, `aria-controls`, `DuplicateComparisonExpander`, `scoreColor`)
- `components/suggestions/DuplicateComparisonExpander.tsx` — created (contains `export function DuplicateComparisonExpander`, `projectOntologyApi.getClassDetail`, `role="region"`, `grid grid-cols-2`, `animate-pulse`, `line-clamp-3`, `max-h-[400px]`)
- `components/suggestions/ShardReviewMarker.tsx` — created (contains `export function ShardReviewMarker`, `export type ShardMarkStatus`, `export interface ShardMark`, `Approve shard`, `Reject shard`, `Shard approved`, `Shard rejected`, `What should the submitter change about this shard?`, `maxLength={500}`, `role="status"`, `aria-live="polite"`, `CheckCircle`, `XCircle`)
- `__tests__/components/suggestions/SimilarEntitiesInlinePanel.test.tsx` — created (5 tests, all passing)
- `__tests__/components/suggestions/ShardReviewMarker.test.tsx` — created (8 tests, all passing)

Commits exist:
- `d010e43` — Task 1: SimilarEntitiesInlinePanel + DuplicateComparisonExpander
- `3871635` — Task 2: ShardReviewMarker

## Self-Check: PASSED
