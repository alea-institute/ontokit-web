---
phase: 15-session-clustering-batch-submit
verified: 2026-04-08T03:45:00Z
status: gaps_found
score: 4/5
overrides_applied: 0
gaps:
  - truth: "The preview tree lets the user merge two shards, split a shard, or rename a shard label before submitting"
    status: partial
    reason: "Merge and split are fully implemented. Rename shard label is missing -- no renameShard action in the store, no rename UI in the shard row context menu. CLUSTER-06 and ROADMAP SC #2 both specify rename as a required capability."
    artifacts:
      - path: "lib/stores/shardPreviewStore.ts"
        issue: "No renameShard mutation — store has moveEntity, mergeShards, splitShard, moveShard but no renameShard"
      - path: "components/suggestions/ShardPreviewShardRow.tsx"
        issue: "Context menu has 'Merge into...', 'Split shard', 'Move to PR...' but no 'Rename' option"
    missing:
      - "Add renameShard(shardId, newLabel) mutation to shardPreviewStore"
      - "Add 'Rename' menu item in ShardPreviewShardRow context menu with inline text input"
human_verification:
  - test: "Open editor in suggestion mode with >5 accepted suggestions, click Submit Suggestions, verify the shard preview modal opens"
    expected: "Cluster API is called, modal appears with PR groups and shards organized by ancestor"
    why_human: "Requires running backend with cluster endpoint implemented — cannot test frontend wiring without live API"
  - test: "In the shard preview modal, drag an entity from one shard to another"
    expected: "Entity moves to the target shard, counts update in the summary bar"
    why_human: "DnD interaction requires a live browser session with drag events"
  - test: "Click Submit in the modal, verify progress bar and completion screen"
    expected: "Progress steps animate, completion screen shows PR links or error retry"
    why_human: "Requires live batch-submit API endpoint"
  - test: "Verify dark mode appearance of all shard preview components"
    expected: "All backgrounds, text, badges, and borders have proper dark mode variants"
    why_human: "Visual appearance verification — grep confirms dark: classes exist but cannot verify they look correct"
---

# Phase 15: Session Clustering & Batch Submit Verification Report

**Phase Goal:** At submit time, the system automatically groups a user's accumulated suggestions into ancestor-based PR shards, the user can review and adjust the proposed groupings, and each approved shard becomes a single trackable PR
**Verified:** 2026-04-08T03:45:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking "Submit session" triggers automatic clustering and shows the user a shard preview tree | VERIFIED | `page.tsx:695` `handleSubmitClick` calls `suggestionsApi.cluster()` when `changesCount > SMALL_SESSION_THRESHOLD (5)`, sets `clusterResponse`, opens `ShardPreviewModal`. Modal hydrates store via `setFromClusterResponse` and renders nested PR group/shard/entity tree. |
| 2 | The preview tree lets the user merge two shards, split a shard, or rename a shard label before submitting | PARTIAL | Merge: `ShardPreviewShardRow.tsx:195` onSelect calls `mergeShards`. Split: `ShardPreviewShardRow.tsx:208-215` activates split mode with checkbox selection and `splitShard` call. **Rename: MISSING** -- no `renameShard` mutation in store, no rename menu item in context menu. |
| 3 | A shard with fewer than 3 suggestions is automatically rolled into a "Miscellaneous improvements" shard | VERIFIED | Frontend correctly preserves `isMisc` flag from backend `ClusterResponse`. `ShardPreviewShardRow.tsx:143` renders amber "Miscellaneous improvements" badge. Test at `shardPreviewStore.test.ts:101` verifies non-misc shards have >= 3 entities. Backend enforcement is the authority; frontend displays the result. |
| 4 | Each shard becomes exactly one commit; shards grouped into PRs by subtree branch, splitting when exceeding limits; suggestion never in more than one commit | VERIFIED | `ShardPreviewModal.tsx:129-143` builds `BatchSubmitRequest` with one shard per commit unit. Store enforces CLUSTER-05 atomicity: `moveEntity` (line 158) uses single `set()` call to remove from source and add to target. Test at `shardPreviewStore.test.ts:174` verifies entity appears in exactly one shard post-move. PR group splitting is backend-determined. |
| 5 | GitHub's commit tab within each PR serves as the shard navigator; reviewer approves/rejects per-PR | VERIFIED | Each shard becomes one commit in the `BatchSubmitRequest`. This is a backend + GitHub affordance that the frontend correctly sets up. CLUSTER-09 is satisfied by the batch submit request structure. No additional frontend work required. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/stores/shardPreviewStore.ts` | Ephemeral Zustand store for mutable shard plan | VERIFIED | 368 lines, exports `useShardPreviewStore`, `ShardDefinition`, `PRGroupDefinition`. All mutations use single `set()` calls. No persist middleware. |
| `lib/api/suggestions.ts` | Extended with cluster() and batchSubmit() | VERIFIED | `ClusterRequest`, `ClusterResponse`, `BatchSubmitRequest`, `BatchSubmitResponse` types exported. `cluster()` POSTs to `/cluster`, `batchSubmit()` POSTs to `/batch-submit`. Both use `Authorization: Bearer` header. |
| `components/suggestions/ShardPreviewSummaryBar.tsx` | Summary bar component | VERIFIED | 45 lines, reads store via `useShardPreviewStore`, renders "N suggestions -> N shards -> N PRs" reactively. Dark mode variants present. |
| `components/suggestions/ShardPreviewPRGroup.tsx` | PR group collapsible component | VERIFIED | 92 lines, `useDroppable` drop target, `ChevronRight`/`ChevronDown` toggle, `aria-expanded`, expand/collapse state from store. |
| `components/suggestions/ShardPreviewShardRow.tsx` | Shard row with context menu | VERIFIED | 310 lines, `useDraggable` + `useDroppable`, Radix `DropdownMenu` with Merge into.../Split shard/Move to PR... items. Amber/violet badges for misc/cross-cutting. `aria-label` on all interactive elements. |
| `components/suggestions/ShardPreviewEntityList.tsx` | Entity list within shard | VERIFIED | 188 lines, per-entity `useDraggable`, `GripVertical` drag handle, `getLocalName()` display, "Move to..." dropdown fallback, split mode with checkboxes. |
| `components/suggestions/ShardSubmitProgressBar.tsx` | Multi-step progress indicator | VERIFIED | 80 lines, `role="status"` + `aria-live="polite"`, icons for idle/active/done/error states, `Loader2` spinner for active step. |
| `components/suggestions/ShardSubmitComplete.tsx` | Completion screen | VERIFIED | 120 lines, "Suggestions submitted" / partial failure heading, PR links with `target="_blank" rel="noopener noreferrer"`, "Retry failed" + "Done" buttons. |
| `components/suggestions/ShardPreviewModal.tsx` | Full-screen modal orchestrator | VERIFIED | 364 lines, three phases (preview/submitting/complete), `DndContext` with `useShardDragDrop`, `role="dialog" aria-modal="true"`, Escape key handler, notes textarea, Submit/Cancel buttons. |
| `lib/hooks/useShardDragDrop.ts` | DnD handler hook | VERIFIED | 64 lines, exports `useShardDragDrop`, `PointerSensor` with distance 8, `KeyboardSensor`, dispatches `moveEntity`/`moveShard` on drag end. |
| `app/projects/[id]/editor/page.tsx` | Editor page with clustering gate | VERIFIED | Dynamic import with `ssr: false`, `SMALL_SESSION_THRESHOLD = 5`, `handleSubmitClick` gates through clustering, `handleBatchSubmitted` clears suggestion store, `<ShardPreviewModal>` rendered conditionally. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ShardPreviewModal.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Line 7: import, Lines 70-74: store selectors for state/mutations |
| `ShardPreviewModal.tsx` | `suggestions.ts` | `suggestionsApi.batchSubmit()` | WIRED | Line 8: import, Line 146: `suggestionsApi.batchSubmit()` call |
| `ShardPreviewModal.tsx` | `useShardDragDrop.ts` | `useShardDragDrop()` | WIRED | Line 11: import, Line 93: hook call, sensors + handleDragEnd used in DndContext |
| `useShardDragDrop.ts` | `shardPreviewStore.ts` | `moveEntity` / `moveShard` | WIRED | Lines 27-28: store selectors, Lines 51, 57: dispatch calls |
| `ShardPreviewPRGroup.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Line 6: import, Lines 28-29: selectors for expandedPrIds and togglePrExpanded |
| `ShardPreviewShardRow.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Line 12: import, Lines 45-49: mergeShards, moveShard, splitShard selectors |
| `page.tsx` | `ShardPreviewModal.tsx` | Dynamic import + conditional render | WIRED | Lines 51-53: dynamic import, Lines 1444-1456: conditional render with all props |
| `page.tsx` | `suggestions.ts` | `suggestionsApi.cluster()` | WIRED | Line 45: import, Line 726: `suggestionsApi.cluster()` call |
| `page.tsx` | `suggestionStore.ts` | `clearAllSuggestions` on success | WIRED | Line 46: import, Line 755: `useSuggestionStore.getState().clearAllSuggestions()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ShardPreviewSummaryBar` | `shards`, `prGroups` | `useShardPreviewStore` selectors | Store hydrated from `ClusterResponse` via `setFromClusterResponse` | FLOWING (data comes from cluster API response) |
| `ShardPreviewPRGroup` | `expandedPrIds` | `useShardPreviewStore` | Computed on hydration, updated by toggle | FLOWING |
| `ShardPreviewModal` | `prGroups`, `shards`, `prGroupOrder` | `useShardPreviewStore` | Hydrated from `clusterResponse` prop on mount | FLOWING |
| `page.tsx` clustering gate | `clusterResponse` | `suggestionsApi.cluster()` API call | Live API call with accepted suggestions from `useSuggestionStore` | FLOWING (when backend exists) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests pass | `npm run test -- --run` | 140 passed, 8 skipped, 0 failed | PASS |
| Type-check passes | `npm run type-check` | Clean exit, no errors | PASS |
| Store exports correct types | `grep "export interface ShardDefinition\|export interface PRGroupDefinition\|export const useShardPreviewStore" lib/stores/shardPreviewStore.ts` | All three found | PASS |
| API exports cluster + batchSubmit | `grep "cluster:\|batchSubmit:" lib/api/suggestions.ts` | Both methods found at lines 343, 359 | PASS |
| No it.skip remaining in Phase 15 tests | `grep -r "it.skip" __tests__/lib/stores/shardPreviewStore.test.ts __tests__/lib/api/clusterApi.test.ts __tests__/lib/hooks/useShardDragDrop.test.ts` | 0 matches | PASS |
| Editor page wires clustering gate | `grep "SMALL_SESSION_THRESHOLD" app/projects/\[id\]/editor/page.tsx` | Found at line 56 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| CLUSTER-01 | 15-01, 15-03, 15-04 | System auto-clusters session suggestions by common class ancestor | SATISFIED | `handleSubmitClick` calls `suggestionsApi.cluster()`, store hydrated from response, modal renders tree |
| CLUSTER-02 | 15-01 | Shards max 50 items; split at next taxonomy level | SATISFIED (frontend) | Store preserves backend-computed sizes. Test verifies no shard exceeds 50. Backend enforcement is authoritative. |
| CLUSTER-03 | 15-01, 15-02 | Shards min 3 items; orphans roll into Miscellaneous | SATISFIED (frontend) | Test verifies non-misc >= 3. `ShardPreviewShardRow` renders amber "Miscellaneous improvements" badge for `isMisc` shards. |
| CLUSTER-04 | 15-01, 15-02 | Cross-cutting changes form their own shard | SATISFIED (frontend) | Store preserves `isCrossCutting` flag. `ShardPreviewShardRow` renders violet "Cross-cutting changes" badge. Test at line 123 verifies. |
| CLUSTER-05 | 15-01, 15-03 | Each suggestion in exactly one shard | SATISFIED | All store mutations use single `set()` call. `moveEntity` filters from source, adds to target atomically. Tests verify uniqueness. |
| CLUSTER-06 | 15-02, 15-03 | User sees preview tree; can merge/split/rename | PARTIAL | Merge and split implemented. **Rename missing.** No `renameShard` in store, no rename UI in context menu. |
| CLUSTER-07 | 15-01, 15-03, 15-04 | Each shard = one commit; grouped into PRs | SATISFIED | `BatchSubmitRequest` maps shards 1:1 to commits. `batchSubmit()` API sends grouped structure. |
| CLUSTER-08 | 15-01, 15-04 | PRs split at ~10 shards / ~50 suggestions | SATISFIED (frontend) | Backend determines split points. Frontend displays result. Test at line 265 verifies >10 shards produce multiple PR groups. |
| CLUSTER-09 | 15-02, 15-04 | Reviewer approves per-PR; GitHub commit tab = shard navigator | SATISFIED | One commit per shard in batch submit request. GitHub natively provides commit tab. No additional frontend needed. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TODO/FIXME/PLACEHOLDER/stub patterns found in any Phase 15 file | - | - |

### Human Verification Required

1. **Full-flow visual test with running backend**
   - **Test:** Open editor in suggestion mode with >5 accepted suggestions, click Submit Suggestions
   - **Expected:** Cluster API is called, shard preview modal opens with PR groups and shards
   - **Why human:** Requires running backend with cluster endpoint

2. **Drag-and-drop entity movement**
   - **Test:** In the shard preview modal, drag an entity from one shard to another
   - **Expected:** Entity moves, counts update in summary bar and shard badges
   - **Why human:** DnD interaction requires live browser with drag events

3. **Submit flow end-to-end**
   - **Test:** Click Submit in the modal, verify progress bar and completion screen
   - **Expected:** Progress steps animate, completion screen shows PR links or errors
   - **Why human:** Requires live batch-submit API endpoint

4. **Dark mode appearance**
   - **Test:** Toggle dark mode and verify all shard preview components
   - **Expected:** All backgrounds, text, badges, and borders render correctly in dark mode
   - **Why human:** Visual verification -- grep confirms `dark:` classes exist but cannot verify appearance

### Gaps Summary

One gap blocks full goal achievement:

**Shard rename capability is missing.** ROADMAP Success Criteria #2 specifies "merge two shards, split a shard, or rename a shard label." CLUSTER-06 in REQUIREMENTS.md also includes "rename." The implementation has merge and split fully wired, but rename was dropped during planning (no plan mentions it as an explicit task). The fix requires:

1. Adding a `renameShard(shardId: string, newLabel: string)` mutation to `shardPreviewStore.ts`
2. Adding a "Rename" menu item to the context menu in `ShardPreviewShardRow.tsx` (inline text input pattern)

This is a small, self-contained addition (estimated 20-30 lines across 2 files). The store already follows the single-`set()` pattern for all mutations; the rename mutation would be the simplest one.

---

_Verified: 2026-04-08T03:45:00Z_
_Verifier: Claude (gsd-verifier)_
