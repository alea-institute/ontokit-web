---
phase: 16-reviewer-enhancements
plan: "04"
subsystem: suggestions-review
tags: [integration, review-page, provenance, shards, tdd, notifications]
dependency_graph:
  requires:
    - lib/api/suggestions.ts::SessionDetailResponse (Plan 16-01)
    - lib/api/suggestions.ts::EntityReviewMetadata (Plan 16-01)
    - lib/api/suggestions.ts::ShardReviewMark (Plan 16-01)
    - lib/api/suggestions.ts::suggestionsApi.getSessionDetail (Plan 16-01)
    - lib/api/suggestions.ts::suggestionsApi.postShardReviews (Plan 16-01)
    - lib/api/suggestions.ts::suggestionsApi.createCleanPR (Plan 16-01)
    - components/suggestions/ProvenanceBadge.tsx (Plan 16-02)
    - components/suggestions/ShardTabNavigator.tsx (Plan 16-02)
    - components/suggestions/SimilarEntitiesInlinePanel.tsx (Plan 16-03)
    - components/suggestions/ShardReviewMarker.tsx (Plan 16-03)
  provides:
    - app/projects/[id]/suggestions/review/page.tsx::fully-integrated review page
    - lib/editor/entityLineAttribution.ts::attributeLinesToEntities
  affects:
    - REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04, REVIEW-05 (all requirements closed)
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN) for pure function — entityLineAttribution.ts
    - Promise.all for parallel diff + session detail fetch (Pitfall 1 avoidance)
    - Turtle subject-declaration state machine (Pitfall 2 avoidance)
    - Hunk-level shard filtering in DiffView (Pitfall 3 avoidance)
    - shardMarks NOT cleared on session switch (Pitfall 4 avoidance)
    - useMemo for entityMetadataMap, shardTabs, shardMarkStatuses
key_files:
  created:
    - lib/editor/entityLineAttribution.ts
    - __tests__/lib/editor/entityLineAttribution.test.ts
  modified:
    - app/projects/[id]/suggestions/review/page.tsx
decisions:
  - "attributeLinesToEntities uses IRI-match state machine; prefix match is best-effort (retains prior context)"
  - "DiffView extended with entityMetadataMap/activeShardId/sessionDetail/projectId/accessToken props"
  - "ProvenanceBadge rendered on every + line that has attribution metadata"
  - "SimilarEntitiesInlinePanel rendered per unique entity IRI appearing in file patch"
  - "ShardReviewMarker rendered below DiffView only when activeShardId is non-null"
  - "shardMarks cleared ONLY in finally blocks of handleApprove/handleReject/handleRequestChanges — NOT in handleSelectSession"
  - "Enriched session detail fetch gracefully falls back to null on error — diff still works without it"
  - "NOTIFICATIONS_CHANGED_EVENT dispatched after postShardReviews when any mark is rejected with feedback (D-12)"
  - "Create clean PR button conditional on at least one rejected shard mark existing (D-11)"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 3
requirements: [REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04, REVIEW-05]
---

# Phase 16 Plan 04: Review Page Integration Summary

**One-liner:** Full integration of Phase 16 components into the review page — provenance badges on diff lines via Turtle state-machine attribution, shard tab navigation with hunk-level filtering, per-entity duplicate panels, per-shard approve/reject marking with notification dispatch, and Create clean PR stretch button.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (TDD) | entity-to-line attribution pure function + review page state/data plumbing + all UI wiring | 66c8887 | lib/editor/entityLineAttribution.ts, __tests__/lib/editor/entityLineAttribution.test.ts, app/projects/[id]/suggestions/review/page.tsx |
| 2 | UI components wired into DiffView, action handlers, notification dispatch | 66c8887 | (integrated with Task 1) |

## What Was Built

### entityLineAttribution.ts (new pure function)

Implements the Turtle subject-declaration state machine from RESEARCH.md Pitfall 2:
- Full IRI match (`+ <http://...>`) transitions current entity context, looks up `EntityReviewMetadata` from map
- Prefix match (`+ prefix:Name a owl:`) is best-effort — retains prior context (no prefix expansion)
- Continuation lines (`;` lines) inherit current entity context
- Context lines, hunk headers (`@@`), deletion lines, `+++` headers all return null attribution
- Exported as `attributeLinesToEntities(lines, entityMetadataMap)` returning `LineAttribution[]`

### Review Page (comprehensive integration)

**New imports:** `useMemo`, `Scissors`, `SessionDetailResponse`, `EntityReviewMetadata`, `ShardReviewMark`, `ProvenanceBadge`, `ShardTabNavigator`, `ShardTabInfo`, `SimilarEntitiesInlinePanel`, `ShardReviewMarker`, `ShardMark`, `attributeLinesToEntities`

**New state:**
- `sessionDetail: SessionDetailResponse | null` — enriched entity/shard metadata
- `isDetailLoading: boolean` — loading flag for enriched detail
- `activeShardId: string | null` — currently selected shard tab (null = "All")
- `shardMarks: Record<string, ShardMark>` — buffered per-shard review decisions

**Diff fetch:** Converted single `pullRequestsApi.getDiff()` to `Promise.all([diffPromise, detailPromise])` — enriched detail fetched alongside the diff to avoid race condition (Pitfall 1).

**Session selection:** `handleSelectSession` resets `sessionDetail` and `activeShardId` but intentionally preserves `shardMarks` (RESEARCH.md Pitfall 4 — marks survive session inspection).

**Computed values (useMemo):**
- `entityMetadataMap: Map<string, EntityReviewMetadata>` — O(1) IRI lookup
- `shardTabs: ShardTabInfo[]` — tab data for ShardTabNavigator
- `shardMarkStatuses: Record<string, "approved" | "rejected">` — dot indicators for tab navigator

**DiffView extension:**
- New props: `entityMetadataMap`, `activeShardId`, `sessionDetail`, `projectId`, `accessToken`
- Pre-computes `attributeLinesToEntities(patchLines, entityMetadataMap)` per file
- Hunk-level shard filter: skips `+` lines whose entity IRI is not in `activeShardIris` (Pitfall 3)
- Renders `ProvenanceBadge` on every `+` line with attribution metadata (flex row, badge at right)
- Tracks `entitiesInPatch` set, renders `SimilarEntitiesInlinePanel` per entity with duplicate candidates

**Files tab layout:**
- `ShardTabNavigator` above the diff when `shardTabs.length > 0`
- `DiffView` with all new props
- `ShardReviewMarker` below DiffView when `activeShardId` is non-null + sessionDetail loaded

**Action handlers (all three — approve, reject, requestChanges):**
- Send `postShardReviews` before main action when `shardMarks` is non-empty
- `postShardReviews` failure is non-blocking (catch → no-op) per D-10
- Dispatch `NOTIFICATIONS_CHANGED_EVENT` when any rejected shard has feedback (D-12)
- Clear `shardMarks` only in `finally` block (not on session deselect)
- Reset `sessionDetail` on session clear after action

**Create clean PR button (D-11 stretch goal):**
- Appears only when at least one shard mark is "rejected"
- Disabled when no approved shard IDs exist
- Calls `suggestionsApi.createCleanPR` with `approved_shard_ids`
- Dispatches `NOTIFICATIONS_CHANGED_EVENT` on success
- Clears `shardMarks` and `sessionDetail` after success

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| entityLineAttribution.test.ts | 5 | PASS |
| Full suite (all plans) | 183 + 8 skipped | PASS |
| TypeScript | — | 0 errors |

## Deviations from Plan

### Consolidation of Task 1 and Task 2

**Found during:** Task 2 start
**Situation:** The plan split implementation into Task 1 (pure function + state plumbing) and Task 2 (UI component wiring). In practice, the UI wiring was implemented alongside the state plumbing in the same pass through the file — separating them would have required reading and modifying the same JSX section twice.
**Resolution:** All work committed in a single comprehensive commit (66c8887) covering both tasks. TypeScript clean and full suite green confirm correctness.

This is a scheduling deviation, not a quality deviation — all plan requirements are fully implemented.

## Known Stubs

None. All Phase 16 components receive real data via props. The enriched session detail API gracefully falls back to empty maps when the backend endpoint is not yet implemented — in that case, provenance badges and shard tabs simply don't render (empty-state handling built in). No hardcoded data, no TODO/FIXME markers.

## Threat Surface Scan

No new network endpoints introduced. The three new API calls (`getSessionDetail`, `postShardReviews`, `createCleanPR`) were already defined and authorized in Plan 16-01. All calls include `Authorization: Bearer {token}` headers. Threat mitigations T-16-10 through T-16-15 are satisfied per the existing API client pattern.

## Self-Check

Files exist:
- `lib/editor/entityLineAttribution.ts` — created (contains `export function attributeLinesToEntities`, `export interface LineAttribution`, state machine with IRI match + prefix match)
- `__tests__/lib/editor/entityLineAttribution.test.ts` — created (5 tests, all passing)
- `app/projects/[id]/suggestions/review/page.tsx` — modified (contains `import.*ProvenanceBadge`, `import.*ShardTabNavigator`, `import.*SimilarEntitiesInlinePanel`, `import.*ShardReviewMarker`, `import.*attributeLinesToEntities`, `sessionDetail`, `shardMarks`, `entityMetadataMap`, `shardTabs`, `ShardTabNavigator`, `ShardReviewMarker`, `postShardReviews`, `NOTIFICATIONS_CHANGED_EVENT`, `createCleanPR`, `Scissors`)

Commits exist:
- `66c8887` — feat(16-04): entity-to-line attribution function + review page data plumbing

## Self-Check: PASSED
