---
phase: 15-session-clustering-batch-submit
fixed_at: 2026-04-07T18:55:00Z
review_path: .planning/phases/15-session-clustering-batch-submit/15-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-04-07T18:55:00Z
**Source review:** .planning/phases/15-session-clustering-batch-submit/15-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Entity drag-and-drop is non-functional -- no shard-level drop targets

**Files modified:** `components/suggestions/ShardPreviewShardRow.tsx`, `lib/hooks/useShardDragDrop.ts`
**Commit:** 717892a
**Applied fix:** Added `useDroppable` registration to `ShardPreviewShardRow` with `id: shard.id` and `data: { type: "shard" }`, applied `setDropRef` to the outer container div with visual drop-over indicator (`ring-2 ring-inset ring-primary-500`), and renamed the draggable ref to `setDragRef` to avoid collision. In `useShardDragDrop.ts`, added `over.data.current.type` validation so entities can only be dropped on `"shard"` targets and shards can only be dropped on `"pr-group"` targets.

### CR-02: Retry-failed flow overwrites original successful results

**Files modified:** `components/suggestions/ShardPreviewModal.tsx`
**Commit:** 6cf8d58
**Applied fix:** Replaced `setSubmitResponse(response)` in `handleRetryFailed` with a merge strategy that keeps original successful results and replaces only failed entries with retry results. The merged results preserve the original `pr_group_index` values so subsequent retries reference the correct PR groups. The `succeeded`/`failed` counts are recomputed from the merged results.

### WR-01: Submit error leaves user stuck on progress screen with no actions

**Files modified:** `components/suggestions/ShardPreviewModal.tsx`
**Commit:** b8325e5
**Applied fix:** Changed the `handleSubmit` catch block to transition back to `setPhase("preview")` instead of showing all progress steps as error. This returns the user to the preview phase where they can retry submission or close the modal, rather than being stuck on the progress screen with no actionable buttons.

### WR-02: ShardPreviewSummaryBar never re-renders after store mutations

**Files modified:** `components/suggestions/ShardPreviewSummaryBar.tsx`
**Commit:** 2e08ab6
**Applied fix:** Replaced the `useShardPreviewStore((s) => s.getSummary)` selector (which returns a stable function reference that never triggers re-renders) with two direct data selectors for `shards` and `prGroups`. The summary values (`totalSuggestions`, `totalShards`, `totalPrs`) are now computed inline from these reactive data references, ensuring the component re-renders whenever store mutations change the underlying data.

### WR-03: Empty shards can be submitted in batch request after split/move-all

**Files modified:** `components/suggestions/ShardPreviewModal.tsx`
**Commit:** d07c79e
**Applied fix:** Added `.filter((shard) => shard && shard.entityIris.length > 0)` to both the `handleSubmit` request builder and the `handleRetryFailed` retry request builder. This filters out empty shards (which can result from split or move-all operations) before sending to the backend, preventing empty commits or server errors.

## Skipped Issues

None -- all in-scope findings were fixed.

---

_Fixed: 2026-04-07T18:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
