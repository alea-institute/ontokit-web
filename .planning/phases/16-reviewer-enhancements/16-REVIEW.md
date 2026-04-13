---
phase: 16-reviewer-enhancements
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - __tests__/components/suggestions/ProvenanceBadge.test.tsx
  - __tests__/components/suggestions/ShardReviewMarker.test.tsx
  - __tests__/components/suggestions/ShardTabNavigator.test.tsx
  - __tests__/components/suggestions/SimilarEntitiesInlinePanel.test.tsx
  - __tests__/lib/api/suggestionReviewApi.test.ts
  - __tests__/lib/editor/entityLineAttribution.test.ts
  - app/projects/[id]/suggestions/review/page.tsx
  - components/suggestions/DuplicateComparisonExpander.tsx
  - components/suggestions/ProvenanceBadge.tsx
  - components/suggestions/ShardReviewMarker.tsx
  - components/suggestions/ShardTabNavigator.tsx
  - components/suggestions/SimilarEntitiesInlinePanel.tsx
  - lib/api/suggestions.ts
  - lib/editor/entityLineAttribution.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase adds reviewer-facing enhancements to the suggestion workflow: per-entity provenance badges, shard-level tab navigation and review marking, a similar-entities inline panel with side-by-side comparison, entity-line attribution for diff views, and three new API endpoints (`getSessionDetail`, `postShardReviews`, `createCleanPR`). The implementation is well-structured and the test suite achieves solid coverage of the new components. No critical security or data-loss issues were found.

The main concerns are: a stale-closure/infinite-loop risk in the `useEffect` dependency array on the review page; `shardMarks` not being reset when the user switches to a different session; an unsafe non-null assertion in `ProvenanceBadge`; a `useEffect` with an empty dependency array in `DuplicateComparisonExpander` that silently ignores prop changes; and the "Create clean PR" path missing an error-cleared state reset, which can leave stale error banners.

---

## Warnings

### WR-01: useEffect dependency array causes infinite re-fetch loop risk

**File:** `app/projects/[id]/suggestions/review/page.tsx:293`

**Issue:** `isDiffLoading` is included in the dependency array of the effect that loads the diff and session detail. Since the effect itself calls `setIsDiffLoading(true)` at entry, any external re-render that changes `isDiffLoading` from `false` → `true` and back will re-trigger the effect. More critically, the guard `if (!selectedSession || activeTab !== "files" || isDiffLoading) return;` at line 293 means the effect exits immediately when `isDiffLoading` is `true` but still re-runs on every toggle. This creates a spurious re-execution cycle for the duration of every load. Remove `isDiffLoading` from the dependency array; the guard at entry is sufficient without it.

**Fix:**
```ts
// Remove isDiffLoading from deps — it is read-only inside the effect
// and the entry guard is already sufficient.
  }, [selectedSession, activeTab, diff, sessionDetail, projectId, session?.accessToken]);
```

---

### WR-02: shardMarks not cleared on session switch — stale marks leak to different session

**File:** `app/projects/[id]/suggestions/review/page.tsx:329-342`

**Issue:** `handleSelectSession` explicitly comments "shardMarks intentionally NOT cleared here (RESEARCH.md Pitfall 4)". While that rationale may be valid for a deselect-then-reselect of the *same* session, the same code path runs when switching to a *different* session (the `else` branch at line 336). If a reviewer marks shards on session A, then clicks session B, the `shardMarks` state still holds session A's marks. These are then submitted with session B's approval/reject action at lines 352-370. This is a data-integrity bug: shard review metadata from session A gets attached to session B.

**Fix:**
```ts
const handleSelectSession = (s: SuggestionSessionSummary) => {
  if (selectedSession?.session_id === s.session_id) {
    setSelectedSession(null);
    setDiff(null);
    setSessionDetail(null);
    setActiveShardId(null);
    // NOTE: shardMarks intentionally NOT cleared here (RESEARCH.md Pitfall 4)
  } else {
    setSelectedSession(s);
    setDiff(null);
    setSessionDetail(null);
    setActiveShardId(null);
    setShardMarks({}); // Clear marks when switching to a different session
    setActiveTab("summary");
  }
};
```

---

### WR-03: Non-null assertion on confidence in ProvenanceBadge is unsafe

**File:** `components/suggestions/ProvenanceBadge.tsx:40`

**Issue:** The expression `confidenceColor(confidence!)` uses a non-null assertion. The outer condition `pct !== null` guarantees `confidence` is not `null`, but TypeScript cannot narrow the type of the outer-scope `confidence` parameter inside the JSX expression. If someone calls `ProvenanceBadge` with `confidence={0}` (a falsy but valid number), the `pct !== null` guard passes (`0 !== null` is true) and `confidence!` is fine. However if the types are ever loosened (e.g., `confidence: number | null | undefined`) the assertion will mask a runtime `NaN` propagation. Use the already-computed `pct` value instead.

**Fix:**
```tsx
{pct !== null ? (
  <span className={cn(confidenceColor(pct / 100))}>{pct}%</span>
) : (
  <span className="text-slate-400">---</span>
)}
```

Or, simpler — since `pct` is already `Math.round(confidence * 100)`, pass the original `confidence` value only when guarded:

```tsx
{pct !== null ? (
  <span className={cn(confidenceColor(confidence as number))}>{pct}%</span>
) : (
  <span className="text-slate-400">---</span>
)}
```

The safest fix is to pass `pct / 100` to `confidenceColor` rather than relying on the assertion.

---

### WR-04: DuplicateComparisonExpander ignores prop changes after mount

**File:** `components/suggestions/DuplicateComparisonExpander.tsx:57-60`

**Issue:** The `useEffect` at line 57 has an empty dependency array (`[]`) and calls `fetchEntityDetail()`. The `fetchEntityDetail` function is defined inside the component and closes over `candidateIri`, `projectId`, `accessToken`, and `branch`. If the parent renders `DuplicateComparisonExpander` with a different `candidateIri` (e.g., the user clicks a different candidate in `SimilarEntitiesInlinePanel`), the fetch will not re-run because the effect never re-executes. In the current accordion pattern this is acceptable only because a different `key` prop would cause remounting — but `key` is set to `candidate.iri` in `SimilarEntitiesInlinePanel` (line 64), so a re-mount does happen. The risk is that if the `key` usage is ever removed or the component is reused without `key`, stale data will silently display. The suppressed lint warning (`react-hooks/exhaustive-deps`) at line 59 is the tell. Adding the relevant dependencies removes the suppression need and makes the contract explicit.

**Fix:**
```ts
useEffect(() => {
  fetchEntityDetail();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [candidateIri, projectId, branch]);
```

If `fetchEntityDetail` is also stabilised with `useCallback`, the dep array becomes `[fetchEntityDetail]` and the lint suppression can be removed entirely.

---

### WR-05: "Create clean PR" inline handler swallows errors without clearing error state first

**File:** `app/projects/[id]/suggestions/review/page.tsx:891-916`

**Issue:** The inline `onClick` handler for "Create PR from approved shards" (line 891) sets `setError(...)` on failure but does not call `setError(null)` at the start of the attempt. If a previous operation (approve/reject) had set an error banner and the user then clicks "Create clean PR", the prior error message remains visible and may then be replaced by the new one — or, if the new call succeeds, the old error banner is never cleared. All other action handlers (`handleApprove`, `handleReject`, `handleRequestChanges`) do not explicitly clear the error either, but they reset `selectedSession` to `null` on success, which effectively unmounts the banner context. This inline handler does NOT clear `selectedSession` on success (line 906 does, but only after `setError` is absent from the success path).

**Fix:**
```ts
onClick={async () => {
  if (!selectedSession || !session?.accessToken) return;
  setError(null); // Clear any prior error before starting
  const approvedIds = ...
```

---

## Info

### IN-01: `attributeLinesToEntities` silently no-ops on prefixed subject declarations

**File:** `lib/editor/entityLineAttribution.ts:36-42`

**Issue:** The `prefixMatch` branch (lines 36-42) detects a prefixed subject declaration (e.g., `+ ex:Bar a owl:Class ;`) but then does nothing — the comment says "retain current context" as "best-effort". This means a prefixed subject line is attributed to whatever entity was last seen via full-IRI, which is incorrect. The test at line 52 of `entityLineAttribution.test.ts` asserts the result is `null` only because there was no "prior context", but in a real patch with a previous full-IRI entity, the prefixed entity would silently inherit the wrong attribution. The comment acknowledges this but it is worth flagging as a known limitation that could produce misleading provenance badges in diffs that use prefix notation.

No immediate code change is required, but a TODO comment with the known scope would make the limitation explicit.

---

### IN-02: `ShardReviewMarker` localFeedback state is not reset when `mark` prop changes

**File:** `components/suggestions/ShardReviewMarker.tsx:29`

**Issue:** `localFeedback` is initialised from `mark?.feedback ?? ""` once at mount. If the parent clears the `mark` prop (e.g., user clicks "Clear" on a rejected shard and then re-clicks "Reject shard"), the component re-renders in the unmarked state and then back to rejected — but `localFeedback` will retain whatever was previously typed because the state is never reset on prop change. In the current flow, clicking "Reject shard" calls `onChange(shardId, { status: "rejected", feedback: "" })` with an empty string, but the textarea re-renders initialised from the stale local state, creating a mismatch: the displayed text differs from what was reported to the parent.

A controlled approach (driving the textarea value entirely from the prop) or a `useEffect` to sync `localFeedback` with `mark?.feedback` when the prop changes would fix this.

---

### IN-03: `ProvenanceBadge` aria-label separator is an em-dash that may not be read clearly by screen readers

**File:** `components/suggestions/ProvenanceBadge.tsx:30`

**Issue:** The `ariaLabel` string uses ` — ` (em-dash with spaces) as a separator between provenance text and confidence percentage. The test at line 54 of `ProvenanceBadge.test.tsx` asserts the pattern `/LLM proposed.*87%/i`, which passes regardless of the separator. Some screen readers read em-dash as "dash" or pause without announcing any text, making "LLM proposed — 87% confidence" potentially read as "LLM proposed 87% confidence" or with an awkward pause. Using a comma or the word "with" ("LLM proposed, 87% confidence") is more universally readable.

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
