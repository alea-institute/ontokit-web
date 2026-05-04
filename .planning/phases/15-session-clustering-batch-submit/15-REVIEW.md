---
phase: 15-session-clustering-batch-submit
reviewed: 2026-04-07T18:42:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - __tests__/lib/api/clusterApi.test.ts
  - __tests__/lib/hooks/useShardDragDrop.test.ts
  - __tests__/lib/stores/shardPreviewStore.test.ts
  - app/projects/[id]/editor/page.tsx
  - components/suggestions/ShardPreviewEntityList.tsx
  - components/suggestions/ShardPreviewModal.tsx
  - components/suggestions/ShardPreviewPRGroup.tsx
  - components/suggestions/ShardPreviewShardRow.tsx
  - components/suggestions/ShardPreviewSummaryBar.tsx
  - components/suggestions/ShardSubmitComplete.tsx
  - components/suggestions/ShardSubmitProgressBar.tsx
  - lib/api/suggestions.ts
  - lib/hooks/useShardDragDrop.ts
  - lib/stores/shardPreviewStore.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-07T18:42:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 15 introduces session clustering and batch submit for large suggestion sessions. The code is well-structured: the Zustand store enforces atomic mutations, the API types are thorough, and the component hierarchy is clean. Tests cover the store mutations and API calls well.

However, two critical issues were found: (1) entity drag-and-drop is broken because shard rows are not registered as droppable targets, and (2) the retry-failed flow corrupts result data by replacing original results with retry-only results. Three warnings address a stuck UI state on submit error, a stale summary bar due to Zustand selector semantics, and empty shards being submitted to the server.

## Critical Issues

### CR-01: Entity drag-and-drop is non-functional -- no shard-level drop targets

**File:** `components/suggestions/ShardPreviewShardRow.tsx` (entire file) / `components/suggestions/ShardPreviewPRGroup.tsx:33-35`
**Issue:** `ShardPreviewShardRow` uses `useDraggable` for shard-level dragging but does NOT register as a `useDroppable` target. The only droppable targets in the DnD context are PR groups (`ShardPreviewPRGroup` line 33). When a user drags an entity between shards, the `handleDragEnd` handler in `useShardDragDrop.ts` (line 45) interprets `over.id` as a shard ID and passes it to `moveEntity(entityIri, fromShardId, toShardId)`. But `over.id` will be the PR group ID (e.g., `"pr-1"`), not a shard ID (e.g., `"shard-2"`). The store's `moveEntity` will fail the guard check (`!toShard` on line 162 of shardPreviewStore.ts) and silently return unchanged state. Entity drag-and-drop appears to work visually (drag animation) but has no effect.

The keyboard fallback ("Move to..." dropdown in `ShardPreviewEntityList`) works correctly since it calls `moveEntity` with the proper shard ID.

**Fix:** Register each `ShardPreviewShardRow` as a droppable target using `useDroppable`:

```tsx
// In ShardPreviewShardRow.tsx, add:
import { useDraggable, useDroppable } from "@dnd-kit/core";

// Inside the component, add a droppable registration:
const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
  id: shard.id,
  data: { type: "shard" },
});

// Combine refs or apply setDropRef to the shard body container
```

Additionally, `handleDragEnd` in `useShardDragDrop.ts` should validate the `over.data.current.type` to ensure entities are only dropped on `"shard"` targets and shards are only dropped on `"pr-group"` targets.

### CR-02: Retry-failed flow overwrites original successful results

**File:** `components/suggestions/ShardPreviewModal.tsx:163-217`
**Issue:** When `handleRetryFailed` succeeds, line 210 replaces the entire `submitResponse` with only the retry response: `setSubmitResponse(response)`. This discards the results from the original successful PRs. The `ShardSubmitComplete` screen then shows only the retried results, and `handleDone` passes only those results to `onBatchSubmitted`, causing the editor page to miss the originally-succeeded PRs.

Additionally, `pr_group_index` values in the retry response are relative to the retry request (0-indexed into the failed subset), not the original request. If the user attempts a second retry from the retry results, the index mapping against `prGroupOrder` will reference the wrong PR groups.

**Fix:** Merge retry results with original results instead of replacing:

```tsx
const handleRetryFailed = useCallback(async () => {
  if (!submitResponse) return;
  // ... (existing retry logic) ...

  try {
    const response = await suggestionsApi.batchSubmit(/* ... */);

    // Merge: keep original successes, replace failed entries with retry results
    const mergedResults = submitResponse.results.map((original) => {
      if (original.status === "success") return original;
      // Find the corresponding retry result
      const retryIdx = failedPrIds.indexOf(prGroupOrder[original.pr_group_index]);
      if (retryIdx >= 0 && response.results[retryIdx]) {
        return { ...response.results[retryIdx], pr_group_index: original.pr_group_index };
      }
      return original;
    });

    setSubmitResponse({
      results: mergedResults,
      succeeded: mergedResults.filter((r) => r.status === "success").length,
      failed: mergedResults.filter((r) => r.status === "failed").length,
    });
    setPhase("complete");
  } catch { /* ... */ }
}, [/* ... */]);
```

## Warnings

### WR-01: Submit error leaves user stuck on progress screen with no actions

**File:** `components/suggestions/ShardPreviewModal.tsx:144-158`
**Issue:** When `batchSubmit` throws an exception (line 153), all progress steps are set to error status, but `phase` remains `"submitting"`. The only escape is the X close button in the header. There is no "Back" or "Retry" button, and Escape key is disabled during the submitting phase. This is a degraded UX that may confuse users.

**Fix:** Either transition to a dedicated error phase, or add a "Back to preview" / "Retry" button when all steps are in error state:

```tsx
} catch {
  setProgressSteps((prev) =>
    prev.map((step) => ({ ...step, status: "error" as const })),
  );
  // Allow user to go back and retry
  setPhase("preview");
}
```

Or keep `phase === "submitting"` but render action buttons when all steps are in error.

### WR-02: ShardPreviewSummaryBar never re-renders after store mutations

**File:** `components/suggestions/ShardPreviewSummaryBar.tsx:11-12`
**Issue:** The component subscribes to the store with `(s) => s.getSummary`, which returns a stable function reference. Since the function itself never changes (it is defined once in the store factory), the Zustand equality check never triggers a re-render. After any mutation (move entity, merge shards, split, etc.), the summary bar continues to display the counts from the initial render.

**Fix:** Subscribe to the underlying data instead of the derived function:

```tsx
export function ShardPreviewSummaryBar() {
  const shards = useShardPreviewStore((s) => s.shards);
  const prGroups = useShardPreviewStore((s) => s.prGroups);

  const totalSuggestions = Object.values(shards).reduce(
    (sum, shard) => sum + shard.entityIris.length, 0,
  );
  const totalShards = Object.keys(shards).length;
  const totalPrs = Object.keys(prGroups).length;

  // ... render ...
}
```

### WR-03: Empty shards can be submitted in batch request after split/move-all

**File:** `lib/stores/shardPreviewStore.ts:230-273` / `components/suggestions/ShardPreviewModal.tsx:127-142`
**Issue:** `splitShard` does not guard against splitting ALL entities out of a shard, which leaves the original shard with zero `entityIris`. Similarly, `moveEntity` can drain a shard of all entities one by one. The batch submit handler (ShardPreviewModal line 128) iterates all shards without filtering empty ones, sending empty shards to the backend. This could cause the server to create empty commits or error on empty PRs.

**Fix:** Either prevent empty shards in the store mutations, or filter them out at submit time:

```tsx
// Option A: Guard in splitShard
if (entityIris.length >= originalShard.entityIris.length) return state; // don't allow full-drain split

// Option B: Filter at submit time (ShardPreviewModal.handleSubmit)
shards: prGroup.shardIds
  .map((shardId) => shards[shardId])
  .filter((shard) => shard.entityIris.length > 0)
  .map((shard) => ({ id: shard.id, label: shard.label, entity_iris: shard.entityIris })),
```

## Info

### IN-01: React key uses array index in ShardSubmitComplete result list

**File:** `components/suggestions/ShardSubmitComplete.tsx:63`
**Issue:** `key={index}` is used for the result list items. While the list is static and not reordered (making this functionally correct), using `pr_group_index` would be more semantically appropriate.

**Fix:**
```tsx
key={result.pr_group_index}
```

### IN-02: Unused local split state in ShardPreviewEntityList

**File:** `components/suggestions/ShardPreviewEntityList.tsx:148-149`
**Issue:** `localSplitSelected` state and its setter are defined but only used as a fallback when `onSplitToggle` is not provided. In practice, the `ShardPreviewShardRow` always passes `onSplitToggle` via `React.cloneElement` when `isSplitting` is true, making the local state unreachable. This is dead code that increases cognitive overhead.

**Fix:** Remove the local fallback state and simplify `handleToggle` to just call `onSplitToggle`:

```tsx
function handleToggle(iri: string) {
  onSplitToggle?.(iri);
}
```

---

_Reviewed: 2026-04-07T18:42:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
