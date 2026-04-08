# Phase 16: Reviewer Enhancements - Research

**Researched:** 2026-04-08
**Domain:** React / Next.js 15 — extending an existing suggestion review page with LLM provenance display, duplicate-detection context, and shard-level navigation/annotation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Per-line provenance badges in the diff view. Each added line gets an icon: sparkle for `llm-proposed`, pencil for `user-edited-from-llm`, user for `user-written`.

**D-02:** Confidence percentage displayed inline next to the provenance icon when available, dash when not.

**D-03:** Confidence color-coded green >= 80%, amber >= 60%, red < 60%. Matches Phase 14 convention.

**D-04:** Collapsible per-entity "Similar existing entities" section in diff view. Shows top duplicate candidates with composite scores. Only appears when candidates exist (score > 0.40).

**D-05:** Candidate score color-coding reuses existing SimilarConceptsPanel convention: green >= 80%, amber >= 60%, slate < 60%.

**D-06:** Clicking a duplicate candidate expands an inline side-by-side comparison: two-column layout, new entity left vs. existing candidate right, showing labels/comments/annotations/parent classes with matching/differing fields highlighted.

**D-07:** Existing entity data for comparison is lazy-loaded on expand — not pre-fetched.

**D-08:** Shard tab navigator bar above the diff view. Each shard is a tab showing label + entity count. "All" tab shows everything. Clicking a shard filters the diff to that shard's entities.

**D-09:** Per-shard approve/reject as review metadata — reviewer can mark individual shards as approved or rejected with optional feedback per shard.

**D-10:** Whole-PR approve/reject/request-changes remains the primary action. Per-shard marking is additive metadata, not a replacement.

**D-11:** Optional "Create clean PR" button (stretch goal) — when some shards are rejected, generates a new PR from only approved shard-commits. Ships after per-shard marking.

**D-12:** Rejected shards generate a "changes requested" notification to the submitter with shard-specific feedback.

**D-13:** Enrich existing session detail endpoint to return per-entity metadata: provenance tag, confidence score, and duplicate_candidates alongside existing diff data.

**D-14:** Shard/commit structure returned in enriched response so frontend can build shard tab navigator without additional API calls.

**D-15:** Per-shard review decisions stored via a new endpoint (`POST /suggestions/{session_id}/shard-reviews`).

**D-16:** "Create clean PR" button triggers a backend endpoint that regenerates a PR from approved shard entities only.

### Claude's Discretion

- Exact shard tab styling and overflow behavior when many shards exist
- Animation when switching between shard tabs
- How side-by-side duplicate comparison handles entities with many annotations (scroll vs truncate)
- Loading state design while lazy-fetching duplicate candidate details
- Whether "Create clean PR" button appears immediately or only after reviewer has marked at least one shard as rejected
- Per-shard feedback input design (inline textarea vs dialog)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIEW-01 | Existing diff view works for LLM-proposed suggestions identically to human-written ones | The current `DiffView` component renders patch text line-by-line; per-line provenance badges are additive overlays on `+` lines — no structural change to the diff renderer |
| REVIEW-02 | Reviewer sees similar-existing-entities panel for every suggestion (duplicate detection results) | `DuplicateCandidate` type with `iri`, `label`, `score` already defined in `lib/api/generation.ts`; enriched session endpoint (D-13) carries these; `SimilarConceptsPanel` provides the reusable render pattern |
| REVIEW-03 | Reviewer sees provenance tag on every suggestion (llm-proposed / user-written / user-edited-from-llm) | `Provenance` type and field already exists in `GeneratedSuggestion`; `ProvenanceBadge` component is a new build per UI-SPEC |
| REVIEW-04 | Reviewer sees LLM confidence score where available | `confidence: float \| null` already in `GeneratedSuggestion` schema; badge design specified in UI-SPEC |
| REVIEW-05 | PR is the batch unit; reviewer approves/rejects per-PR; GitHub's commit tab serves as shard navigator for per-shard drill-down | PR-level approve/reject already implemented; shard tab navigator (D-08) is the frontend equivalent of GitHub's commit tab; per-shard metadata endpoint (D-15) adds structured feedback |

</phase_requirements>

---

## Summary

Phase 16 extends `app/projects/[id]/suggestions/review/page.tsx` — no new pages are built. The work is entirely additive to the existing review page structure: new components overlaid onto the existing `DiffView`, a shard tab navigator bar injected above the diff, per-shard review marking below each shard's filtered diff, and a new API client call to fetch the enriched session detail.

The key architectural insight is that all the domain types already exist: `GeneratedSuggestion` has `provenance`, `confidence`, and `duplicate_candidates` fields in both the frontend (`lib/api/generation.ts`) and backend (`ontokit/schemas/generation.py`). Phase 16 is primarily a **plumbing and rendering** problem — getting that data from the generation pipeline through to the reviewer's screen — not a domain modelling problem.

The main engineering challenges are: (1) the backend needs an enriched GET endpoint for session detail that joins entity-level metadata with the existing session summary, (2) the diff view needs to correlate raw patch lines with entity IRIs (so it knows which lines belong to which entity/shard), and (3) per-shard marking state needs to be threaded through to the final PR-level action payload.

**Primary recommendation:** Build in two waves. Wave 1: enrich the session detail API + render provenance badges + shard tab navigator (REVIEW-01 through REVIEW-05, core path). Wave 2: similar-entities inline panel + duplicate comparison expander + per-shard marking + notification routing (the deeper affordances from D-04, D-09, D-12, D-15).

---

## Standard Stack

### Core (all already in project dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Component rendering | Project baseline |
| Next.js | 15.x | Routing, server components | Project baseline |
| Tailwind CSS | 3.x | Utility styling | Project baseline |
| `@tanstack/react-query` | 5.x | Server state fetching | Project baseline — used throughout |
| Zustand | 5.x | Client-side state | Project baseline — per-shard marks stored here |
| lucide-react | current | Icons (Sparkles, Pencil, User, CheckCircle, XCircle) | Project baseline |
| `@radix-ui/react-tabs` | direct import | ShardTabNavigator tablist | Already in package.json per UI-SPEC [VERIFIED: project package.json via UI-SPEC source] |
| `@radix-ui/react-tooltip` | direct import | "Create clean PR" disabled state tooltip | Already in package.json per UI-SPEC |

[VERIFIED: `lib/api/generation.ts`, `lib/api/suggestions.ts`, `lib/stores/shardPreviewStore.ts`, `components/editor/SimilarConceptsPanel.tsx`, `app/projects/[id]/suggestions/review/page.tsx` — all read in this session]

### No new dependencies needed

All required libraries are already installed. This phase adds zero new `npm` packages.

**Installation:** none required

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
components/suggestions/
├── ProvenanceBadge.tsx           # Per-line provenance + confidence badge
├── ShardTabNavigator.tsx         # Tab bar above diff — "All" + per-shard tabs
├── ShardReviewMarker.tsx         # Per-shard approve/reject strip + feedback textarea
├── SimilarEntitiesInlinePanel.tsx # Collapsible candidates panel per entity in diff
└── DuplicateComparisonExpander.tsx # Side-by-side new vs. existing entity comparison

lib/api/
└── suggestions.ts                # Extended: add getSessionDetail(), postShardReviews()

__tests__/lib/api/
└── suggestionDetailApi.test.ts   # Unit stubs for new API methods
__tests__/components/suggestions/
└── provenanceBadge.test.ts       # Unit stubs for ProvenanceBadge rendering
```

Files modified this phase:

```
app/projects/[id]/suggestions/review/page.tsx  # Adds shard tabs, enriched data, per-shard marks
lib/api/suggestions.ts                         # New API methods for enriched detail + shard reviews
```

### Pattern 1: Enriched Session Detail

The existing review page fetches `suggestionsApi.listPending()` for the session list, then `pullRequestsApi.getDiff()` lazily. Phase 16 adds a third fetch: `suggestionsApi.getSessionDetail(projectId, sessionId, token)` that returns the enriched response including entity-level metadata.

The enriched response type (new frontend type to add to `lib/api/suggestions.ts`):

```typescript
// Source: 16-CONTEXT.md D-13, D-14
export interface EntityReviewMetadata {
  entity_iri: string;
  entity_label: string;
  shard_id: string;
  shard_label: string;
  provenance: Provenance;                    // from generation.ts
  confidence: number | null;
  duplicate_candidates: DuplicateCandidate[]; // from generation.ts
}

export interface ShardReviewInfo {
  id: string;
  label: string;
  entity_iris: string[];
}

export interface SessionDetailResponse {
  session_id: string;
  entities: EntityReviewMetadata[];
  shards: ShardReviewInfo[];
}
```

[ASSUMED] — This type shape is inferred from D-13/D-14 in CONTEXT.md. Backend endpoint does not yet exist; schema must be confirmed with backend implementor.

### Pattern 2: Per-Line Provenance in DiffView

The existing `DiffView` component renders patch lines with a `.split("\n").map((line, idx) => ...)` loop. Lines starting with `+` are additions. Each addition line needs a `ProvenanceBadge` overlaid at the far right of the line.

The challenge: a raw patch line like `+ rdfs:label "Fraud Prevention"@en ;` contains Turtle content, not a direct IRI. Correlating patch lines to entity IRIs requires the enriched session detail to include per-entity line ranges, OR the diff renderer to parse the Turtle fragment to extract the subject IRI from the preceding `+` subject line.

**Recommended approach:** The enriched session detail includes entity IRIs and their shard membership. When the diff is rendered, the reviewer page keeps a running `currentEntityIri` state as it walks the patch — the `+` lines that look like subject declarations (`+ <iri>` or `+ localname:prefix`) update the current entity context. All subsequent `+` lines until the next subject declaration inherit that entity's provenance/confidence.

This is client-side parsing — no additional API calls needed for line attribution once entity metadata is loaded.

```typescript
// Source: 16-CONTEXT.md D-01, D-02; existing DiffView in review/page.tsx
// Pattern for enhanced diff line rendering:
{line.startsWith("+") && !line.startsWith("+++") && currentEntityMeta && (
  <ProvenanceBadge
    provenance={currentEntityMeta.provenance}
    confidence={currentEntityMeta.confidence}
  />
)}
```

[ASSUMED] — The line-to-entity attribution strategy (subject-declaration tracking) is architectural inference. The backend may instead annotate the diff with entity boundaries directly. Verify with backend team before implementing the parser approach.

### Pattern 3: Shard Tab Navigation (client-side filter)

Shard tabs filter the existing diff **client-side** — no additional API calls per tab switch. The enriched session detail provides `shards[].entity_iris`, and the diff renderer skips files/hunks whose entity IRIs don't belong to the active shard.

```typescript
// Source: 16-CONTEXT.md D-08; UI-SPEC ShardTabNavigator section
// State in review page:
const [activeShardId, setActiveShardId] = useState<string | null>(null); // null = "All"

// Filter logic applied to diff.files during render:
const visibleFiles = activeShardId
  ? diff.files.filter(file => fileContainsShardEntities(file, activeShardId, sessionDetail))
  : diff.files;
```

The `fileContainsShardEntities` helper checks whether any entity IRI belonging to the active shard appears in the patch of that file.

[ASSUMED] — Since all entities currently write to one Turtle file, filtering "by file" may not segment cleanly. The actual filter may need to operate at the **hunk** level within a file's patch. Verify whether batch-submitted PRs produce one commit per shard (each touching the same file) or separate files.

### Pattern 4: Per-Shard Review Marking (local state, sent with final action)

Per-shard marks are buffered in React state — no API call fires immediately on marking. The marks are included in the payload when the reviewer clicks Approve / Reject / Request Changes.

```typescript
// Source: 16-CONTEXT.md D-09, D-10; UI-SPEC Per-Shard Review Marking section
type ShardMark = { status: "approved" | "rejected"; feedback?: string };
const [shardMarks, setShardMarks] = useState<Record<string, ShardMark>>({});

// When final action fires (e.g., handleApprove):
if (Object.keys(shardMarks).length > 0) {
  await suggestionsApi.postShardReviews(projectId, sessionId, shardMarks, token);
}
await suggestionsApi.approve(projectId, sessionId, token);
```

[ASSUMED] — Whether shard reviews are sent before or after the PR-level action is an ordering choice. Sending before the main action is safer (the shard metadata is persisted even if the main action fails). Confirm with backend implementor.

### Anti-Patterns to Avoid

- **Pre-fetching all duplicate candidate entity details on load**: D-07 explicitly requires lazy loading. Loading 20+ entity details on page load would cause waterfalls. Load only when reviewer expands a candidate.
- **Re-implementing diff parsing**: The existing `DiffView` component already parses patch text correctly for line coloring. Extend it, don't replace it. Any rewrite risks regressions on the existing line-type detection.
- **Separate API call per shard tab switch**: All filtering is client-side. Zero new network requests when switching tabs.
- **Coupling shard marks to whole-PR action before both are implemented**: Build per-shard marking store first, send it as additive metadata. The PR-level actions are already working — don't refactor them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible panels | Custom toggle + CSS max-height animation | The existing `SimilarConceptsPanel` expand/collapse pattern with `ChevronRight` / `ChevronDown` + `aria-expanded` | Already done correctly in the codebase; new SimilarEntitiesInlinePanel explicitly mirrors this pattern |
| Score color coding | Custom thresholds | `scoreColor()` from `SimilarConceptsPanel.tsx` — identical thresholds (green >= 0.8, amber >= 0.6, slate < 0.6) | D-05 mandates reuse; the function is 4 lines, extractable or inlineable |
| Tab navigation with keyboard support | Custom tab implementation | `@radix-ui/react-tabs` direct import (already in package.json) | Handles `role="tablist"`, arrow key navigation, `aria-selected`, `aria-controls` correctly per ARIA spec; UI-SPEC mandates it |
| Loading skeletons | Custom shimmer CSS | `h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700` Tailwind pattern | Already established in project; DuplicateComparisonExpander uses this per UI-SPEC |
| Notification routing for shard feedback | Custom event bus | Existing `NOTIFICATIONS_CHANGED_EVENT` dispatch + `notificationsApi` | Already wired throughout the app; D-12 shard rejection notifications follow the same pattern as existing `suggestion_changes_requested` notification type |

**Key insight:** Every new component in Phase 16 has a direct analogue already in the codebase. The goal is to compose and extend, not invent.

---

## Common Pitfalls

### Pitfall 1: Enriched Detail Fetch Timing
**What goes wrong:** The review page currently loads session list eagerly and diff lazily (on tab switch). If the enriched session detail fetch fires on session select, it may race with the diff fetch when the reviewer immediately clicks "Files."

**Why it happens:** Two independent lazy fetches triggered at the same moment.

**How to avoid:** Fetch enriched session detail at the same time as the diff (both triggered when a session is selected and Files tab is active). Use `Promise.all()` or a single combined React Query key that covers both.

**Warning signs:** `undefined` provenance on diff lines because enriched metadata hasn't resolved yet when the diff renders.

### Pitfall 2: Entity-to-Line Attribution in Diff
**What goes wrong:** Patch text doesn't have explicit entity IRI markers. Naively scanning for `+` lines that look like IRIs will miss multiline Turtle blocks (e.g., a class definition spanning 10+ lines).

**Why it happens:** Turtle syntax uses a subject-predicate-object pattern where only the first line has the IRI; subsequent lines use `;` continuations.

**How to avoid:** Implement a state machine that tracks the "current entity" as the diff lines are iterated: a `+` line matching `^\+ <http` or `^\+ \w+:\w+\s+a\s+owl:` transitions to a new entity context; all subsequent `+` lines (including `;` continuations) inherit that context until the next entity declaration.

**Warning signs:** All `+` lines showing the same entity's provenance badge, or badge appearing only on the first line of a multi-line entity block.

### Pitfall 3: Shard Filter on Single-File Diffs
**What goes wrong:** Batch-submitted PRs may contain one Turtle file modified by multiple shard-commits. The diff shows the cumulative patch — all shards' changes in one file. Filtering "files by shard" won't segment anything (all shards touch the same file).

**Why it happens:** The ontology is a single `.ttl` file; all entities share it. Each shard's commit adds its entities to the same file.

**How to avoid:** When `activeShardId` is set, filter at the **hunk level** within the patch, not at the file level. Mark each patch hunk with the entity IRI it corresponds to (using the same line-scanning logic as Pitfall 2), then only render hunks where the entity IRI belongs to the active shard.

**Warning signs:** Shard tab switching having no visual effect on the rendered diff.

### Pitfall 4: Per-Shard Marks Not Persisted on Page Refresh
**What goes wrong:** If the reviewer marks several shards and then refreshes the page (or navigates away), all marks are lost. They have to re-mark before the final action.

**Why it happens:** Marks are in React state, not persisted to backend until the final PR action.

**How to avoid:** This is by design per D-09 — marks are metadata sent at PR action time. Document this in the UI (e.g., a subtle "unsaved marks" indicator). Do NOT silently discard marks on session deselect — clear them only when the final action completes.

**Warning signs:** Reviewer marks 3 shards, clicks away to a different session, comes back, and all marks are gone.

### Pitfall 5: Notification Type for Shard-Level Feedback
**What goes wrong:** Shard rejection notifications need to carry shard-specific feedback to the submitter. If the backend reuses the generic `suggestion_changes_requested` notification type, the submitter can't tell which shard to fix.

**Why it happens:** The existing notification schema has `type`, `title`, `body`, `target_id`, and `target_url` — no structured shard metadata.

**How to avoid:** The notification `body` field carries the shard label + feedback string per the UI-SPEC copywriting contract (`"Reviewer rejected "{shard_label}" — {feedback}"`). This uses the existing `body` field, not a new notification type. The `target_url` should link to the submitter's "My Suggestions" page with the session pre-selected.

**Warning signs:** Submitter receives a generic "Changes requested" notification with no indication of which shard needs work.

---

## Code Examples

Verified patterns from existing codebase:

### Score Color Function (from SimilarConceptsPanel.tsx)
```typescript
// Source: components/editor/SimilarConceptsPanel.tsx line 14-18
function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}
```
Phase 16 reuses this exact pattern for both confidence badges (D-03) and candidate scores (D-05).

### Collapsible Panel Pattern (from SimilarConceptsPanel.tsx)
```typescript
// Source: components/editor/SimilarConceptsPanel.tsx lines 62-74
<button
  onClick={() => setIsExpanded(!isExpanded)}
  aria-expanded={isExpanded}
  aria-controls="similar-concepts-panel"
  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
>
  {isExpanded ? (
    <ChevronDown className="h-3 w-3" />
  ) : (
    <ChevronRight className="h-3 w-3" />
  )}
  Similar ({isLoading ? "..." : entities.length})
</button>
```
`SimilarEntitiesInlinePanel` uses this exact trigger pattern with "Similar existing entities ({count})" copy.

### Diff Line Rendering (from review/page.tsx)
```typescript
// Source: app/projects/[id]/suggestions/review/page.tsx lines 124-143
{file.patch.split("\n").map((line, idx) => {
  let bgClass = "";
  let textClass = "text-slate-700 dark:text-slate-300";

  if (line.startsWith("+") && !line.startsWith("+++")) {
    bgClass = "bg-green-50 dark:bg-green-900/20";
    textClass = "text-green-800 dark:text-green-300";
  }
  // ...
  return (
    <div key={idx} className={cn("px-4 py-0.5 font-mono whitespace-pre", bgClass, textClass)}>
      {line || " "}
    </div>
  );
})}
```
This is the render loop that needs extension to add `ProvenanceBadge` on addition lines.

### Tab Active State (from review/page.tsx)
```typescript
// Source: app/projects/[id]/suggestions/review/page.tsx lines 488-508
// Active tab: border-b-2 border-primary-500 text-primary-600
// Inactive: text-slate-500 hover:text-slate-700
className={cn(
  "px-4 py-2.5 text-sm font-medium transition-colors",
  activeTab === "summary"
    ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
)}
```
`ShardTabNavigator` uses this exact active-state pattern for consistency.

### Loading Skeleton Pattern
```typescript
// Source: SimilarConceptsPanel.tsx line 78; UI-SPEC DuplicateComparisonExpander section
<div className="h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single PR submit (no shards) | Batch submit with shard/commit structure (Phase 15) | Phase 15, 2026-04-07 | Shard tab navigator depends on this — Phase 16 must read shard data from Phase 15's batch-submit response |
| No provenance on suggestions | `provenance` + `confidence` fields on `GeneratedSuggestion` (Phase 13) | Phase 13, ~2026-04-05 | Fields already exist in both frontend types and backend schema — Phase 16 plumbs them to the review screen |
| Diff review was file-centric | Diff is still file-centric — Phase 16 adds entity/shard overlay without structural change | Phase 16 (this phase) | Shard filtering must work at hunk level, not file level |

---

## Backend Integration Points

### What Already Exists (verified by reading backend source)

| Endpoint | Method | File | Status |
|----------|--------|------|--------|
| `/{project_id}/suggestions/pending` | GET | `suggestions.py:122` | Live — returns `SuggestionSessionSummary[]` |
| `/{project_id}/suggestions/sessions/{id}/approve` | POST | `suggestions.py:135` | Live |
| `/{project_id}/suggestions/sessions/{id}/reject` | POST | `suggestions.py:149` | Live |
| `/{project_id}/suggestions/sessions/{id}/request-changes` | POST | `suggestions.py:164` | Live |
| `/{project_id}/pull-requests/{pr_number}/diff` | GET | `pull_requests.py` | Live — returns `PRDiffResponse` |
| `/{project_id}/pull-requests/{pr_number}/commits` | GET | `pull_requests.py:337` | Live — returns `PRCommitListResponse` with one commit per shard |

[VERIFIED: read `ontokit-api/ontokit/api/routes/suggestions.py` and `lib/api/pullRequests.ts` in this session]

### What Needs to Be Built (backend, per D-13/D-14/D-15)

| Endpoint | Method | Purpose | New Schema Needed |
|----------|--------|---------|-------------------|
| `/{project_id}/suggestions/sessions/{id}/detail` | GET | Returns enriched session data: entity metadata (provenance, confidence, duplicate_candidates), shard structure | `SessionDetailResponse` (new) |
| `/{project_id}/suggestions/sessions/{id}/shard-reviews` | POST | Stores per-shard approve/reject + feedback | `ShardReviewsRequest` (new) |
| `/{project_id}/suggestions/sessions/{id}/clean-pr` | POST | (Stretch, D-16) Regenerates PR from approved shard entities | `CleanPRRequest` (new) |

**Critical question for backend:** Where is per-entity provenance/confidence stored after batch-submit? The `GeneratedSuggestion` type (with provenance and confidence) exists in the generation pipeline, but is it persisted to the database at submit time or is it ephemeral (only in the LLM response)? If ephemeral, the enriched session detail endpoint cannot return it. [ASSUMED] — This is the most important open question for Phase 16 backend planning.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Entity-to-line attribution will use a client-side Turtle subject-declaration scanner | Architecture Patterns: Pattern 2 | If backend annotates the diff with entity boundaries directly (preferred), the client-side scanner approach is unnecessary and should be dropped |
| A2 | The enriched session detail endpoint (`/detail`) does not yet exist on the backend | Backend Integration Points | If it already exists from Phase 15 work, Wave 0 stub creation is not needed for that endpoint |
| A3 | Per-entity provenance/confidence data is persisted at batch-submit time and is available to the detail endpoint | Backend Integration Points | If provenance/confidence is ephemeral (only in LLM response, not stored), the enriched detail endpoint cannot return it — requires a schema change or a different data model |
| A4 | Shard tab filtering operates at the hunk level within a single Turtle file | Architecture Patterns: Pattern 3 | If batch-submitted PRs produce separate files per shard (e.g., by using separate namespaces), file-level filtering works and hunk-level filtering is not needed |
| A5 | Per-shard marks are sent to a new endpoint before the PR-level action | Architecture Patterns: Pattern 4 | If the backend prefers a combined "review session with shard metadata" payload, the separate `postShardReviews` call is not needed |
| A6 | The `PRCommitListResponse` from the existing commit list endpoint provides enough commit message metadata to identify which commit corresponds to which shard (via the shard ID embedded in the commit body per Phase 15 D-10) | Backend Integration Points | If shard IDs are not in commit messages, a separate mapping must be provided by the enriched detail endpoint |

---

## Open Questions

1. **Where is per-entity provenance stored after batch-submit?**
   - What we know: `GeneratedSuggestion.provenance` and `.confidence` exist in the generation response (Phase 13). The suggestion session `save` endpoint stores Turtle content but not entity-level metadata.
   - What's unclear: Whether the batch-submit pipeline persists provenance/confidence per entity IRI to a DB table, or whether that data is lost after generation.
   - Recommendation: This is Wave 0 for the backend — if provenance is not persisted, backend needs a new table (`suggestion_entity_metadata`) before the enriched detail endpoint can be built. Frontend planning should account for this as a potential Wave 1 blocker.

2. **Does the existing `PRCommitListResponse` include enough data to correlate commits to shards?**
   - What we know: Phase 15 D-10 specifies hybrid commit messages with shard metadata in the commit body. `PRCommitListResponse` returns `PRCommit[]` with `message` field.
   - What's unclear: Whether the shard ID is in the commit message and whether the frontend can parse it reliably.
   - Recommendation: If shard ID is in the commit body, the frontend can build the shard tab navigator from `pullRequestsApi.getCommits()` without a new enriched endpoint. This would simplify D-14 significantly.

3. **What is the source of duplicate_candidates at review time?**
   - What we know: `GeneratedSuggestion.duplicate_candidates` has `iri`, `label`, `score`. These come from the duplicate detection pipeline at generation time.
   - What's unclear: Are these stored per entity at submit time, or recomputed on-demand at review time?
   - Recommendation: Recomputing at review time is expensive (ANN search per entity); storing at submit time is preferred. If stored, they come from the persisted entity metadata table (same question as #1 above).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 16 is a code-only frontend extension with no new external CLI tools, databases, or services. All dependencies (Next.js, React, TypeScript, existing API) are already running.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

[VERIFIED: ran `npm run test -- --run` successfully in this session — 16 passed, 2 skipped, 140 tests, 1.25s]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVIEW-01 | DiffView renders patch lines for LLM suggestions identically to human-written | unit | `npm run test -- --run __tests__/components/suggestions/provenanceBadge.test.ts` | ❌ Wave 0 |
| REVIEW-02 | SimilarEntitiesInlinePanel only renders when candidates exist with score > 0.40 | unit | `npm run test -- --run __tests__/components/suggestions/provenanceBadge.test.ts` | ❌ Wave 0 |
| REVIEW-03 | ProvenanceBadge renders correct icon/label for each provenance value | unit | `npm run test -- --run __tests__/components/suggestions/provenanceBadge.test.ts` | ❌ Wave 0 |
| REVIEW-04 | ProvenanceBadge renders confidence % when available, dash when null | unit | `npm run test -- --run __tests__/components/suggestions/provenanceBadge.test.ts` | ❌ Wave 0 |
| REVIEW-05 | ShardTabNavigator renders "All" + per-shard tabs; shard filter produces correct entity subset | unit | `npm run test -- --run __tests__/components/suggestions/shardTabNavigator.test.ts` | ❌ Wave 0 |
| — | New API methods (getSessionDetail, postShardReviews) call correct endpoints | unit | `npm run test -- --run __tests__/lib/api/suggestionDetailApi.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/components/suggestions/provenanceBadge.test.ts` — covers REVIEW-01, REVIEW-03, REVIEW-04
- [ ] `__tests__/components/suggestions/shardTabNavigator.test.ts` — covers REVIEW-05
- [ ] `__tests__/lib/api/suggestionDetailApi.test.ts` — covers new API methods

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (all endpoints already require `RequiredUser`) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes — `canReview` check already in review page | `project.user_role in [owner, admin, editor, superadmin]` |
| V5 Input Validation | yes — per-shard feedback text | max 500 chars (UI-SPEC); backend should validate `reason` min_length per existing `SuggestionRejectRequest` pattern |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reviewer submitting shard marks for sessions they don't own | Spoofing | Backend `RequiredUser` + project role check (same as existing approve/reject) |
| XSS in shard feedback textarea | Tampering | React renders all text content as text nodes (not `dangerouslySetInnerHTML`) — no additional action needed |
| Confidence score spoofing in enriched detail response | Tampering | Backend computes and stores confidence; frontend reads it read-only — no client-side override |

---

## Sources

### Primary (HIGH confidence)

- Read `app/projects/[id]/suggestions/review/page.tsx` — full review page structure, DiffView component, tab pattern, action bar
- Read `lib/api/generation.ts` — `GeneratedSuggestion`, `Provenance`, `DuplicateCandidate` types
- Read `lib/api/suggestions.ts` — all suggestion session API methods, `ClusterShard`, `ClusterPRGroup` types
- Read `lib/api/pullRequests.ts` — `PRDiffResponse`, `PRFileChange`, `PRCommitListResponse` types
- Read `lib/stores/shardPreviewStore.ts` — `ShardDefinition`, `PRGroupDefinition` types
- Read `components/editor/SimilarConceptsPanel.tsx` — `scoreColor()`, collapsible panel pattern, candidate rendering
- Read `components/suggestions/ShardPreviewModal.tsx` — shard tab/navigation pattern from Phase 15
- Read `lib/api/notifications.ts` — `NotificationType`, notification dispatch pattern
- Read `lib/ontology/qualityTypes.ts` — `DuplicateCluster` type
- Read `ontokit-api/ontokit/api/routes/suggestions.py` — all existing backend suggestion endpoints (192 lines, 10 routes)
- Read `ontokit-api/ontokit/schemas/generation.py` — `GeneratedSuggestion`, `Provenance`, `GenerateSuggestionsResponse`
- Read `ontokit-api/ontokit/schemas/suggestion.py` — `SuggestionSessionSummary`, review request schemas
- Read `.planning/phases/16-reviewer-enhancements/16-UI-SPEC.md` — component inventory, spacing, color, ARIA contracts
- Read `.planning/phases/16-reviewer-enhancements/16-CONTEXT.md` — all locked decisions D-01 through D-16
- Ran `npm run test -- --run` — test suite passing (140 tests, 1.25s)

### Secondary (MEDIUM confidence)

- Read `.planning/phases/15-session-clustering-batch-submit/15-CONTEXT.md` — shard/commit structure, D-10 hybrid commit messages
- Read `lib/stores/shardPreviewStore.ts` — confirmed `ShardDefinition` type with `entityIris`, `label`, `id` fields

### Tertiary (LOW confidence / ASSUMED)

- Entity-to-line attribution strategy (client-side Turtle scanner vs. backend-annotated diff) — inferred from domain constraints, not verified against backend plan
- Per-entity metadata persistence model — not verified by reading backend service layer
- Hunk-level shard filtering implementation — inferred from single-file ontology constraint

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified present in project; zero new dependencies
- Architecture: MEDIUM — component boundaries and API surface clear; two assumptions about backend data model (A2, A3) could redirect implementation
- Pitfalls: HIGH — all identified pitfalls are grounded in reading actual code (the existing DiffView, the single-file Turtle model, the React state lifecycle)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack; the main risk is backend implementation choices for the enriched session endpoint)
