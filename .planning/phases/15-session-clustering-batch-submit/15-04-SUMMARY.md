---
phase: 15-session-clustering-batch-submit
plan: 4
subsystem: editor-page-integration
tags: [react, next-dynamic, zustand, typescript, clustering, batch-submit]
dependency_graph:
  requires: [15-01, 15-02, 15-03]
  provides: [editor-clustering-gate, ShardPreviewModal-integration]
  affects: []
tech_stack:
  added: []
  patterns: [next-dynamic-ssr-false, clustering-gate-pattern, fallback-to-dialog]
key_files:
  created: []
  modified:
    - app/projects/[id]/editor/page.tsx
decisions:
  - "Clustering gate uses changesCount (session-level) not accepted suggestion count from store — changesCount is the authoritative measure of how many edits the suggester made; store suggestions are ephemeral UI state"
  - "Fallback to SuggestionSubmitDialog on cluster API error ensures user is never stuck — no suggestion session is orphaned"
  - "skip_clustering server flag respected — backend can override the frontend threshold if session is actually small after deduplication"
  - "ShardPreviewModal dynamically imported with ssr: false — modal uses DnD-kit sensors and window APIs that require a browser environment"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-08T00:16:29Z"
  tasks_completed: 1
  files_changed: 1
requirements:
  - CLUSTER-01
  - CLUSTER-03
  - CLUSTER-06
  - CLUSTER-07
  - CLUSTER-08
  - CLUSTER-09
---

# Phase 15 Plan 04: Editor Clustering Gate Integration Summary

**One-liner:** Clustering gate wired into editor Submit Suggestions button — sessions with >5 changes route through `suggestionsApi.cluster()` + `ShardPreviewModal`; sessions with <=5 changes use the existing `SuggestionSubmitDialog`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire clustering gate and ShardPreviewModal into editor submit flow | 28dcf9c | app/projects/[id]/editor/page.tsx |

## What Was Built

### app/projects/[id]/editor/page.tsx

Six coordinated changes to close the Phase 15 integration loop:

**Dynamic import:** `ShardPreviewModal` loaded via `next/dynamic` with `ssr: false` — avoids SSR issues from DnD-kit sensors and window-dependent modal APIs.

**Constant:** `SMALL_SESSION_THRESHOLD = 5` — single source of truth for the small/large session boundary.

**State:** Three new state variables:
- `shardPreviewOpen: boolean` — controls ShardPreviewModal visibility
- `clusterResponse: ClusterResponse | null` — holds the pre-fetched cluster plan passed to the modal
- `isClusterLoading: boolean` — drives the spinner on the submit button during the cluster API call

**`handleSubmitClick` callback:** The clustering gate. Called by the Submit Suggestions button:
1. If `changesCount <= SMALL_SESSION_THRESHOLD` → opens existing `SuggestionSubmitDialog` directly (no API call)
2. If `changesCount > SMALL_SESSION_THRESHOLD` → calls `suggestionsApi.cluster()` with a snapshot of accepted suggestions from the `useSuggestionStore`
3. If server returns `skip_clustering: true` → falls back to `SuggestionSubmitDialog`
4. If cluster API errors → logs toast + falls back to `SuggestionSubmitDialog` (user never stuck)
5. On success → sets `clusterResponse` + opens `ShardPreviewModal`

**`handleBatchSubmitted` callback:** Called by `ShardPreviewModal.onBatchSubmitted` after PRs are created:
- Shows success toast with PR count
- Calls `useSuggestionStore.getState().clearAllSuggestions()` to wipe ephemeral suggestion store
- Closes modal and clears `clusterResponse`

**Submit button update:** `onClick` changed from `() => setSubmitDialogOpen(true)` to `handleSubmitClick`. Added `disabled={isClusterLoading}` and a conditional `Loader2` spinner (replaces `Lightbulb` icon during cluster API call).

**ShardPreviewModal JSX:** Rendered conditionally when `shardPreviewOpen && clusterResponse && sessionId && accessToken`. All five required props wired: `projectId`, `sessionId`, `accessToken`, `clusterResponse`, `onBatchSubmitted`, `onClose`.

## Deviations from Plan

None. Plan executed exactly as written.

## Known Stubs

None. All connections are live:
- `suggestionsApi.cluster()` — real API call (endpoint may not exist on backend yet, but frontend wiring is complete)
- `useSuggestionStore.getState().clearAllSuggestions()` — live store mutation
- `ShardPreviewModal` — fully implemented (Plan 03), not a stub

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model:
- T-15-06 (suggestion snapshot tampering): Snapshot taken at click time from Zustand store; immutable after capture.
- T-15-07 (accessToken in modal props): Same pattern as existing `SuggestionSubmitDialog` — token already in editor scope, used only for authenticated API calls.

## Self-Check: PASSED

- app/projects/[id]/editor/page.tsx: FOUND (contains all required patterns)
- Commit 28dcf9c: FOUND (feat(15-04): wire ShardPreviewModal clustering gate into editor submit flow)
- `SMALL_SESSION_THRESHOLD`: present
- `dynamic(` import for ShardPreviewModal with `ssr: false`: present
- `handleSubmitClick` callback: present
- `suggestionsApi.cluster(`: present
- `useSuggestionStore.getState().suggestions`: present
- `skip_clustering`: present
- `setShardPreviewOpen(true)`: present
- `setSubmitDialogOpen(true)` as fallback: present (both small-session and error paths)
- `<ShardPreviewModal` JSX: present with all props
- `handleBatchSubmitted` + `clearAllSuggestions`: present
- `isClusterLoading` state: present
- `disabled={isClusterLoading}` on submit button: present
- `npm run type-check`: PASSES (0 errors)
- `npm run test -- --run`: 140 passed, 8 skipped, 0 failed
