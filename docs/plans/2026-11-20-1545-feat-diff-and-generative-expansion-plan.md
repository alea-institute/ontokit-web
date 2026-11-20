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
- OC6. History backfill (U3) depth: the last 90 days of the default branch (recommended) versus full history.

## Planning Contract

### Key Technical Decisions

- KTD1. **The API computes the diff and stores it as events.** The existing `entity_change_events` table is the index for the feed. Reading git and parsing two ontology graphs per commit on every page view would not scale (FOLIO holds about 18,000 classes); recording once per landing and querying rows does. Git stays the source of truth: U3 adds a reconciler that walks a branch's commits, compares each commit's graph with its parent's, and records events for commits that have none.
- KTD2. **One row per entity, net over the window.** The feed groups events by entity and reports net field changes, so ten edits to one label read as one before/after. Individual events stay available under each row.
- KTD3. **Origin is server-owned.** The generation route writes each proposed subclass or sibling to `llm_generated_entities`. When a create event is recorded, a resolver matches created IRIs against that ledger and marks them `ai` or `ai_edited` by comparing label and definition. The client never claims origin, so a hand-typed class cannot pose as AI or the reverse. Matching ignores branch because suggestion branches merge.
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

## Implementation Units

Parallelism: U1 and U2 run together in one API worktree on disjoint files. U4 and U5 run together in two web worktrees. U1/U2 and U4/U5 are independent of each other because all four build against the contract above. U3 waits on U1 and U2. U6 waits on U4 and U5 (it edits tree and history files U5 touches and uses U4's hooks).

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

### U3. Wire origin into every landing path and backfill from git (ontokit-api) — second wave

- **Goal:** R6, and R11 end to end. **Requirements:** R4, R6, R11.
- **Files:** `ontokit/api/routes/projects.py` (pass the resolver at the existing source-save call), the pull-request merge and suggestion-approval paths in `ontokit/services/pull_request_service.py` and `ontokit/services/suggestion_service.py`, the remote-sync path (default origin `system`), a new `ontokit/services/change_history_reconciler.py` plus its worker job, and tests.
- **Approach:** record events wherever a branch head moves; the reconciler walks commits on a branch that have no events (by `commit_hash`), compares each with its parent, attributes author from the commit, and is idempotent; schedule the ledger purge.
- **Test scenarios:** a merged suggestion containing an accepted AI child yields a create event tagged `ai` on the default branch; an edited one yields `ai_edited`; remote sync yields `system`; the reconciler fills a gap once and is a no-op on rerun; a commit that fails to parse is skipped and reported.
- **Verification:** unit suite plus the repo's integration tests for save and merge.
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
- **Approach:** a "Show recent changes" toggle that loads `changed-entities` once and marks matching nodes; the origin badge from U4 in the history tab; a "View all changes" link from the tree toolbar.
- **Test scenarios:** markers appear only with the toggle on; accessible names; truncated feed shows a notice; history rows show origin.
- **Verification:** as U4.
- **Waits on:** U4 and U5 merged.

## Verification Contract

- API: `pytest --no-cov -q tests/unit` green against the 4115-passed baseline, `ruff check` and `ruff format --check` clean, and the migration upgrades and downgrades on a scratch database before the PR merges.
- Web: `npx vitest run` green (baseline: `__tests__/lib` 2165 passed), `npm run type-check`, `npm run lint`, and inspected Playwright screenshots for U4, U5, and U6.
- Contract: before U3 and U6 start, run the web client types against real API responses from a local stack (the repo's e2e harness) and fix any drift in the API or the client, whichever departs from this plan.
- End to end (after U3): generate siblings, accept one unchanged and one edited, save, and confirm the Changes page shows them as AI and AI edited.

## Definition of Done

- Every requirement R1–R13 has passing tests in its owning unit.
- Both origin and feed behavior match the contract, or the plan is amended where implementation proved the contract wrong.
- No existing gate loosened; no client-supplied origin accepted anywhere.
- Abandoned-attempt code, stray screenshots, and scratch servers are removed.
- The requirements roadmap notes this plan against B62 (entity-level history and diffs) and the A07 LLM-controls group.

## Risks

- **Feed gaps until U3:** before U3, only direct saves record events, so the feed under-reports merged work. U4 ships behind that known limit; the page should not be announced as complete until U3 lands.
- **Label drift in matching:** an entity whose IRI was regenerated at acceptance would miss the ledger. U3's end-to-end test covers the accepted-IRI path; if IRIs are re-minted, match on batch id carried through the draft instead.
- **Large windows:** 365 days on a busy project can hold tens of thousands of events; U1 groups in the database and pages by entity.
- **Parallel workers in one API worktree:** file ownership is disjoint, and the single migration lives with U1.
