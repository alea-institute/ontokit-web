---
title: Diff view and generative expansion - Plan
type: feat
date: 2026-11-20
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Diff view and generative expansion - Plan

## Goal Capsule

**Objective:** An ontology editor can (1) see, entity by entity, what changed in a project over the last N days and which changes generative AI originated, and (2) grow the ontology from any class by asking the configured LLM for subclasses or siblings, reviewing the batch, and accepting what fits.

**Means:** Extend the change-event store the API already keeps, tag origin from a server-owned ledger of LLM proposals, and finish the generation UI that already exists (KTD1, KTD3, KTD5).

**Authority:** The API contract in this plan governs field names and behavior for both repos. Existing role, rate-limit, budget, duplicate, and validation gates stay as they are.

**Stop conditions:** Stop and report if a unit needs a file another unit owns, if a migration cannot downgrade cleanly, or if an existing gate (budget, rate limit, trust ladder) would have to loosen.

**Execution profile:** Two repos, `ontokit-api` and `ontokit-web`, both integrating on `dev`. One PR per repo for the first wave (U1+U2 in the API; U4 and U5 in the web), then a second wave (U3, U6). No deploy belongs to this plan.

**Finisher:** The orchestrating session commits worker output, reviews, and opens the PRs.

## Product Contract

### Summary

OntoKit already holds most of the machinery: the API records entity change events and serves per-entity history and aggregate analytics, and it generates validated, duplicate-checked suggestions for children, siblings, annotations, parents, and edges under rate and budget limits. The web app shows an entity history tab and suggestion cards. This plan closes the gaps that keep those parts from answering the two questions asked of them.

### Problem Frame

What exists, and what is missing:

| Area | Exists today | Gap |
|---|---|---|
| Change recording (API) | `entity_change_events`, written from a graph-to-graph comparison on direct saves; labels, parents, deprecation, comments | No skos:definition comparison; no values kept for creates/deletes; no origin; merges of pull requests and suggestion sessions, remote sync, and older history record nothing |
| Change reading (API) | Per-entity history; activity, hot-entity, and contributor aggregates | No "what changed in the last N days" feed; no filters by author or origin |
| Change display (web) | `EntityHistoryTab`; analytics page (not linked from project navigation) | No project changes page; no tree markers; no origin badge |
| Generation (API) | `POST /llm/generate-suggestions` with context assembly (label, definition, parents, siblings), prompt builders ported from generative-folio, validation, duplicate verdicts, role gate, daily rate limit, budget, audit log, bring-your-own-key | No durable per-entity provenance once a suggestion is accepted; no batch id |
| Generation (web) | `useSuggestions`, `SuggestionCard`, per-card accept / edit / reject / mark distinct; children trigger in the class detail panel | Siblings can never be requested (no control calls it); no entry from the tree; no batch review or bulk actions; no batch-size choice |

### Requirements

Diff
- R1. A project-level Changes page lists, one row per entity, what was added, modified, or removed in a chosen window (1, 7, 30, or 90 days; default 7) on a branch.
- R2. Each row shows the net change per field: labels, definitions, parents (hierarchy moves), deprecation, and comments, as before and after.
- R3. The list filters by window, author, origin (human, AI, AI edited, system), entity type, and change kind; filters live in the URL.
- R4. Every change carries an origin, assigned by the server, never by the client.
- R5. The tree marks entities changed in the window, and the entity history tab shows origin.
- R6. Changes that land through pull-request merges, suggestion approval, and remote sync appear in the feed, and history that predates recording can be backfilled from git.

Generative
- R7. From a class's detail panel and from its tree context menu, a user with LLM access can ask for suggested subclasses or suggested siblings, choosing a batch size of 3, 5, or 10.
- R8. Suggestions are grounded in the class's label, definition, parents, and existing siblings, and the UI discloses that grounding.
- R9. Suggestions arrive as one reviewable batch: accept, edit then accept, or reject each; accept all eligible or reject all; blocked duplicates stay visible with the reason and never join a bulk accept.
- R10. Accepted items land through the existing draft-and-save or suggestion-session path, with no new write path.
- R11. The server records what the LLM proposed, so an accepted entity is tagged `ai` (unchanged) or `ai_edited` (changed before landing) in the change feed, with model and batch id.
- R12. Existing cost and abuse limits remain in force and their refusals read as plain-language messages in the batch region.
- R14. A user can expand several classes in one action ("programmatically"): pick up to 10 classes, or every direct subclass of one class, and receive one combined review. Each class still costs one metered generation call, and nothing lands without review (U7).

Experience
- R13. Both surfaces meet the UX rules under "UX design": keyboard access, non-color status, announcements, empty/loading/error states, confirmation or undo on bulk actions, and progressive disclosure.

### Scope Boundaries

- No new LLM provider work; generation uses the project's configured provider as it does today.
- No triple-level or Turtle text diff; `components/diff/` already serves commit-level diffs.
- No inference (before/after reasoning) diff, and no cross-branch comparison view.
- No automatic acceptance of AI suggestions, and no change to trust-ladder rules.
- No deploy to DEV or PROD.

### Open choices for Damien

- OC1. Default window: 7 days (built) versus 30.
- OC2. Origin vocabulary shown to users: "Human, AI, AI edited, System" (built) versus a two-way "Human / AI" with edit status as a detail.
- OC3. "Accept all" confirms above 3 items (built). Alternative: always confirm, or never confirm and rely on draft undo.
- OC4. Blocked-duplicate and invalid proposals are still logged in the AI ledger so a later resolved acceptance is tagged AI (built). Alternative: log only clean proposals.
- OC5. Ledger retention: the purge function exists but nothing schedules it; pick a retention period (suggest 365 days) when U3 lands.
- OC7. "Programmatically" (the owner's word): read here as bulk expansion in the browser over the existing endpoint (U7, built as recommended). Alternative: a scripted path (personal API tokens plus a background bulk-generation job), which is a larger, security-bearing unit and is not planned.
- OC8. Origin covers created classes only. AI-suggested annotations, parents, and edges on existing entities still read as Human. Extending the ledger to those is a follow-up; say whether it should precede announcing the Changes page.
- OC9. The Changes page now opens with an at-a-glance digest whose tiles filter by origin. The older "Events by origin" chips in the summary strip remain (kept as built); removing them would leave one origin control in the digest and one in Filters.
- OC6. History backfill (U3) depth: the last 90 days of the default branch (recommended) versus full history.

## Planning Contract

### Key Technical Decisions

- KTD1. **The API computes the diff and stores it as events.** The existing `entity_change_events` table is the index for the feed. Reading git and parsing two ontology graphs per commit on every page view would not scale (FOLIO holds about 18,000 classes); recording once per landing and querying rows does. Git stays the source of truth: U3 adds a reconciler that walks a branch's commits, compares each commit's graph with its parent's, and records events for commits that have none.
- KTD2. **One row per entity, net over the window.** The feed groups events by entity and reports net field changes, so ten edits to one label read as one before/after. Individual events stay available under each row.
- KTD3. **Origin is server-owned.** The generation route writes each proposed subclass or sibling to `llm_generated_entities`. When a create event is recorded, a resolver matches created IRIs against that ledger and marks them `ai` or `ai_edited` by comparing label and definition. The client never claims origin, so a hand-typed class cannot pose as AI or the reverse. Matching ignores branch because suggestion branches merge.
- KTD7. **A per-branch watermark makes the reconciler the one catch-up path (review, 2026-11-20).** Checking "commits that have no events" cannot tell an unrecorded commit from a commit that changed no entity, so it re-parses those forever. U3 stores the last reconciled commit per project and branch. Every path that moves a branch head enqueues the reconciler; the direct save keeps recording inline and advances the watermark. A path nobody wired is caught on the next run instead of lost.
- KTD8. **Events carry the time the change landed, not the time the row was written (review).** Backfilled and reconciled events take the commit's committer time (clamped to now), or every backfilled change would read as "changed today".
- KTD4. **The two API tracks meet at a plain-dict resolver seam**, so they build in parallel with no shared imports; U3 wires them together at the call sites.
- KTD5. **Generation is finished, not rebuilt.** The request, gates, validation, and duplicate detection stay. The API adds `batch_id` and the ledger; the web adds the missing siblings trigger, the tree entry, and batch review on top of `useSuggestions`.
- KTD6. **One migration for both tracks** (`j8k9l0m1n2o3`, after head `i7j8k9l0m1n2`) avoids two Alembic heads from parallel units.

### Reuse from sibling projects

- **generative-folio:** OntoKit's children and siblings prompt builders and its 14 controlled relationship types already come from it. Reuse next, as later prompt work rather than in this plan: its encyclopedic-definition standard (definitions that distinguish legal from lay usage), its areas-of-law and jurisdiction fields (the prompts already ask for `areas_of_law` and then drop it), and its deterministic QA and de-duplication passes as an offline evaluation set for suggestion quality. Its generated corpus can also serve as a benchmark: hide a known FOLIO branch's children and score what OntoKit proposes.
- **ontology-dynamic:** its core idea, every proposed concept tied to the exact source text that supports it and held as "proposed" until review promotes it, matches OntoKit's ledger-plus-review shape. Reuse its evidence-span model and exchange format when OntoKit adds document-grounded suggestions (roadmap items B28 and B34, the shared suggestion envelope); this plan's ledger columns (`batch_id`, `focus_iri`, `model`, `prompt_template`) leave room for an evidence reference. No code moves now: it is a Rust workspace at the start of implementation.

### UX design

Changes page
- **Hierarchy:** window and branch first, then a summary strip (entities changed; added / modified / removed; origin breakdown), then filters, then the list. Summary counts double as filter toggles.
- **Progressive disclosure:** rows show the entity, net change, origin, authors, and time; expanding a row reveals field-level before/after, then individual events.
- **Error prevention and recovery:** filters live in the URL; "Clear filters" appears whenever one is set; the empty state says how to widen the search.
- **Accessibility:** net change and origin pair an icon with text, never color alone; expanders are buttons with `aria-expanded`; filter chips expose `aria-pressed`; "Load more" announces how many rows arrived.

Generative review
- **Entry points:** two labelled actions in the detail panel ("Suggest subclasses", "Suggest siblings") and the same two in the tree context menu; siblings disabled with a reason on a root class; both disabled with a reason when the user lacks LLM access.
- **Feedback:** skeletons while generating; a live progress line ("3 pending, 1 accepted, 1 rejected, 1 blocked as duplicate"); toasts after bulk actions stating accepted and skipped counts and that items join the current draft.
- **Error prevention:** "Accept all" names how many classes it will create and where, and confirms above 3; blocked duplicates and invalid items never join a bulk accept; "Reject all" offers undo or confirms; rate-limit and budget refusals explain themselves and never retry automatically.
- **Trust:** an "AI-suggested" marker with the model name, and a collapsed "Based on" line listing the grounding.
- **Focus:** focus moves to the batch heading when results arrive and returns to the requesting control when the batch resolves.

Tree markers (U6)
- A small dot plus an accessible label ("changed in the last 7 days", "added by AI") on changed entities, off by default behind a "Show recent changes" toggle that links to the Changes page.

## API contract (authoritative for every unit; API and web build against it in parallel)

All paths sit under `/api/v1/projects/{project_id}`. Access rules match the existing analytics routes (project-visibility check, optional user). Timestamps are ISO 8601 UTC strings.

### Origin vocabulary

`origin` is one of `human`, `ai`, `ai_edited`, `system`.
- `human`: a person authored the change.
- `ai`: the entity was proposed by the configured LLM and accepted unchanged (same label and definition as generated).
- `ai_edited`: proposed by the LLM, then edited by a person before it landed.
- `system`: remote sync, normalization, or history backfill with no known author.

### Stored data

`entity_change_events` gains: `origin` (string 20, not null, server default `human`), `origin_model` (string 255, nullable), `origin_batch_id` (UUID, nullable), and index `ix_change_events_project_origin_time (project_id, origin, created_at)`. `changed_fields` gains the value `definitions` (skos:definition literals), and `old_values`/`new_values` carry `definitions` and `comments` lists the same way they carry `labels` and `parents`.

New table `llm_generated_entities` (the server-owned ledger of what the LLM proposed): `id` UUID pk; `project_id` UUID FK projects.id ON DELETE CASCADE; `branch` string 255; `entity_iri` string 2000; `batch_id` UUID; `suggestion_type` string 20; `focus_iri` string 2000; `label` text; `definition` text nullable; `model` string 255 nullable; `prompt_template` string 50 nullable; `user_id` string 255; `created_at` timestamptz server default now. Indexes: `ix_llm_generated_project_iri (project_id, entity_iri)`, `ix_llm_generated_project_batch (project_id, batch_id)`.

One Alembic revision adds both: revision id `j8k9l0m1n2o3`, down_revision `i7j8k9l0m1n2`, file `alembic/versions/j8k9l0m1n2o3_add_change_origin_and_llm_generated_entities.py`.

### GET /analytics/changes  (the "what changed in the last N days" feed)

Query: `days` int 1..365 default 7; `branch` optional (omitted = the project's default branch); `origin` repeatable; `author` repeatable (user_id); `entity_type` repeatable (`class`, `object_property`, `data_property`, `annotation_property`, `individual` — whatever values the events table already stores); `event_type` repeatable; `limit` 1..200 default 50; `cursor` optional opaque string.

Response `ProjectChangesResponse`:

```json
{
  "window": {"days": 7, "since": "…", "until": "…", "branch": "main"},
  "summary": {
    "total_events": 42,
    "entities_changed": 17,
    "by_net_change": {"added": 9, "modified": 6, "removed": 2},
    "by_origin": {"human": 20, "ai": 15, "ai_edited": 5, "system": 2},
    "authors": [{"user_id": "u1", "user_name": "Ada", "event_count": 30}]
  },
  "items": [
    {
      "entity_iri": "https://example.org/onto#Lease",
      "entity_type": "class",
      "label": "Lease",
      "net_change": "added",
      "origins": ["ai_edited"],
      "last_changed_at": "…",
      "event_count": 2,
      "authors": [{"user_id": "u1", "user_name": "Ada"}],
      "field_changes": [
        {"field": "labels", "before": [], "after": ["Lease"]},
        {"field": "definitions", "before": [], "after": ["A contract granting use of property."]},
        {"field": "parents", "before": [], "after": ["https://example.org/onto#Contract"]}
      ],
      "events": [ /* ChangeEvent, newest first, at most 20 */ ]
    }
  ],
  "next_cursor": null
}
```

Rules: one item per entity, ordered by `last_changed_at` descending then `entity_iri`. `summary` covers the whole filtered window, not just the page. `net_change` is `added` when the window's earliest event for the entity is a create and it was not later deleted, `removed` when its latest event is a delete, otherwise `modified` (created-then-deleted inside the window reports `removed`). `field_changes` is the net change per field: `before` from the earliest event in the window that touched the field, `after` from the latest; a field whose net before equals after is omitted. `field` is one of `labels`, `definitions`, `parents`, `deprecated`, `comments`, `other` (`other` has null before/after). `label` is the newest known label from the events, else null. Filters apply to events before grouping. An unknown `origin` value returns 422.

### GET /analytics/changed-entities  (light feed for tree markers)

Query: `days`, `branch`, `origin` as above. Response: `{"items": [{"entity_iri": "…", "net_change": "added", "origins": ["ai"], "last_changed_at": "…"}], "truncated": false}`; at most 5000 items, newest first; `truncated` true when more exist.

### ChangeEvent (existing shape, extended)

Every `ChangeEvent` (entity history and the feeds) adds `origin` (default `human`), `origin_model` (nullable), `origin_batch_id` (nullable string).

### POST /llm/generate-suggestions  (existing; extended)

Request unchanged: `{class_iri, branch, suggestion_type, batch_size}` with `suggestion_type` in `children | siblings | annotations | parents | edges` and `batch_size` 1..10. Existing gates stay: role access, per-user daily rate limit, project budget, bring-your-own-key header, duplicate verdict (`pass | warn | block`) and candidates on each suggestion, validation errors on each suggestion. Response adds `batch_id` (UUID string). The server writes one `llm_generated_entities` row per returned `children` or `siblings` suggestion (other types mint no entity and write no row).

### Origin resolver (server-internal seam between the two API tracks)

Change-event recording accepts an optional async resolver: `async (project_id: UUID, created: dict[str, dict[str, list[str]]]) -> dict[str, dict[str, str | None]]`. Input maps each created entity IRI to `{"labels": [...], "definitions": [...]}`; output maps a subset of those IRIs to `{"origin": "ai" | "ai_edited", "model": str | None, "batch_id": str | None}`. IRIs absent from the output are `human`. Plain dicts only, no shared classes, so the two tracks stay import-independent. The ledger side exposes it as `AIOriginService(db).resolve`. A match is the newest ledger row with the same `project_id` and `entity_iri` (any branch, because suggestion branches merge); `ai` when the ledger label equals one current label and the ledger definition (if any) equals one current definition after trimming and whitespace collapse, else `ai_edited`.

### Contract amendments from review (2026-11-20)

These override the text above where they differ. U1 and U4 were launched against the earlier text; the orchestrator issues fix packets (listed in the review report).

- **A1. Filters select entities; net change covers the whole window.** `origin`, `author`, and `event_type` choose which entities appear (an entity qualifies when at least one of its events in the window matches). `net_change`, `field_changes`, `label`, `origins`, `authors`, `event_count`, and `events` are then computed from all of that entity's events in the window on the branch. Filtering events first would report a stale "after" (author A's value when author B changed it later) and a wrong `net_change`. `days`, `branch`, and `entity_type` still filter events. In `summary`, `entities_changed` and `by_net_change` count qualifying entities; `total_events`, `by_origin`, and `authors` count those entities' events.
- **A2. `net_change` follows existence at the window's edges.** Existed before = the entity's earliest event in the window is not a create. Exists after = its latest event is not a delete. Before and after: `modified` (this covers delete-then-recreate). After only: `added`. Before only: `removed`. Neither (created and deleted inside the window): `transient`, a fourth value, shown as "Added, then removed" and counted under `by_net_change.transient`. It never existed at either edge, so calling it `removed` overstates removals.
- **A3. Event time.** `record_event` and `record_events_from_diff` accept an optional `occurred_at` (UTC; default now) stored in `created_at`. Owned by U3.
- **A4. Index build.** The index on the existing `entity_change_events` table is created with `postgresql_concurrently=True` inside `op.get_context().autocommit_block()`, as `g5h6i7j8k9l0` does, so writers are not blocked while it builds. The two `ADD COLUMN`s are metadata-only on PostgreSQL 11+ (constant default), and old application code keeps inserting during a rolling deploy because of the server default.
- **A5. Known limits of the diff model, stated in the UI help text.** An IRI rename reads as one removal plus one addition (events key on IRI; the `rename` event type means a label change). The window is a rolling `days x 24h` in UTC ending at request time, so "1 day" is labelled "Last 24 hours"; times render in the viewer's zone. Origin describes how a class was created; AI-suggested annotations, parents, and edges on existing entities are not tracked yet (OC8).
- **A6. Origin is a provenance record, not an attestation.** The server owns it, so a client cannot assert `ai` or `human` directly. A member who can save source can still reuse a ledger IRI for hand-written content (it reads `ai_edited`) or re-mint an accepted suggestion's IRI (it reads `human`). No cheap server check closes that; the plan does not claim it does. Parent changes before landing do not make an entity `ai_edited` (the ledger keeps label and definition only).

## Implementation Units

Parallelism: U1 and U2 run together in one API worktree on disjoint files. U4 and U5 run together in two web worktrees. U1/U2 and U4/U5 are independent of each other because all four build against the contract above. U3 waits on U1 and U2. U6 waits on U4 and U5 (it edits tree and history files U5 touches and uses U4's hooks). U7 waits on U5 and should follow U6 (both edit the tree files). Packets for U3, U6, and U7 exist (`ok-u3`, `ok-u6`, `ok-u7`, dated 20261120) and are not launched.

### U1. Change-origin storage, definition-aware diff, and the changes feed (ontokit-api)

- **Goal:** R1–R4 server side. **Requirements:** R1, R2, R3, R4.
- **Files:** `alembic/versions/j8k9l0m1n2o3_add_change_origin_and_llm_generated_entities.py`, `ontokit/models/change_event.py`, `ontokit/schemas/analytics.py`, `ontokit/services/change_event_service.py`, `ontokit/api/routes/analytics.py`, `tests/unit/test_change_event_service.py`, `tests/unit/test_analytics_routes.py`, `tests/unit/test_migration_inventory.py`, `tests/unit/test_change_origin_migration_contract.py`, `tests/unit/test_project_changes_feed.py`.
- **Approach:** add origin columns and the ledger table in one migration; compare skos:definition and keep values on create and delete; accept an optional origin resolver and default origin; add `list_changes` and `list_changed_entities` with database-side grouping and an opaque cursor; add the two routes.
- **Test scenarios:** definition add/change/remove; create and delete carry values; resolver marks `ai` and `ai_edited`, raising resolver degrades to `human`; feed grouping, ordering, net change (including created-then-deleted), net field changes, each filter, summary over the whole window, cursor paging without repeats, 422 on bad origin or cursor; changed-entities cap; access checks.
- **Verification:** `pytest --no-cov -q tests/unit` (baseline 4115 passed, 1 skipped); `ruff check ontokit tests/unit`.

### U2. LLM ledger, batch ids, and the AI-origin resolver (ontokit-api)

- **Goal:** R11 server side. **Requirements:** R4, R11, R12.
- **Files:** `ontokit/models/llm_generated_entity.py`, `ontokit/models/__init__.py`, `ontokit/services/ai_origin_service.py`, `ontokit/api/routes/generation.py`, `ontokit/schemas/generation.py`, `tests/unit/test_ai_origin_service.py`, `tests/unit/test_llm_generated_entity_model.py`, `tests/unit/test_generation_routes.py`, `tests/unit/test_generation_provenance.py`, `tests/unit/test_generation_schemas.py`.
- **Approach:** model matching the contract; `batch_id` on the response; one ledger row per returned child or sibling suggestion, never failing the request on a ledger error; `AIOriginService.resolve` and `purge_older_than`.
- **Test scenarios:** rows written for children and siblings only; distinct batch ids; ledger failure tolerated; resolver exact, edited, whitespace, null-definition, cross-project, newest-wins, and cross-branch cases.
- **Verification:** as U1.

### U3. Record every landing path through a watermark reconciler, and backfill from git (ontokit-api) — second wave

- **Goal:** R6, and R11 end to end. **Requirements:** R4, R6, R11.
- **Files:** new `ontokit/services/change_history_reconciler.py`; new migration `k9l0m1n2o3p4` (down_revision `j8k9l0m1n2o3`) adding `change_history_watermarks` and a concurrent `(project_id, branch, commit_hash)` index on `entity_change_events`; new model `ontokit/models/change_history_watermark.py`; `ontokit/services/change_event_service.py` (`occurred_at`, batch insert); `ontokit/api/routes/projects.py` (pass the resolver at the existing source-save call; advance the watermark); one enqueue line after each head move in `ontokit/services/pull_request_service.py` (merge), `ontokit/services/github_sync.py` (fast-forward and merge), `ontokit/services/normalization_service.py`, `ontokit/services/translation_service.py`, `ontokit/services/translation_review.py`, `ontokit/services/project_service.py`; `ontokit/worker.py` (job, daily sweep, ledger purge); tests.
- **Approach (KTD7, KTD8):** the reconciler walks first-parent commits from the branch's watermark to its head, oldest first, diffing each commit's graph against the previous one (one parse per commit), recording events with the commit's time, and advancing the watermark in the same transaction. First-parent means a merge commit yields the pull request's net diff once. Attribution: a merge commit that matches `pull_requests.merge_commit_hash` is attributed to the pull request's author; sync, normalization, and unmapped commits are `system`; the AI resolver runs on every create. With no watermark, start 90 days back on the default branch (OC6). Bounded work per run, then re-enqueue.
- **Test scenarios:** a merged suggestion containing an accepted AI child yields a create event tagged `ai` on the default branch, attributed to the suggestion's author; an edited one yields `ai_edited`; a fast-forward sync yields `system` events with commit times; a commit that changes no entity advances the watermark and is not re-read; rerun is a no-op; two concurrent runs record once; a commit that fails to parse is skipped, reported, and passed; an 18,000-class first commit inserts in batches.
- **Verification:** unit suite plus the repo's integration tests for save and merge; migration up and down on a scratch database.
- **Waits on:** U1 and U2 merged.

### U4. Project Changes page (ontokit-web)

- **Goal:** R1–R3 in the browser. **Requirements:** R1, R2, R3, R13.
- **Files:** `lib/api/changes.ts`, `lib/hooks/useProjectChanges.ts`, `app/projects/[id]/changes/page.tsx`, `components/changes/**`, `app/projects/[id]/page.tsx` (link), tests under `__tests__/`, `ui-tests/changes-page.spec.ts`.
- **Approach:** typed client and infinite-query hook against the contract; page composed of summary strip, URL-backed filters, expandable entity rows, and a reusable origin badge; follow the existing design system.
- **Test scenarios:** param serialization and paging; summary and rows; expand shows before/after; filters update URL and query; empty, loading, and error states; accessibility roles and states.
- **Verification:** `npx vitest run` on the new tests; `npm run type-check`; `npm run lint`; Playwright screenshots (light, dark, expanded with AI filter) inspected.

### U5. Suggest subclasses and siblings from the tree, with batch review (ontokit-web)

- **Goal:** R7–R10, R12 in the browser. **Requirements:** R7, R8, R9, R10, R12, R13.
- **Files:** `lib/api/generation.ts`, `lib/hooks/useSuggestions.ts` and its store, `components/editor/suggestions/**`, `components/editor/ClassDetailPanel.tsx`, `components/editor/TreeNodeContextMenu.tsx`, `components/editor/shared/EntityTreeNode.tsx`, `components/editor/shared/EntityTree.tsx`, `components/editor/ClassTree.tsx`, both editor layouts, tests, `ui-tests/generative-batch.spec.ts`.
- **Approach:** add `acceptAll`/`rejectAll` and a batch-size override to the hook; a `SuggestionBatchReview` region for the children and siblings slots; the missing siblings trigger; context-menu items that select the class and fire one request on mount, generalizing the existing auto-suggest flag.
- **Test scenarios:** bulk accept skips blocked and invalid items and stops on failure; confirm threshold; siblings request fires and is disabled on a root class; context-menu items gated and wired; one request per tree action.
- **Verification:** as U4, with screenshots of the batch region (light, dark) and the open tree menu.

### U6. Tree change markers and origin in entity history (ontokit-web) — second wave

- **Goal:** R5. **Requirements:** R5, R13.
- **Files:** `components/editor/shared/EntityTreeNode.tsx`, `components/editor/shared/EntityTree.tsx`, `components/editor/EntityHistoryTab.tsx`, `lib/api/analytics.ts`, both editor layouts, tests.
- **Approach:** a "Show recent changes" toggle that loads `changed-entities` once and marks matching nodes; the origin badge from U4 in the history tab; a "View all changes" link from the tree toolbar. The tree loads lazily, so markers show only on loaded nodes; the toggle's caption says so and the link to the Changes page is the complete view. Lookups use one memoized map shared through context, never a per-node request.
- **Test scenarios:** markers appear only with the toggle on; accessible names; truncated feed shows a notice; history rows show origin.
- **Verification:** as U4.
- **Waits on:** U4 and U5 merged.

### U7. Expand several classes in one action (ontokit-web) — third wave, proposed by review

- **Goal:** R14. **Requirements:** R12, R13, R14.
- **Why:** the owner asked to expand siblings and children "programmatically". U5 expands one class per click. The generation endpoint is already a callable API; what is missing is a many-at-once path. This unit adds it in the browser with no new endpoint, no new write path, and no change to any gate.
- **Files:** new `lib/hooks/useBulkExpansion.ts`, new `components/editor/suggestions/BulkExpansionReview.tsx` and dialog, `components/editor/TreeNodeContextMenu.tsx` ("Suggest subclasses for each subclass…"), editor layouts, tests, `ui-tests/bulk-expansion.spec.ts`.
- **Approach:** a queue that calls the existing endpoint one class at a time (never in parallel) for at most 10 classes; a pre-flight dialog naming the classes, the number of metered calls, and the batch size; Stop at any time; the first rate-limit or budget refusal halts the queue and keeps finished results; results group by focus class in the U5 batch review; "Accept all eligible" works per group only and always confirms.
- **Test scenarios:** sequential calls; cap at 10; halt on refusal with partial results kept; Stop cancels the rest; per-group accept; announcements.
- **Waits on:** U5 merged (U6 first, since both edit tree files).

## Build status (2026-11-20, end of the first build session)

Branches: API `drain/1120-diff-generative`; web `drain/1120-diff-generative` (Changes page), `drain/1120-generative-ui` (suggestions), `drain/1120-integration` (both, plus tree markers), `drain/1120-bulk-expansion` (bulk expansion, from integration). Nothing is merged into `dev`; no pull request is open.

| Unit | State |
|---|---|
| U1, U2 | Built, corrected for A1, A2, A4, reviewed, and committed. |
| U3 | Built and committed in the same session (not a later wave), then reviewed and hardened. |
| U4 | Built and committed, with `transient`, "Last 24 hours", and the tracking-limits help text. |
| U5 | Built and committed. A follow-up shows each suggestion's definition in the batch review and persists it on accept. |
| U6 | Built and committed on the integration branch. It broke four project-viewer tests; a fix was in progress when the session ended. |
| U7 | In progress on its own branch when the session ended. |

Findings that change the design or stay open:

- **Accepted suggestions dropped their definition.** The web accept path saved label and provenance only, so every accepted class would have read `ai_edited`. Fixed in the web; the Risks entry on label drift stands.
- **The ledger row is written after the response** (own session, background task) so a ledger failure cannot delay or fail generation. An acceptance that lands before that write commits reads `human`. Not closed.
- **Pull-request merge attribution has a 30-second grace**, not a lock: a merge transaction slower than that can still be attributed to `system`. The durable fix holds the target branch's advisory lock from the ref move through the pull request commit.
- **Work branches can miss a first landing**: the first-run baseline skips an existing work-branch head and the daily sweep covers default branches only.
- **Equal event times order by random id** (wrong net change for same-second commits), **blank-node ids fabricate `other` changes**, and **an IRI over 2,000 characters blocks later commits**: a fix was in progress when the session ended.
- **Feed consistency during backfill**: page, payload, and summary run as separate queries and can disagree while the reconciler writes; a heavily edited entity loads its whole window of events despite the 20-event cap.
- **`field_changes` never contains `other`**: the contract both allows it with null values and says to omit equal before and after. Choose one.
- **Verified since (see the UAT record):** migrations up on a real PostgreSQL, the web client against real API responses, and the end-to-end check in the Verification Contract. **Still not verified:** migration downgrade, the API integration tests, and cross-process locking.
- **Packet lesson:** web units verified only their own test folders and twice broke tests elsewhere (`__tests__/app/`). Every web packet now runs the whole Vitest suite.

## UAT record (2026-11-20, evening): real stack, real browser

**Setup.** The repo's isolated full-stack harness (`scripts/e2e`, `suggestions` profile) brought up PostgreSQL with pgvector, Redis, MinIO, Zitadel with its Login UI, and the API and worker built from the API branch's pushed head (`e17f1d15`), all in throwaway containers on free ports. Migrations applied and matched every head. A custom workflow replaced the fixed Playwright inventory: it started the integration branch's dev server on the reserved port and held the stack. The LLM was stubbed at the HTTP boundary: a small OpenAI-compatible server inside the API container on the local-provider address, with the project configured for that provider. Sign-in ran through real OIDC as the harness's owner and editor personas. Seed: an 18-class property-law ontology imported through the API, then one rename and one removal saved by the editor persona. Import events were backdated ten days in the scratch database to exercise the windows.

**Walked, as a user (Chromium, 1440 px and 390 px, light and dark):**

| Step | Saw |
|---|---|
| Open Changes from the project header; switch 24 hours, 7, 30 days | Counts and rows followed the window; the 7-day view dropped the ten-day-old import, and 30 days showed it as System. The URL carried `days`. |
| Filter by origin and by author; open a row; follow an entity link | Rows, summary, and URL agreed; the row showed before and after per field and the event list with model name; the link opened the class in the editor on the same branch. |
| Tree menu: Suggest Subclasses on a class | One request; five cards with definitions; focus moved to the batch heading. |
| Accept one unchanged, edit and accept one, reject one, restore it, reject it again | Each accept saved a commit and added the class to the tree; counts updated. |
| Suggest Siblings, then Accept all, by keyboard only (Tab, arrows, Shift+F10, Enter) | Menu, batch, confirmation dialog, and toast all reachable; focus returned to the tree when the batch resolved. |
| Bulk expansion on a class with 11 subclasses | The dialog checked the first 10 and disabled the eleventh (the cap); 10 sequential requests; per-class groups; accepting one group confirmed first and named the undo path. |
| Back to Changes | Unchanged accepts read **AI**, edited accepts read **AI edited**, the editor's saves read **Human**; the model name showed on each create event. This is the plan's end-to-end check, passing on a real stack. |
| Show recent changes in the tree; entity history | Markers and accessible names matched the feed ("added by AI", "added by AI and edited by a person", "modified"); history showed the origin badge and model. |

**Found and fixed in the web client (each with a test that failed first, unless noted):**

- Accepting a suggestion selected the new class, which pulled the reviewer off the batch after every accept. Acceptance now leaves the selection alone.
- Adding a class under a collapsed parent showed the new class alone and hid the parent's existing subclasses. The tree now loads the rest.
- Accepted cards looked and acted like pending ones. They now read "Accepted" and carry no actions.
- Every card's buttons had the same accessible name with nothing tying them to a suggestion, and the label field had no name. Buttons are now described by their suggestion's label, and the field is named.
- A rejected suggestion could not be brought back. "Restore rejected" returns them to pending.
- The confirmation and toast said accepted classes "join the current draft"; on a direct-write branch they are committed at once. The wording now says each class is saved as it is accepted.
- The grounding line counted "existing siblings" for a subclass batch; it now says "existing subclasses" (copy change, no failing test first).
- The tree menu explained a disabled bulk action with "No subclasses loaded."; it now says to expand the class, or that the class has no subclasses.
- The generative UI spec had broken when bulk expansion added a second menu item matching "Suggest Subclasses"; its lookup is exact now.
- Changes rows wrapped unevenly at phone width; name and change kind now sit on one line and the rest on a second.

**Changes page polish.** The page opens with "Last N days at a glance": two tiles, classes added by AI (accepted as suggested versus edited first) and entities changed by people (added, modified, removed), plus a line for sync or import. The counts come from the light changed-entities feed, cover the whole window whatever the list is filtered to, and each tile filters the list below. A class a person edits after accepting it counts once under AI and once as modified by people; an imported entity a person renames counts as modified, not added.

**API defects for the API branch (not fixed here):**

1. `POST /projects/import` by a signed-in user records create events with `origin: "system"` and `user_id: "system"` but `user_name` set to the importer's display name, so `summary.authors` returns `{"user_id": "system", "user_name": "<importer>"}` and the Author filter offers a person who is really the system. Expected: either attribute the import to the importing user (`origin: "human"`, their `user_id`), or return `user_name: null` for system events.
2. `POST /llm/generate-suggestions` (`suggestion_type: "children"`) on a class that already has a subclass with the identical label returns that label with `duplicate_verdict: "pass"` and no candidates when no embedding index exists. Accepting it twice produced two sibling classes with the same label. Expected: an exact normalized label match under the same parent returns at least `warn`, without depending on embeddings.

**Not covered:** suggester-role and anonymous flows, rate-limit and budget refusals from the real limiter, migration downgrade, pull-request merge attribution, remote sync, and a 5,000-plus-entity feed. A pre-existing layout fault remains outside these features: the "Suggest improvements" buttons overlap the field labels in the class panel at 1440 px.

## Verification Contract

- API: `pytest --no-cov -q tests/unit` green against the 4115-passed baseline, `ruff check` and `ruff format --check` clean, and the migration upgrades and downgrades on a scratch database before the PR merges.
- Web: `npx vitest run` green (baseline: `__tests__/lib` 2165 passed), `npm run type-check`, `npm run lint`, and inspected Playwright screenshots for U4, U5, and U6.
- Contract: before U3 and U6 start, run the web client types against real API responses from a local stack (the repo's e2e harness) and fix any drift in the API or the client, whichever departs from this plan.
- End to end (after U3): generate siblings, accept one unchanged and one edited, save, and confirm the Changes page shows them as AI and AI edited.

## Definition of Done

- Every requirement R1–R14 has passing tests in its owning unit.
- Both origin and feed behavior match the contract, or the plan is amended where implementation proved the contract wrong.
- No existing gate loosened; no client-supplied origin accepted anywhere.
- Abandoned-attempt code, stray screenshots, and scratch servers are removed.
- The requirements roadmap notes this plan against B62 (entity-level history and diffs) and the A07 LLM-controls group.

## Risks

- **Feed gaps until U3:** before U3, only direct saves record events, so the feed under-reports merged work. U4 ships behind that known limit; the page should not be announced as complete until U3 lands.
- **Label drift in matching:** an entity whose IRI was regenerated at acceptance would miss the ledger. U3's end-to-end test covers the accepted-IRI path; if IRIs are re-minted, match on batch id carried through the draft instead.
- **Large windows:** 365 days on a busy project can hold tens of thousands of events; U1 groups in the database and pages by entity.
- **Bulk accept weakens review:** prompt-injected or low-quality suggestions land faster when accepted in bulk. Blocked and invalid items never join a bulk accept, definitions stay visible in the review, and everything lands in the draft (or suggestion session) rather than on the default branch.
- **Rate limiter fails open:** when Redis is down the per-user daily cap does not apply; the project budget still does. U7 runs calls one at a time and halts on the first refusal so a queue cannot outrun the budget check.
- **Parallel workers in one API worktree:** file ownership is disjoint, and the single migration lives with U1.

## Review notes (2026-11-20)

A second reader reviewed this plan against the code while the first wave was building. Verified by reading: the single `record_events_from_diff` caller (source save in `projects.py`); the member-and-role gate, rate limit, budget, and untrusted-data wrapping on the generation route; `mint_iri` on the server and the web accept path reusing `suggestion.iri` (so ledger matching by IRI holds); `pull_requests.merge_commit_hash` and `author_id`; migration head `i7j8k9l0m1n2`; the repo's concurrent-index precedent. Not verified: test baselines, the remote-sync internals, and any personal-token API authentication.

**Is this the right build?** Yes. Storing net diffs as events and tagging origin from a server ledger reuses what exists and answers both asks. Three objections shaped the amendments:

1. **Strongest objection: the feed's truth depends on wiring every writer.** About ten call sites move a branch head (saves, merges, sync, normalization, translation); one records events. Wiring each by hand in services of 2,500+ lines invites a missed path and a silently wrong page. The sharper version (KTD7) makes a watermark reconciler the single catch-up mechanism and reduces each call site to one enqueue.
2. **The net-diff rules were wrong at the edges.** Filtering events before grouping corrupts before/after; created-then-deleted is not a removal; backfilled events would all date to the backfill run (A1, A2, KTD8).
3. **"AI origin" promises more than it tracks.** It covers created classes only and is a record, not proof (A5, A6, OC8). The UI should say so.

Also added: R14 and U7 for the owner's "programmatically", read as bulk expansion (OC7). The Changes page should not be announced until U3 lands (see Risks).
