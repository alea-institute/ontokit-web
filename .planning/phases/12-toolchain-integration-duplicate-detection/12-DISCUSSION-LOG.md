# Phase 12: Toolchain Integration & Duplicate Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 12-toolchain-integration-duplicate-detection
**Areas discussed:** Duplicate scoring strategy, ANN index rebuild trigger, folio-python integration depth, Embedding scope & freshness, Rejection metadata model, Embedding provider selection, Duplicate check API contract

---

## Duplicate Scoring Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted average | Exact label (40%), semantic (40%), structural (20%). Simple, tunable, explainable. | ✓ |
| Cascading gates | Each signal independently blocks/warns. No composite number. | |
| Max of signals | Highest score from any signal triggers block/warn. | |

**User's choice:** Weighted average
**Notes:** Existing rank_suggestions() cosine similarity can be extended.

---

## ANN Index Rebuild Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook from git | Post-merge webhook calls API endpoint, enqueues rebuild job. | ✓ |
| Background poller | Worker polls git for new commits every N minutes. | |
| Inline on merge API | Merge endpoint triggers re-indexing directly. | |

**User's choice:** Webhook from git
**Notes:** Existing worker.py already processes embedding jobs.

---

## folio-python Integration Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Structural similarity only | Parent/sibling queries only. Keep consistency in existing service. | ✓ |
| Full toolchain | Structural + definition extraction + graph traversal + consistency. | |
| Skip folio-python entirely | Build structural from existing SQL index. | |

**User's choice:** Structural similarity only
**Notes:** Minimal dependency, focused integration.

---

## Embedding Scope & Freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental + full rebuild | Full on setup, diff-based after merges, periodic full rebuild. | ✓ |
| Full rebuild every time | Re-embed all 18K+ after every merge. | |
| Lazy on-demand | Only embed when first queried. | |

**User's choice:** Incremental + full rebuild, plus startup health check that auto-detects if rebuild needed and runs in background.

### Branch Scope Sub-discussion

| Option | Description | Selected |
|--------|-------------|----------|
| All branches | Index entities across all branches including rejected suggestions. | ✓ |
| Main + active suggestions | Main branch plus active/submitted suggestion sessions. | |
| Main branch only | Only merged content. | |

**User's choice:** All branches — including rejected suggestions. Rationale: (1) catches parallel work collisions, (2) surfaces prior rejection rationale to new users proposing the same duplicate, (3) admin rejections create canonical links to direct future users.

---

## Rejection Metadata Model

| Option | Description | Selected |
|--------|-------------|----------|
| Database table | New `duplicate_rejections` table with rejection reason, canonical link. | ✓ |
| Annotation on suggestion | Metadata on existing suggestion session record. | |
| RDF annotation in source | owl:sameAs annotation in Turtle source. | |

**User's choice:** Database table
**Notes:** Queryable, fast lookup, survives branch deletion.

---

## Embedding Provider Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Independent (existing pattern) | Separate from LLM provider, existing EmbeddingConfig. | ✓ |
| Reuse LLM provider | Derive from project LLM config. | |
| System-level default | One embedding provider for all projects. | |

**User's choice:** Independent — keep existing pattern.

---

## Duplicate Check API Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Full breakdown | Verdict, composite score, score breakdown, rich candidates with source/rejection history. | ✓ |
| Verdict only | Just block/warn/pass + top candidate IRI. | |
| Score + candidates | Score and candidates, no verdict. | |

**User's choice:** Full breakdown
**Notes:** Callers get everything to render rich UI showing why something was flagged.

---

## Claude's Discretion

- Exact folio-python API integration approach
- Incremental diff detection strategy
- Webhook endpoint authentication
- Embedding text builder strategy
- Background job queue implementation

## Deferred Ideas

None
