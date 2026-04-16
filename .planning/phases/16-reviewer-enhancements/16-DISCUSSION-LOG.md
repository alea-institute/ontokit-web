# Phase 16: Reviewer Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 16-reviewer-enhancements
**Areas discussed:** Provenance & confidence display, Similar-entities panel design, Batch/shard navigation in review, Data flow & API surface

---

## Provenance & Confidence Display

### Q1: Where should provenance badges appear in the review diff view?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-line in diff | Each added line gets a small provenance tag (sparkle for LLM, pen for human, pencil for edited). Reviewer sees provenance at the granularity of individual triples. | ✓ |
| Per-entity section header | Each entity block in the diff gets a provenance + confidence header line. Individual triple lines are unmarked. Less visual noise but coarser granularity. | |
| Summary badge per file/shard | One badge per shard showing the mix (e.g., '4 LLM / 1 edited / 0 human'). Minimal UI change but reviewer can't tell which specific suggestions are LLM vs human. | |

**User's choice:** Per-line in diff (recommended), with person emoji (👤) for human instead of pen emoji.
**Notes:** Icon set: ✨ llm-proposed, ✏️ user-edited-from-llm, 👤 user-written. Confidence percentage inline when available, dash when not.

### Q2: How should confidence scores be color-coded?

| Option | Description | Selected |
|--------|-------------|----------|
| Green/amber/red thresholds | Match Phase 14 convention: green >=80%, amber >=60%, red <60%. Consistent with existing suggestion card confidence badges. | ✓ |
| Gradient opacity | Higher confidence = more opaque badge, lower = more transparent. Smooth visual but harder to distinguish exact ranges. | |
| No color coding | Just show the number. Let the reviewer interpret significance themselves. Simplest implementation. | |

**User's choice:** Green/amber/red thresholds (recommended)
**Notes:** Matches Phase 14 convention for consistency.

---

## Similar-Entities Panel Design

### Q3: How should duplicate-detection results appear in the review view?

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible per-entity | Each entity in the diff gets a collapsible 'Similar existing entities' section showing top duplicate candidates with scores. Only appears when candidates exist. | ✓ |
| Sidebar panel | A fixed right sidebar shows duplicate candidates for whichever entity the reviewer is currently hovering/focusing. Always visible, updates as you scroll. | |
| Inline warning banner only | Only show duplicate info when composite score exceeds warning threshold (>0.80). No panel for low-score matches. | |

**User's choice:** Collapsible per-entity (recommended)
**Notes:** Reuses SimilarConceptsPanel color-coding convention.

### Q4: Should clicking a duplicate candidate do anything?

| Option | Description | Selected |
|--------|-------------|----------|
| Open in new tab | Clicking opens entity's detail page in a new browser tab. | |
| Expand inline diff comparison | Clicking shows side-by-side comparison of new entity vs existing candidate right in the review page. | ✓ |
| No action, info only | Candidates are purely informational. | |

**User's choice:** Expand inline diff comparison
**Notes:** Two-column layout showing labels, comments, annotations, parents. Highlights matching/differing fields.

### Q5: What should the inline comparison show?

| Option | Description | Selected |
|--------|-------------|----------|
| Labels + annotations side-by-side | Two-column layout: new entity (left) vs existing candidate (right). Shows labels, comments, annotations, parents. | ✓ |
| Full Turtle source comparison | Raw Turtle source blocks for both entities. More complete but noisier. | |
| Just labels and score | Minimal: both labels, similarity score, parent classes. | |

**User's choice:** Labels + annotations side-by-side (recommended)
**Notes:** Compact and focused on what matters for duplicate judgment.

---

## Batch/Shard Navigation in Review

### Q6: How should reviewers navigate batch PRs with multiple shard-commits?

| Option | Description | Selected |
|--------|-------------|----------|
| Shard tabs in OntoKit | Review page shows shard navigator bar above diff. Each shard is a tab with label + entity count. Clicking filters diff. | ✓ |
| Defer to GitHub commit tab | Per REVIEW-05, GitHub's commit tab serves as shard navigator. OntoKit shows full PR diff without shard filtering. | |
| Collapsible shard sections | Diff organized into accordion sections per shard. | |

**User's choice:** Shard tabs in OntoKit (recommended)
**Notes:** Consistent with ShardPreviewModal's navigation pattern.

### Q7: Should reviewers be able to approve/reject individual shards, or only the whole PR?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole PR only | Approve/reject applies to entire PR. Shard tabs for navigation only. | |
| Per-shard approve/reject | Each shard has own controls. PR approved when all shards approved. | |
| Per-shard with cherry-pick | Approve individual shards, reject others. Approved shards cherry-picked into new PR. | ✓ |

**User's choice:** Per-shard with cherry-pick
**Notes:** User wanted detailed analysis of implementation approaches before deciding on the specific cherry-pick mechanism.

### Q8: Which cherry-pick approach for per-shard review?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create clean PR | Backend auto-generates new PR from approved shards. Clean but two PRs, requires Turtle source regeneration. | |
| Merge approved, PR stays open | Immediate partial merge, PR rebased. Single thread but force-push risk. | |
| Mark + manual button | Per-shard approve/reject as metadata. Optional 'Create clean PR' button. Ship marking first, automate later. | ✓ |

**User's choice:** Mark + manual button (recommended)
**Notes:** Detailed analysis of all three approaches was provided. Key insight: literal git cherry-pick won't work because all entities share one Turtle source file — backend must regenerate source from approved entities. User chose incremental approach: ship metadata first, automate later.

---

## Data Flow & API Surface

### Q9: How should provenance/confidence/duplicate data reach the review page?

| Option | Description | Selected |
|--------|-------------|----------|
| Enrich existing session endpoint | Extend listPending/getSession API to return per-entity metadata alongside diff. One API call. | ✓ |
| Separate per-entity endpoint | Review page loads session, then N additional API calls per entity. Zero changes to session API. | |
| Embed in diff comments | Backend embeds metadata as structured comments in Turtle diff. Frontend parses from diff text. | |

**User's choice:** Enrich existing session endpoint (recommended)
**Notes:** Single response includes entities array with iri, provenance, confidence, duplicate_candidates.

### Q10: Where does existing entity data come from for duplicate comparison?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy-load on expand | Show IRI + score initially. Fetch full entity details when reviewer clicks to expand comparison. | ✓ |
| Pre-load all candidate data | Backend returns full details for every candidate in enriched response. | |
| Link to entity page only | Just show IRI, score, and link. No inline comparison. | |

**User's choice:** Lazy-load on expand (recommended)
**Notes:** Avoids loading data for candidates the reviewer never inspects.

---

## Claude's Discretion

- Shard tab styling and overflow behavior
- Animation when switching shard tabs
- Side-by-side comparison handling for entities with many annotations
- Loading state for lazy-fetched duplicate details
- When "Create clean PR" button appears
- Per-shard feedback input design

## Deferred Ideas

None — discussion stayed within phase scope
