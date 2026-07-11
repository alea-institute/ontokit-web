---
title: Shard-Preview / Reviewer-Tools Subsystem — Joint API + Web Feature Design
type: feature-design
status: draft (design only — endpoints NOT yet built)
owner: Damien Riehl
created: 2026-07-10
supersedes-context: llm-node-expansion 8-PR drain PR-6 (shard UI deferred on phantom-endpoint discovery)
repos: ontokit-api (5 endpoints) + ontokit-web (shard UI, already prototyped on `origin/llm-helper`)
---

# Shard-Preview / Reviewer-Tools Subsystem — Feature Design

## Why this doc exists

During the 8-PR llm-node-expansion drain (2026-07-07, Lane-4 session 8) the web
"shard-preview + reviewer tools" UI (lineage phases 15/16, ~2.5k lines, 23 commits)
was extracted and conflict-resolved — then **deferred**, because it calls **five
API endpoints that were never implemented in any api branch**:

```
POST /api/v1/projects/{project_id}/suggestions/sessions/{session_id}/cluster
POST /api/v1/projects/{project_id}/suggestions/sessions/{session_id}/batch-submit
GET  /api/v1/projects/{project_id}/suggestions/sessions/{session_id}/detail
POST /api/v1/projects/{project_id}/suggestions/sessions/{session_id}/shard-reviews
POST /api/v1/projects/{project_id}/suggestions/sessions/{session_id}/clean-pr
```

Shipping the UI without the backend would break the rollout plan's own gate
("backend confirmed deployed for any PR that needs it"). This document specifies
the five endpoints — contracts, auth, pagination, persistence — so a future
session can build **api first, then web** as a coherent joint feature PR.

**Scope of this doc:** design only. It builds nothing. The web client and
component tree already exist on `origin/llm-helper` (`lib/api/suggestions.ts`
lines ~104–210 for types, ~385–460 for the client; `components/suggestions/Shard*`,
`lib/stores/shardPreviewStore.ts`, `lib/hooks/useShardDragDrop.ts`). The api side
is greenfield.

## Feature summary

A suggestion **session** accumulates AI-proposed (or human-proposed) ontology
entities. When a reviewer is ready to turn a session into pull requests, the
subsystem lets them:

1. **Cluster** the session's entities into *shards* (semantically coherent groups
   by ancestor path) and *PR groups* (one PR per group) — a proposed plan, no
   side effects. Reviewers can drag entities between shards (client-side) before
   committing.
2. **Batch-submit** the plan — create one PR per PR group.
3. Open an enriched **detail** view (per-entity provenance, confidence, and
   duplicate candidates + the shard structure) to review before deciding.
4. Record per-shard **review marks** (approve / reject + feedback) as additive
   metadata, independent of the PR-level decision.
5. (Stretch) mint a **clean PR** containing only the approved shards' entities.

## Existing building blocks to reuse (do NOT reinvent)

- **Session model + suggestion items** — `SuggestionSession` and its items exist
  (PR-5 `suggestion-generation`).
- **Per-entity provenance** — the PROV-O provenance shape (PR-5/PR-6) is the
  source for `EntityReviewMetadata.provenance`.
- **Duplicate candidates** — the composite duplicate-check response
  (`DuplicateCheckResponse`, PR-6 `reviewer-tools`) is the source for
  `EntityReviewMetadata.duplicate_candidates`. `/detail` composes these; it does
  not define new dedup logic.
- **PR creation** — `PullRequestService` (git bare-repo PR workflow) backs
  `batch-submit` and `clean-pr`.
- **Role gates** — reuse the LLM/role gating already in the stack for the write
  endpoints (see Auth below).

---

## Shared conventions

- **Base path:** every endpoint is nested under an existing, access-gated
  session: `/api/v1/projects/{project_id}/suggestions/sessions/{session_id}/…`.
- **Auth:** `Authorization: Bearer <token>` on all five (the web client passes a
  token explicitly — this is authenticated-reviewer-only; no anonymous/optional
  path). Resolve the caller with `RequiredUser`.
- **Access gate (in this order), before any work:**
  1. `project_id` exists and the caller is a project member → else 404 (do not
     disclose existence).
  2. `session_id` belongs to `project_id` → else 404.
  3. Role check:
     - `cluster`, `detail` → any member who can view suggestions
       (`viewer`+ if suggestions are visible to viewers; otherwise `suggester`+).
     - `shard-reviews`, `batch-submit`, `clean-pr` → **reviewer rights**
       (`owner` / `admin` / `editor`, i.e. whoever may create PRs / act on a
       session). Reuse the same gate the existing session approve/reject/
       request-changes routes use — these new writes must not be looser.
- **Errors:** `400` invalid body / empty plan; `401` unauthenticated; `403`
  insufficient role; `404` project-or-session not found or not a member; `409`
  session in a non-submittable state (already submitted / closed); `422`
  validation. Never leak provider text or internal detail.
- **Auditing:** the three write endpoints (`batch-submit`, `shard-reviews`,
  `clean-pr`) write a metadata-only audit entry (actor, session, counts, PR
  numbers) — no entity payloads.
- **Idempotency:** `batch-submit` and `clean-pr` create git branches + PRs and
  MUST be safe to retry — see each endpoint.

---

## Endpoint contracts

### 1. `POST …/cluster` — propose a shard plan (read-only compute)

Groups the supplied suggestion items into shards and PR groups. Pure computation
over the session — **no persistence, no git side effects**. Safe to call
repeatedly (e.g. after a reviewer moves entities in the UI and re-clusters).

Request `ClusterRequest`:
```jsonc
{
  "suggestion_items": [
    { "entity_iri": "…", "parent_iri": "… | null", "suggestion_type": "class|property|…", "label": "…" }
  ]
}
```
Response `ClusterResponse`:
```jsonc
{
  "pr_groups": [
    { "id": "pg-…", "shards": [
      { "id": "shard-…", "label": "…", "ancestor_path": ["…"],
        "entity_iris": ["…"], "is_misc": false, "is_cross_cutting": false }
    ]}
  ],
  "total_suggestions": 0, "total_shards": 0, "total_prs": 0,
  "skip_clustering": false   // true when the session is small enough to be one PR
}
```
Design notes:
- **Deterministic shard `id`s** (e.g. stable hash of `ancestor_path` within the
  session). This is load-bearing: `shard-reviews` and `clean-pr` reference shard
  ids, so re-clustering the same items must yield the same ids. Document the hash
  input so the UI's client-side drag-drop can predict ids or the server returns
  them authoritatively (prefer server-authoritative).
- Clustering algorithm (ancestor-path grouping, `is_misc` catch-all,
  `is_cross_cutting` for entities under multiple ancestors) is specified in the
  lineage phase-15 plan — port it; do not redesign.
- **Bounds (no pagination — bounded input):** cap `suggestion_items` (e.g. ≤2000)
  → 422 above the cap. Clustering is O(n) over session entities.

### 2. `POST …/batch-submit` — one PR per PR group (side-effecting)

Creates a pull request per PR group from the (possibly reviewer-edited) plan.

Request `BatchSubmitRequest`:
```jsonc
{
  "pr_groups": [
    { "shards": [ { "id": "shard-…", "label": "…", "entity_iris": ["…"] } ] }
  ],
  "notes": "optional PR-description note"
}
```
Response `BatchSubmitResponse`:
```jsonc
{
  "results": [
    { "pr_group_index": 0, "pr_number": 12, "pr_url": "…|null",
      "github_pr_url": "…|null", "status": "success|failed", "error": "…?" }
  ],
  "succeeded": 1, "failed": 0
}
```
Design notes:
- **Partial success is a first-class outcome** — return 200 with per-group
  `status`; do not fail the whole batch if one PR errors. (The response already
  models this.)
- **Idempotency:** accept an `Idempotency-Key` header; persist created-PR refs
  keyed by (session, key) so a retry returns the same results instead of minting
  duplicate PRs. Also refuse to batch-submit a session already in a submitted
  state (409).
- Each PR is built via `PullRequestService` from the shard's `entity_iris`
  (resolved against the session branch). Validate every iri belongs to the
  session → 422 on a stray iri.
- Transition the session to a `submitted` state on full/partial success; record
  which shards went into which PR (needed by `clean-pr` and the detail view).

### 3. `GET …/detail` — enriched review payload (paginated)

Returns per-entity review metadata plus the shard structure. This is the endpoint
that can be **large** (a session may hold hundreds of entities, each with
provenance + duplicate candidates), so it is **paginated**.

Query params: `?limit=50&cursor=<opaque>` (default limit 50, max 200).

Response `SessionDetailResponse`:
```jsonc
{
  "session_id": "…",
  "entities": [
    { "entity_iri": "…", "entity_label": "…", "shard_id": "shard-…",
      "shard_label": "…",
      "provenance": { /* PROV-O provenance from PR-5/PR-6 */ },
      "confidence": 0.0,
      "duplicate_candidates": [ /* DuplicateCandidate[] from PR-6 */ ] }
  ],
  "shards": [ { "id": "shard-…", "label": "…", "entity_iris": ["…"] } ],
  "next_cursor": "… | null"   // ADD to the lineage type: null on the last page
}
```
Design notes:
- **Pagination applies to `entities` only.** `shards` is small (bounded by shard
  count) — return the full shard list on every page (or on the first page and
  omit thereafter; prefer returning it every page for a stateless client). The
  lineage TS type lacks `next_cursor` — add it when building (web change is
  additive).
- Cursor = opaque, stable ordering (e.g. `(shard_id, entity_iri)`). Do not use
  offset pagination (entities can shift between calls).
- `duplicate_candidates` is computed via the existing duplicate-check service —
  budget it (top-k per entity, e.g. k≤5) so a large session doesn't fan out into
  thousands of ANN searches; consider precomputing at cluster time and caching on
  the session.

### 4. `POST …/shard-reviews` — record per-shard marks (idempotent upsert)

Stores approve/reject + optional feedback per shard as **additive metadata**,
independent of any PR-level decision. Called before or alongside the PR action.

Request `ShardReviewsRequest`:
```jsonc
{ "marks": [ { "shard_id": "shard-…", "status": "approved|rejected", "feedback": "optional" } ] }
```
Response: `204 No Content`.
Design notes:
- **Idempotent upsert** keyed by (session_id, shard_id, reviewer): re-posting a
  shard's mark overwrites it. Validate every `shard_id` belongs to the session's
  current plan → 422 otherwise.
- Requires a persistence table (see Data model). This is what makes the shard ids
  need to be stable (see `cluster`).
- Records the reviewer identity + timestamp for the audit trail.

### 5. `POST …/clean-pr` — PR from approved shards only (stretch, side-effecting)

Creates one new PR containing only the entities from the approved shards. Only
meaningful after `shard-reviews` marks exist (D-11 / D-16 stretch goal).

Request `CleanPRRequest`:
```jsonc
{ "approved_shard_ids": ["shard-…", "shard-…"] }
```
Response `CleanPRResponse`:
```jsonc
{ "pr_number": 13, "pr_url": "…|null", "github_pr_url": "…|null" }
```
Design notes:
- Validate each id is (a) in the session plan and (b) marked `approved` in
  `shard-reviews` → 409/422 if a supplied shard isn't approved. This prevents a
  "clean" PR from smuggling in un-reviewed entities.
- Same idempotency + audit requirements as `batch-submit`.

---

## Data model additions (api)

Minimal new persistence — most is compute-on-demand:

- **`suggestion_shard_reviews`** (backs endpoint 4): `id`, `session_id` (FK),
  `shard_id` (the deterministic id), `reviewer_id`, `status`
  (`approved`/`rejected`), `feedback` (text, nullable), `created_at`, `updated_at`.
  Unique on (`session_id`, `shard_id`, `reviewer_id`).
- **Submitted-shard→PR mapping** (backs `batch-submit` idempotency + `clean-pr`):
  either a `suggestion_shard_submissions` table (`session_id`, `shard_id`,
  `pr_number`, `idempotency_key`) or a JSON column on the session. A table is
  cleaner for querying "which shards are already in a PR."
- Session gains a submit-state enum if it lacks one (`draft` → `submitted` →
  `closed`) to gate re-submission (409 semantics above).
- **One Alembic migration**, single head. No change to existing suggestion tables
  beyond the optional state column.

Clustering output (`cluster`) is **not** persisted — it is recomputed from the
session each call; only reviewer marks and PR mappings persist. If clustering
proves expensive, cache the last plan on the session (with an invalidation on
session mutation), but do not make it the source of truth for shard ids — the
deterministic hash is.

## Build sequence (for the future joint PR)

1. **api first:** migration → shard-id hashing helper → clustering service (port
   phase-15 algorithm) → the 5 routes with the access/role gates above → tests
   (route auth matrix, cluster determinism, batch-submit partial-success +
   idempotency, detail pagination, shard-reviews upsert, clean-pr approved-only
   guard). Confirm all 5 register in OpenAPI; single Alembic head.
2. **web second:** un-defer the `origin/llm-helper` shard UI (components/store/
   hook already written), point `lib/api/suggestions.ts` at the now-real
   endpoints, add `next_cursor` to `SessionDetailResponse` + wire cursor
   pagination in the detail view, restore the enriched review types deferred from
   PR-1 (`suggestions.ts` review types). Re-run the existing `Shard*` component
   tests.
3. Stack it as a new `[upstream-queue]` PR pair on top of PR-7 (or rebase into
   the drain if the queue is still unmerged), cross-linked, with `/ce:review`.

## Open questions (resolve before building)

1. **Reviewer role boundary** — is `editor` the floor for `batch-submit`/
   `clean-pr`, or does the project's existing PR-create permission already answer
   this? (Reuse it; don't invent a new gate.)
2. **Shard-id stability contract** — server-authoritative ids returned by
   `cluster` (recommended) vs. client-derivable hash. Pick one and pin it with a
   test; the drag-drop UX depends on it.
3. **Duplicate-candidate budget in `/detail`** — top-k and whether to precompute
   at cluster time vs. lazily per page.
4. **`clean-pr` vs. `batch-submit` overlap** — can both run for one session, and
   how do their PR mappings coexist? (Likely: `clean-pr` is an alternative to
   `batch-submit`, mutually exclusive per session.)
