# Phase 16: Reviewer Enhancements - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add LLM-specific affordances to the existing suggestion review page: provenance badges, confidence scores, duplicate-detection context alongside the diff view, shard-level navigation for batch PRs, and per-shard review annotations. No new reviewer page is built — these requirements extend the existing approve/reject/request-changes workflow at `app/projects/[id]/suggestions/review/page.tsx`.

</domain>

<decisions>
## Implementation Decisions

### Provenance & Confidence Display
- **D-01:** Per-line provenance badges in the diff view. Each added line gets an icon: ✨ for `llm-proposed`, ✏️ for `user-edited-from-llm`, 👤 for `user-written`.
- **D-02:** Confidence percentage displayed inline next to the provenance icon when available, dash when not.
- **D-03:** Confidence color-coded with green/amber/red thresholds matching Phase 14 convention: green >= 80%, amber >= 60%, red < 60%.

### Similar-Entities Panel
- **D-04:** Collapsible per-entity "Similar existing entities" section in the diff view. Shows top duplicate candidates with composite scores. Only appears when candidates exist (score > 0.40).
- **D-05:** Candidate score color-coding reuses existing SimilarConceptsPanel convention: green >= 80%, amber >= 60%, slate < 60%.
- **D-06:** Clicking a duplicate candidate expands an inline side-by-side comparison: two-column layout with new entity (left) vs existing candidate (right) showing labels, comments, annotations, and parent classes. Highlights matching/differing fields.
- **D-07:** Existing entity data for comparison is lazy-loaded on expand — not pre-fetched. Avoids loading data for candidates the reviewer never inspects.

### Batch/Shard Navigation in Review
- **D-08:** Shard tab navigator bar above the diff view. Each shard is a tab showing its label + entity count. "All" tab shows everything. Clicking a shard filters the diff to that shard's entities.
- **D-09:** Per-shard approve/reject as review metadata — reviewer can mark individual shards as approved or rejected with optional feedback text per shard.
- **D-10:** Whole-PR approve/reject/request-changes remains the primary action. Per-shard marking is additive metadata, not a replacement.
- **D-11:** Optional "Create clean PR" button — when some shards are rejected, this generates a new PR from only the approved shard-commits. Backend regenerates Turtle source from approved entities (not literal git cherry-pick, since all entities share the same source file). This is a stretch goal — per-shard marking ships first.
- **D-12:** Rejected shards generate a "changes requested" notification to the submitter with shard-specific feedback.

### Data Flow & API Surface
- **D-13:** Enrich existing session detail endpoint to return per-entity metadata: provenance tag, confidence score, and duplicate_candidates (IRI + label + composite score) alongside the existing diff data.
- **D-14:** Shard/commit structure returned in the enriched response so the frontend can build the shard tab navigator without additional API calls.
- **D-15:** Per-shard review decisions stored via a new endpoint (e.g., `POST /suggestions/{session_id}/shard-reviews`) that accepts shard-level approve/reject/feedback.
- **D-16:** "Create clean PR" button triggers a backend endpoint that regenerates a PR from approved shard entities only.

### Claude's Discretion
- Exact shard tab styling and overflow behavior when many shards exist
- Animation when switching between shard tabs
- How the side-by-side duplicate comparison handles entities with many annotations (scroll vs truncate)
- Loading state design while lazy-fetching duplicate candidate details
- Whether the "Create clean PR" button appears immediately or only after the reviewer has marked at least one shard as rejected
- Per-shard feedback input design (inline textarea vs dialog)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — REVIEW-01 through REVIEW-05

### Prior Phase Artifacts
- `.planning/phases/15-session-clustering-batch-submit/15-CONTEXT.md` — Shard/PR structure (D-05 through D-19), commit message format, branch naming
- `.planning/phases/14-inline-suggestion-ux-property-support/14-CONTEXT.md` — Suggestion card design (D-01 through D-04), sparkle icon convention, confidence badge design
- `.planning/phases/13-validation-guardrails-suggestion-generation/13-CONTEXT.md` — Generation pipeline, validation rules

### Existing Frontend Components
- `app/projects/[id]/suggestions/review/page.tsx` — Current review page (diff view, approve/reject/request-changes, session list)
- `components/suggestions/RejectSuggestionDialog.tsx` — Reject dialog pattern
- `components/suggestions/RequestChangesDialog.tsx` — Request changes dialog pattern
- `components/suggestions/ShardPreviewModal.tsx` — Shard preview UI (tab/navigation patterns to reuse)
- `components/editor/SimilarConceptsPanel.tsx` — Similar entities display with score color-coding (reusable pattern)
- `lib/ontology/qualityTypes.ts` — DuplicateCluster type definition

### API Layer
- `lib/api/suggestions.ts` — Suggestion session CRUD, review methods (approve, reject, requestChanges, listPending)
- `lib/api/generation.ts` — GeneratedSuggestion type with provenance, confidence, duplicate_verdict, duplicate_candidates fields
- `lib/stores/shardPreviewStore.ts` — Shard/PR group store (ShardDefinition, PRGroupDefinition)

### Backend Context
- `../ontokit-api/ontokit/api/routes/suggestions.py` — Suggestion review endpoints to extend
- `../ontokit-api/ontokit/schemas/generation.py` — GeneratedSuggestion Pydantic schema (provenance, confidence)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SimilarConceptsPanel`: Displays similar entities with score color-coding (green/amber/slate) — pattern for the duplicate comparison in review
- `ShardPreviewModal`: Shard tab navigation, collapsible PR groups — pattern for the shard navigator bar in review
- `RejectSuggestionDialog` / `RequestChangesDialog`: Dialog patterns for feedback input — extend for per-shard feedback
- `GeneratedSuggestion` type in `lib/api/generation.ts`: Already has `provenance`, `confidence`, `duplicate_verdict`, `duplicate_candidates` fields — the data model exists, just needs to flow to the review page

### Established Patterns
- Review page uses `pullRequestsApi.getDiff()` for patch content, renders line-by-line with syntax highlighting
- React Query for server state, Zustand for client state
- Dark mode via Tailwind class-based (darkMode: "class")
- Role-based access: review page requires owner/admin/editor/superadmin

### Integration Points
- Enriched session endpoint response needs to include entity-level metadata (provenance, confidence, duplicates)
- Diff renderer needs extension to annotate individual lines with provenance badges and confidence scores
- Shard tab navigator connects to the shard/commit structure in the enriched response
- Per-shard review decisions need a new API endpoint and corresponding frontend state
- Notification system needs shard-level feedback routing to submitter

</code_context>

<specifics>
## Specific Ideas

- Per-line provenance badges make the reviewer's job easier — they can instantly see which parts of a suggestion are machine-generated vs human-curated, at the granularity of individual triples.
- The inline side-by-side duplicate comparison keeps the reviewer in flow — no tab-switching to GitHub or entity pages to check if something is truly a duplicate.
- Shard tabs mirror the ShardPreviewModal's navigation pattern, keeping the UX consistent between submitter (preview) and reviewer (review).
- Per-shard marking as metadata is the pragmatic first step — it provides structured feedback even without the "Create clean PR" automation. The automation can be added incrementally once the review metadata model is solid.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-reviewer-enhancements*
*Context gathered: 2026-04-08*
