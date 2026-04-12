---
phase: 15-session-clustering-batch-submit
plan: 3
subsystem: ui-modal
tags: [react, zustand, dnd-kit, typescript, accessibility, dark-mode, tdd]
dependency_graph:
  requires: [15-01, 15-02]
  provides: [ShardPreviewModal, useShardDragDrop]
  affects: [15-04]
tech_stack:
  added: []
  patterns: [tdd-renderHook-vitest, dnd-kit-sensor-hook-extraction, three-phase-modal-state-machine]
key_files:
  created:
    - lib/hooks/useShardDragDrop.ts
    - components/suggestions/ShardPreviewModal.tsx
    - __tests__/lib/hooks/useShardDragDrop.test.ts (unskipped + fully implemented)
  modified: []
decisions:
  - "useShardDragDrop tested via renderHook (not direct call) — React hooks require a React environment; renderHook from @testing-library/react is the correct vitest pattern for unit-testing hooks"
  - "ShardPreviewModal passes siblingShardIds (same PR group only) to ShardPreviewShardRow.allShardIds — merge submenu should only offer shards within the same PR group, not cross-PR shards"
  - "Escape key only closes modal in preview phase — during submitting phase it is suppressed to prevent accidental dismissal while PRs are being created"
  - "BatchSubmitRequest built entirely from store state (not re-parsed from clusterResponse) — post-adjustment store state is the source of truth for what gets submitted; T-15-04 mitigated"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-08T00:12:47Z"
  tasks_completed: 2
  files_changed: 3
requirements:
  - CLUSTER-01
  - CLUSTER-05
  - CLUSTER-06
  - CLUSTER-07
---

# Phase 15 Plan 03: ShardPreviewModal + useShardDragDrop Summary

**One-liner:** DnD hook (`useShardDragDrop`) with sensor config and store dispatch, plus the three-phase full-screen modal orchestrator (`ShardPreviewModal`) that composes all Plan 02 sub-components with preview, submitting, and complete phases.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create useShardDragDrop hook (TDD) | 8b59c58 | lib/hooks/useShardDragDrop.ts, __tests__/lib/hooks/useShardDragDrop.test.ts |
| 2 | Create ShardPreviewModal three-phase orchestrator | 98aa047 | components/suggestions/ShardPreviewModal.tsx |

## What Was Built

### lib/hooks/useShardDragDrop.ts

DnD sensor configuration and drag-end dispatch hook:
- `PointerSensor` with `activationConstraint: { distance: 8 }` — matches `DraggableTreeWrapper` pattern exactly
- `KeyboardSensor` for accessibility
- `handleDragEnd`: dispatches `moveEntity(entityIri, fromShardId, toShardId)` for `type === "entity"`, and `moveShard(shardId, fromPrId, toPrId)` for `type === "shard"`
- No-op guards: returns early when `over === null` (dropped outside target) or source === target (same shard/PR group)
- Returns `{ sensors, handleDragEnd }` for direct use in a `DndContext`

### components/suggestions/ShardPreviewModal.tsx

Full-screen modal orchestrator with three internal phases managed by `useState<ModalPhase>`:

**Phase A (preview):** `ShardPreviewSummaryBar` + scrollable `DndContext` wrapping `ShardPreviewPRGroup` → `ShardPreviewShardRow` → `ShardPreviewEntityList` tree. Footer has notes textarea, Cancel, and Submit buttons. Escape key closes.

**Phase B (submitting):** `ShardSubmitProgressBar` with steps: one header step + one step per PR group. Footer is hidden. Escape key is suppressed to prevent accidental close.

**Phase C (complete):** `ShardSubmitComplete` component with PR links, failed-PR error rows, `Retry failed` and `Done` buttons.

Key behaviors:
- Store hydrated from `clusterResponse` prop on mount via `setFromClusterResponse`
- `BatchSubmitRequest` built from current store state (post-user-adjustments) — not from the original `clusterResponse` object
- `handleRetryFailed` builds a request containing only the PR groups whose index appears in `failed` results
- `handleDone` calls `clear()` → `onBatchSubmitted(results)` → `onClose()` in sequence
- `prIndexMap` derived value maps `prGroupId → 1-based display index` for `ShardPreviewShardRow`
- `allShardIds` passed to `ShardPreviewEntityList` excludes the current shard (for "Move to..." dropdown)
- `allShardIds` passed to `ShardPreviewShardRow` is `siblingShardIds` within same PR group (for merge submenu)
- Full dark mode throughout, `animate-in fade-in zoom-in-95 duration-150 ease-out` open animation

### __tests__/lib/hooks/useShardDragDrop.test.ts

5 tests via `renderHook`:
1. Entity drag to different shard → calls `moveEntity`
2. Shard drag to different PR group → calls `moveShard`
3. Drop on null target → no-op
4. Entity dropped on same source shard → no-op
5. Shard dropped on same PR group → no-op

## Verification

- `npm run type-check`: PASSES (clean, no errors)
- `npm run test -- --run`: 140 passed, 8 skipped (pre-existing), 0 failed
- `npm run test -- --run __tests__/lib/hooks/useShardDragDrop.test.ts`: 5/5 pass
- All 3 files exist
- `ShardPreviewModal.tsx`: 349 lines (exceeds 100-line minimum)
- Zero `it.skip` calls in useShardDragDrop.test.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `renderHook` instead of direct hook call in tests**
- **Found during:** Task 1 (TDD GREEN phase) — direct `useShardDragDrop()` call failed with `Cannot read properties of null (reading 'useCallback')` because React hooks need a React context
- **Fix:** Wrapped each test in `renderHook(() => useShardDragDrop())` from `@testing-library/react`, which was already installed (`node_modules/@testing-library/react` present)
- **Files modified:** `__tests__/lib/hooks/useShardDragDrop.test.ts`
- **Commit:** 8b59c58

**2. [Rule 2 - Missing prop] Added `prIndexMap` to `ShardPreviewShardRow` invocation**
- **Found during:** Task 2 — `ShardPreviewShardRow` has a `prIndexMap: Record<string, number>` prop (implemented in Plan 02) that wasn't in the plan's interface summary
- **Fix:** Computed `prIndexMap` as a `useMemo`-derived value (`prGroupOrder.map((id, idx) => [id, idx + 1])`) and passed it to each `ShardPreviewShardRow`
- **Files modified:** `components/suggestions/ShardPreviewModal.tsx`
- **Commit:** 98aa047

## Known Stubs

None. Both components are fully implemented:
- `useShardDragDrop`: live `moveEntity`/`moveShard` store dispatch — no stubs
- `ShardPreviewModal`: live `suggestionsApi.batchSubmit` call, live store hydration, all three phases rendered — no stubs

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-15-04 mitigated | components/suggestions/ShardPreviewModal.tsx | `BatchSubmitRequest` built exclusively from store state hydrated by `ClusterResponse`; user adjustments (drag/merge/split) operate only on store data, cannot introduce foreign IRIs. Backend validates all IRIs belong to the session. |

## Self-Check: PASSED

- lib/hooks/useShardDragDrop.ts: FOUND
- components/suggestions/ShardPreviewModal.tsx: FOUND
- __tests__/lib/hooks/useShardDragDrop.test.ts: FOUND (5 tests, 0 it.skip)
- Commit 8b59c58: FOUND (feat(15-03): create useShardDragDrop hook with DnD sensor config and dispatch)
- Commit 98aa047: FOUND (feat(15-03): create ShardPreviewModal — three-phase full-screen orchestrator)
- npm run type-check: PASSES
- npm run test -- --run: 140 passed
