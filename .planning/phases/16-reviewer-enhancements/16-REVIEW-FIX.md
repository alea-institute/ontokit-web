---
phase: 16-reviewer-enhancements
fixed_at: 2026-04-08T10:33:00Z
review_path: .planning/phases/16-reviewer-enhancements/16-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-04-08T10:33:00Z
**Source review:** .planning/phases/16-reviewer-enhancements/16-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: useEffect dependency array causes infinite re-fetch loop risk

**Files modified:** `app/projects/[id]/suggestions/review/page.tsx`
**Commit:** 6577091
**Applied fix:** Removed `isDiffLoading` from the dependency array of the diff/session-detail loading useEffect (line 326). The entry guard `if (!selectedSession || activeTab !== "files" || isDiffLoading) return;` remains and is sufficient — the dep was read-only inside the effect and its inclusion caused spurious re-executions on every load cycle.

---

### WR-02: shardMarks not cleared on session switch — stale marks leak to different session

**Files modified:** `app/projects/[id]/suggestions/review/page.tsx`
**Commit:** 6577091
**Applied fix:** Added `setShardMarks({})` in the `else` branch of `handleSelectSession` (when switching to a *different* session). The deselect branch (same session toggle) retains its existing comment preserving the RESEARCH.md Pitfall 4 rationale. This prevents session A's shard marks from being submitted with session B's approval/reject action.

---

### WR-03: Non-null assertion on confidence in ProvenanceBadge is unsafe

**Files modified:** `components/suggestions/ProvenanceBadge.tsx`
**Commit:** 65d1670
**Applied fix:** Replaced `confidenceColor(confidence!)` with `confidenceColor(pct / 100)`. Since `pct` is already computed as `Math.round(confidence * 100)` within the `pct !== null` guard, dividing back by 100 produces the same value as `confidence` without requiring a non-null assertion. This is safe against future type widening.

---

### WR-04: DuplicateComparisonExpander ignores prop changes after mount

**Files modified:** `components/suggestions/DuplicateComparisonExpander.tsx`
**Commit:** 64a92fb
**Applied fix:** Changed the useEffect dependency array from `[]` to `[candidateIri, projectId, branch]`. The `fetchEntityDetail` function closes over these three values; adding them as deps ensures the fetch re-runs whenever any of them changes, making the component resilient even if `key`-based remounting is ever removed from `SimilarEntitiesInlinePanel`. The `eslint-disable` comment is retained because `fetchEntityDetail` itself is not memoised.

---

### WR-05: "Create clean PR" inline handler swallows errors without clearing error state first

**Files modified:** `app/projects/[id]/suggestions/review/page.tsx`
**Commit:** 6577091
**Applied fix:** Added `setError(null)` as the first statement inside the "Create PR from approved shards" onClick handler, immediately after the early-return guard. This clears any stale error banner from prior approve/reject operations before the new async operation begins, preventing stale error messages from persisting or being replaced mid-flight.

---

_Fixed: 2026-04-08T10:33:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
