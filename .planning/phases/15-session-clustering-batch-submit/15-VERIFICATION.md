---
phase: 15-session-clustering-batch-submit
verified: 2026-04-08T04:35:00Z
status: human_needed
score: 5/5
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "The preview tree lets the user merge two shards, split a shard, or rename a shard label before submitting"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open editor in suggestion mode with >5 accepted suggestions, click Submit Suggestions, verify the shard preview modal opens"
    expected: "Cluster API is called, modal appears with PR groups and shards organized by ancestor"
    why_human: "Requires running backend with cluster endpoint implemented — cannot test frontend wiring without live API"
  - test: "In the shard preview modal, drag an entity from one shard to another"
    expected: "Entity moves to the target shard, counts update in the summary bar"
    why_human: "DnD interaction requires a live browser session with drag events"
  - test: "Right-click a shard, select Rename, type a new name, press Enter"
    expected: "Shard label updates inline, summary bar reflects the change, merge/move submenus show the new label"
    why_human: "Inline editing interaction requires live browser — cannot verify focus/blur/keydown behavior programmatically"
  - test: "Click Submit in the modal, verify progress bar and completion screen"
    expected: "Progress steps animate, completion screen shows PR links or error retry"
    why_human: "Requires live batch-submit API endpoint"
  - test: "Verify dark mode appearance of all shard preview components"
    expected: "All backgrounds, text, badges, and borders have proper dark mode variants"
    why_human: "Visual appearance verification — grep confirms dark: classes exist but cannot verify they look correct"
---

# Phase 15: Session Clustering & Batch Submit Verification Report

**Phase Goal:** At submit time, the system automatically groups a user's accumulated suggestions into ancestor-based PR shards, the user can review and adjust the proposed groupings, and each approved shard becomes a single trackable PR
**Verified:** 2026-04-08T04:35:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (rename shard)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking "Submit session" triggers automatic clustering and shows the user a shard preview tree | VERIFIED | `page.tsx:695` `handleSubmitClick` calls `suggestionsApi.cluster()` when `changesCount > SMALL_SESSION_THRESHOLD (5)`, sets `clusterResponse`, opens `ShardPreviewModal`. Modal hydrates store via `setFromClusterResponse` and renders nested PR group/shard/entity tree. |
| 2 | The preview tree lets the user merge two shards, split a shard, or rename a shard label before submitting | VERIFIED | Merge: `ShardPreviewShardRow.tsx:209` onSelect calls `mergeShards`. Split: `ShardPreviewShardRow.tsx:233-240` activates split mode with checkbox selection and `splitShard` call. **Rename: FIXED** -- `renameShard(shardId, newLabel)` mutation at store line 278, "Rename" context menu item at line 244-253, inline text input with Enter/Escape/blur handling at lines 147-168, `aria-label` present. |
| 3 | A shard with fewer than 3 suggestions is automatically rolled into a "Miscellaneous improvements" shard | VERIFIED | Frontend preserves `isMisc` flag from backend `ClusterResponse`. `ShardPreviewShardRow.tsx:169-171` renders amber "Miscellaneous improvements" badge. Test verifies non-misc shards have >= 3 entities. Backend enforcement is the authority; frontend displays the result. |
| 4 | Each shard becomes exactly one commit; shards grouped into PRs by subtree branch, splitting when exceeding limits; suggestion never in more than one commit | VERIFIED | `ShardPreviewModal.tsx:129-143` builds `BatchSubmitRequest` with one shard per commit unit. Store enforces CLUSTER-05 atomicity: `moveEntity` (line 161) uses single `set()` call to remove from source and add to target. Test verifies entity appears in exactly one shard post-move. PR group splitting is backend-determined. |
| 5 | GitHub's commit tab within each PR serves as the shard navigator; reviewer approves/rejects per-PR | VERIFIED | Each shard becomes one commit in the `BatchSubmitRequest`. This is a backend + GitHub affordance that the frontend correctly sets up. CLUSTER-09 is satisfied by the batch submit request structure. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/stores/shardPreviewStore.ts` | Ephemeral Zustand store for mutable shard plan | VERIFIED | 384 lines, exports `useShardPreviewStore`, `ShardDefinition`, `PRGroupDefinition`. All mutations use single `set()` calls. Includes `renameShard`. No persist middleware. |
| `lib/api/suggestions.ts` | Extended with cluster() and batchSubmit() | VERIFIED | `ClusterRequest`, `ClusterResponse`, `BatchSubmitRequest`, `BatchSubmitResponse` types exported. `cluster()` POSTs to `/cluster`, `batchSubmit()` POSTs to `/batch-submit`. Both use `Authorization: Bearer` header. |
| `components/suggestions/ShardPreviewSummaryBar.tsx` | Summary bar component | VERIFIED | 45 lines, reads store via `useShardPreviewStore`, renders "N suggestions -> N shards -> N PRs" reactively. Dark mode variants present. |
| `components/suggestions/ShardPreviewPRGroup.tsx` | PR group collapsible component | VERIFIED | 92 lines, `useDroppable` drop target, `ChevronRight`/`ChevronDown` toggle, `aria-expanded`, expand/collapse state from store. |
| `components/suggestions/ShardPreviewShardRow.tsx` | Shard row with context menu | VERIFIED | 348 lines, `useDraggable` + `useDroppable`, Radix `DropdownMenu` with Merge into.../Split shard/Rename/Move to PR... items. Amber/violet badges for misc/cross-cutting. Inline rename input with Enter/Escape/blur. `aria-label` on all interactive elements. |
| `components/suggestions/ShardPreviewEntityList.tsx` | Entity list within shard | VERIFIED | 188 lines, per-entity `useDraggable`, `GripVertical` drag handle, `getLocalName()` display, "Move to..." dropdown fallback, split mode with checkboxes. |
| `components/suggestions/ShardSubmitProgressBar.tsx` | Multi-step progress indicator | VERIFIED | 80 lines, `role="status"` + `aria-live="polite"`, icons for idle/active/done/error states, `Loader2` spinner for active step. |
| `components/suggestions/ShardSubmitComplete.tsx` | Completion screen | VERIFIED | 120 lines, "Suggestions submitted" / partial failure heading, PR links with `target="_blank" rel="noopener noreferrer"`, "Retry failed" + "Done" buttons. |
| `components/suggestions/ShardPreviewModal.tsx` | Full-screen modal orchestrator | VERIFIED | 364 lines, three phases (preview/submitting/complete), `DndContext` with `useShardDragDrop`, `role="dialog" aria-modal="true"`, Escape key handler, notes textarea, Submit/Cancel buttons. |
| `lib/hooks/useShardDragDrop.ts` | DnD handler hook | VERIFIED | 64 lines, exports `useShardDragDrop`, `PointerSensor` with distance 8, `KeyboardSensor`, dispatches `moveEntity`/`moveShard` on drag end. |
| `app/projects/[id]/editor/page.tsx` | Editor page with clustering gate | VERIFIED | Dynamic import with `ssr: false`, `SMALL_SESSION_THRESHOLD = 5`, `handleSubmitClick` gates through clustering, `handleBatchSubmitted` clears suggestion store, `<ShardPreviewModal>` rendered conditionally. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ShardPreviewModal.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Import + store selectors for state/mutations |
| `ShardPreviewModal.tsx` | `suggestions.ts` | `suggestionsApi.batchSubmit()` | WIRED | Import + `suggestionsApi.batchSubmit()` call |
| `ShardPreviewModal.tsx` | `useShardDragDrop.ts` | `useShardDragDrop()` | WIRED | Import + hook call, sensors + handleDragEnd used in DndContext |
| `useShardDragDrop.ts` | `shardPreviewStore.ts` | `moveEntity` / `moveShard` | WIRED | Store selectors + dispatch calls |
| `ShardPreviewPRGroup.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Import + selectors for expandedPrIds and togglePrExpanded |
| `ShardPreviewShardRow.tsx` | `shardPreviewStore.ts` | `useShardPreviewStore` | WIRED | Import + selectors for mergeShards, moveShard, splitShard, renameShard (line 50) |
| `page.tsx` | `ShardPreviewModal.tsx` | Dynamic import + conditional render | WIRED | Lines 51-53 dynamic import, Lines 1445-1450 conditional render with all props |
| `page.tsx` | `suggestions.ts` | `suggestionsApi.cluster()` | WIRED | Import + `suggestionsApi.cluster()` call at line 726 |
| `page.tsx` | `suggestionStore.ts` | `clearAllSuggestions` on success | WIRED | Import + `useSuggestionStore.getState().clearAllSuggestions()` at line 755 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ShardPreviewSummaryBar` | `shards`, `prGroups` | `useShardPreviewStore` selectors | Store hydrated from `ClusterResponse` via `setFromClusterResponse` | FLOWING |
| `ShardPreviewPRGroup` | `expandedPrIds` | `useShardPreviewStore` | Computed on hydration, updated by toggle | FLOWING |
| `ShardPreviewModal` | `prGroups`, `shards`, `prGroupOrder` | `useShardPreviewStore` | Hydrated from `clusterResponse` prop on mount | FLOWING |
| `ShardPreviewModal` | `shardLabelMap` | Derived from `shards` via `useMemo` | Recomputes on store change (including rename) | FLOWING |
| `page.tsx` clustering gate | `clusterResponse` | `suggestionsApi.cluster()` API call | Live API call with accepted suggestions from store | FLOWING (when backend exists) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests pass | `npm run test -- --run` | 140 passed, 8 skipped, 0 failed | PASS |
| Type-check passes | `npm run type-check` | Clean exit, no errors | PASS |
| Store exports include renameShard | grep for renameShard in store | Found at lines 78 (interface) and 278 (implementation) | PASS |
| ShardRow context menu has Rename | grep for Rename in ShardRow | Found at lines 166, 244, 252 (aria-label, comment, menu item) | PASS |
| All 11 Phase 15 artifacts exist | ls check | All files present with substantive line counts (45-384 lines) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLUSTER-01 | 15-00, 15-01, 15-03, 15-04 | System auto-clusters suggestions by common ancestor | SATISFIED | `handleSubmitClick` calls `suggestionsApi.cluster()`, store hydrated from response, modal renders tree |
| CLUSTER-02 | 15-00, 15-01 | Max 50 entities per shard | SATISFIED (frontend) | Store preserves backend-computed sizes; test verifies max-50 constraint. Backend enforcement is authoritative. |
| CLUSTER-03 | 15-00, 15-01, 15-04 | Min 3 entities, misc shard | SATISFIED | `isMisc` flag mapped from backend, amber badge rendered, test verifies min-3 |
| CLUSTER-04 | 15-00, 15-01 | Cross-cutting changes shard | SATISFIED (frontend) | `isCrossCutting` flag mapped from `is_cross_cutting`, violet badge rendered. Backend determines cross-cutting assignment. |
| CLUSTER-05 | 15-00, 15-01, 15-03 | Each suggestion in exactly one shard | SATISFIED | All mutations use single `set()` call; `moveEntity` atomically transfers; test verifies entity uniqueness |
| CLUSTER-06 | 15-00, 15-02, 15-03, 15-04 | User preview with merge/split/rename | SATISFIED | Context menu: Merge into.../Split shard/Rename/Move to PR...; DnD for entity/shard movement; inline rename input with Enter/Escape/blur |
| CLUSTER-07 | 15-00, 15-01, 15-03, 15-04 | Each shard = one commit, grouped into PRs | SATISFIED | `BatchSubmitRequest` maps shards to commits, PR groups to PRs; `batchSubmit()` sends to backend |
| CLUSTER-08 | 15-00, 15-01, 15-04 | PR split when exceeding limits | SATISFIED | Backend determines PR group split; frontend preserves and displays multiple PR groups; test covers >10 shards |
| CLUSTER-09 | 15-02, 15-04 | Reviewer approves per-PR, GitHub commit tab as navigator | SATISFIED | Batch submit creates commit-per-shard structure; `ShardSubmitComplete` shows PR links |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shardPreviewStore.ts` | -- | No unit test for `renameShard` mutation | INFO | Simple property update; type-checked and wired through UI; all other mutations have tests |

### Human Verification Required

### 1. Shard Preview Modal Opens on Submit

**Test:** Open editor in suggestion mode with >5 accepted suggestions, click Submit Suggestions
**Expected:** Cluster API is called (visible in network tab), shard preview modal opens with PR groups and shards organized by ancestor
**Why human:** Requires running backend with cluster endpoint implemented

### 2. Drag-and-Drop Entity Movement

**Test:** In the shard preview modal, drag an entity from one shard to another
**Expected:** Entity moves to the target shard, summary bar counts update immediately
**Why human:** DnD interaction requires a live browser session with pointer events

### 3. Shard Rename via Context Menu

**Test:** Click the three-dot menu on a shard, select "Rename", type a new name, press Enter
**Expected:** Shard label updates inline, merge/move submenus in other shards show the new label
**Why human:** Inline editing interaction (focus, blur, keydown) requires live browser

### 4. Submit Progress and Completion

**Test:** Click Submit in the modal, observe progress bar, then completion screen
**Expected:** Progress steps animate through, completion screen shows PR links (success) or error rows with retry
**Why human:** Requires live batch-submit API endpoint

### 5. Dark Mode Visual Check

**Test:** Toggle dark mode and inspect all shard preview components
**Expected:** All backgrounds, text, badges, borders, and input fields display properly in dark mode
**Why human:** Visual appearance -- grep confirms dark: classes exist but cannot verify visual correctness

### Gaps Summary

No gaps remaining. The previously-identified rename gap has been fully closed:

- **Store**: `renameShard(shardId, newLabel)` mutation added at line 278 with single `set()` call, guards against no-op (same label) and missing shard
- **UI**: "Rename" context menu item added at line 244-253, triggers inline `<input>` that replaces the shard label display
- **Inline input**: Auto-focused, commits on blur and Enter, cancels on Escape with label revert, has `aria-label`, dark mode classes present
- **Wiring**: Component imports `renameShard` from store selector at line 50, calls it at line 154. `shardLabelMap` in ShardPreviewModal recomputes from store state via `useMemo`, so renamed labels propagate to merge/move submenus.

All 5 roadmap success criteria are now fully met. All 9 CLUSTER requirements are satisfied at the frontend level (CLUSTER-02 and CLUSTER-04 enforcement is backend-side; frontend correctly preserves and displays the backend's decisions).

---

_Verified: 2026-04-08T04:35:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Gap closed (rename shard)_
