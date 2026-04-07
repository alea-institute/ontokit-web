# Roadmap: OntoKit Web

## Milestones

- ✅ **v0.2.0 Core Editor** - Phases 1-6 (shipped)
- ✅ **v0.3.0 Deployment** - Phases 7-10 (shipped)
- 🚧 **v0.4.0 LLM-Assisted Ontology Improvements** - Phases 11-16 (in progress)

## Phases

<details>
<summary>✅ v0.2.0 Core Editor (Phases 1-6) - SHIPPED</summary>

Phases 1-6: Mode system, editor decomposition, auto-save, form editing, suggestion workflow, graph visualization, keyboard shortcuts, accessibility. See archived plans for details.

</details>

### ✅ v0.3.0 Deployment (Shipped 2026-04-03)

**Milestone Goal:** Sync ALEA forks with CatholicOS upstream and deploy the full stack to production with optional authentication and anonymous suggestions.

- [x] **Phase 7: Sync ALEA Forks** - Fast-forward both ALEA repos to CatholicOS main (completed 2026-04-03)
- [x] **Phase 8: Optional Auth** - AUTH_MODE=required|optional|disabled across both repos (completed 2026-04-03)
- [x] **Phase 9: Production Deployment** - Postgres, Redis, Caddy, systemd on 54.224.195.12 (completed 2026-04-03)
- [x] **Phase 10: Anonymous Suggestions** - "Propose Edit" for anonymous users with credit modal (completed 2026-04-03)

### 🚧 v0.4.0 LLM-Assisted Ontology Improvements (In Progress)

**Milestone Goal:** Enable SMEs to rapidly improve their ontology with LLM assistance while guaranteeing integrity through duplicate detection, validation guardrails, and human-curated review.

- [x] **Phase 11: Roles, LLM Abstraction & Cost Controls** - Per-role gating, multi-provider LLM dispatch, project budget caps, and per-user rate limits (completed 2026-04-06)
- [x] **Phase 12: Toolchain Integration & Duplicate Detection** - folio-python, OpenGloss, OWL reasoner, plus whole-ontology embeddings index and ANN-based duplicate scoring (completed 2026-04-06)
- [x] **Phase 13: Validation Guardrails & Suggestion Generation** - Pre-submit validation rules, Generative FOLIO prompt pipeline, and LLM suggestion endpoints for classes/annotations/edges (completed 2026-04-07)
- [x] **Phase 14: Inline Suggestion UX & Property Support** - "Suggest improvements" button on class detail panel, flashcard iterator mode, one-click suggestion actions, and property tree browsing with LLM suggestions (completed 2026-04-07)
- [ ] **Phase 15: Session Clustering & Batch Submit** - Auto-clustering of session suggestions by ancestor, shard preview tree, per-shard PR creation, and batch traceability
- [ ] **Phase 16: Reviewer Enhancements** - Provenance tags, confidence scores, similar-entity panels, and batch review view in the existing reviewer workflow

## Phase Details

### Phase 7: Sync ALEA Forks
**Goal**: Both ALEA repos are up to date with CatholicOS main and ready to deploy
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):
  1. `alea-institute/ontokit-web` main branch is identical to `CatholicOS/ontokit-web` main (fast-forward merge, no conflicts)
  2. `alea-institute/ontokit-api` main branch is identical to `CatholicOS/ontokit-api` main (fast-forward merge, no conflicts)
  3. Both repos' GitHub main branches show the v0.3.0 commits (PostgreSQL index, upstream tracking, etc.)
**Plans**: TBD

### Phase 8: Optional Auth
**Goal**: Users can browse ontology content publicly without signing in, while existing Zitadel auth continues working for editors
**Depends on**: Phase 7
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Setting `AUTH_DISABLED=true` starts both services without Zitadel configuration and without errors
  2. An unauthenticated visitor can open the app, browse projects, and navigate the ontology tree without logging in
  3. Edit, commit, and pull request UI elements are not visible when auth is disabled
  4. Visiting the app with `AUTH_DISABLED` unset (or `false`) shows the normal login page and full editor functionality after sign-in
  5. API endpoints return data (not 401) for GET requests when auth is disabled, while write endpoints remain protected
**Plans**: 2 plans
Plans:
- [ ] 08-01-PLAN.md — Backend auth bypass: AUTH_DISABLED config + anonymous user in ontokit-api
- [ ] 08-02-PLAN.md — Frontend auth bypass: anonymous session + hidden auth UI in ontokit-web

### Phase 9: Production Deployment
**Goal**: ontokit.openlegalstandard.org serves the FOLIO ontology browser running CatholicOS main on the production server
**Depends on**: Phase 8
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05
**Success Criteria** (what must be TRUE):
  1. PostgreSQL is installed, running, and accepting connections on the production server (54.224.195.12)
  2. Both `ontokit-web` and `ontokit-api` systemd services are running from CatholicOS main (not folio-adapter branches)
  3. The ontology index is populated and `/api/v1/projects/{id}/ontology/classes` returns results
  4. Visiting https://ontokit.openlegalstandard.org in a browser shows the FOLIO ontology browser with no login prompt
  5. Caddy, systemd unit files, and `.env` files on the server reflect the full-stack configuration (Postgres DSN, AUTH_DISABLED, etc.)
**Plans**: TBD

### Phase 10: Anonymous Suggestions
**Goal**: Anonymous users can suggest changes on public projects without signing in, with optional name/email collection after submission for admin follow-up
**Depends on**: Phase 8 (AUTH_MODE support), Phase 9 (production deployment)
**Requirements**: ANON-01, ANON-02, ANON-03, ANON-04, ANON-05, ANON-06, ANON-07
**Success Criteria** (what must be TRUE):
  1. Anonymous visitor sees "Suggest Changes" button on ClassDetailPanel for public projects when `AUTH_MODE != required`
  2. Anonymous visitor can enter edit mode, modify labels/comments/annotations, and submit a suggestion without signing in
  3. After clicking "Submit", a modal asks "Want credit for your suggestions?" with optional name and email fields
  4. Suggestion appears in admin review queue with submitter name/email if provided, or marked "Anonymous" if not
  5. Signed-in users with editor+ role see "Edit Item" (existing flow, unchanged)
  6. Signed-in users with suggester role see "Suggest Changes" (existing flow, unchanged)
  7. When Zitadel/OAuth is configured in optional mode, "Sign in for full editing" link appears alongside the suggestion button
**Plans**: 3 plans
Plans:
- [x] 10-01-PLAN.md — Backend: Anonymous token + session endpoints + rate limiting (ontokit-api)
- [x] 10-02-PLAN.md — Frontend: Anonymous API client + session hook + credit modal (ontokit-web)
- [x] 10-03-PLAN.md — Frontend: UI integration (Propose Edit button + editor wiring + review display)

### Phase 11: Roles, LLM Abstraction & Cost Controls
**Goal**: Project owners can configure LLM providers with cost-capped access, and every role (admin/editor/suggester/anonymous) knows exactly which LLM affordances it can reach
**Depends on**: Phase 10
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, COST-01, COST-02, COST-03, COST-04, COST-05, COST-06, COST-07
**Success Criteria** (what must be TRUE):
  1. Project owner can open project settings, select an LLM provider (OpenAI, Anthropic, local Ollama), and save an API key — LLM features activate without requiring a code deploy
  2. A BYO-key user can enter their own API key in project settings and have their calls billed to them directly, not the project; their calls do not appear in the project usage dashboard
  3. LLM features show a "Budget exhausted" state and degrade gracefully to manual suggestion mode when the project monthly cap is reached; manual suggestions continue to work uninterrupted
  4. Project owner sees a usage dashboard showing per-user call counts, estimated cost, current budget consumption, and burn rate
  5. An anonymous visitor sees no LLM affordances anywhere in the editor; a suggester sees LLM access up to 100 calls/day; an editor sees LLM access up to 500 calls/day; an admin sees LLM access with self-merge permissions
**Plans**: 6 plans
Plans:
- [x] 11-00-PLAN.md — Wave 0: Test stubs for backend pytest and frontend Vitest (Nyquist compliance)
- [x] 11-01-PLAN.md — Backend: DB models, Alembic migration, LLM provider registry (13 providers), crypto, pricing
- [x] 11-02-PLAN.md — Backend: Rate limiter, budget enforcer, role gates, audit logger, FastAPI routes
- [x] 11-03-PLAN.md — Frontend: TypeScript types, API client, BYO key store, LLM hooks
- [x] 11-04-PLAN.md — Frontend: LLMSettingsSection + LLMUsageSection in project settings page
- [x] 11-05-PLAN.md — Frontend: BYOKeyPopover, LLMBudgetBanner, LLMRoleBadge, member list toggle, editor layout wiring
**UI hint**: yes

### Phase 12: Toolchain Integration & Duplicate Detection
**Goal**: The backend can query the FOLIO graph, extract definitions from reference texts, check logical consistency, and tell any caller whether a proposed class/property is a duplicate of something already in the ontology
**Depends on**: Phase 11 (LLM abstraction must exist before generation-layer can call embeddings)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04, DEDUP-05, DEDUP-06, DEDUP-07, DEDUP-08
**Success Criteria** (what must be TRUE):
  1. A developer can call the folio-python structural similarity endpoint and get back parent/sibling lists for any class IRI in the ontology
  2. The ANN embeddings index is pre-computed for all 18,326+ FOLIO classes and properties, and a lookup returns results in under 200ms
  3. After a merge to main, the ANN index rebuilds automatically without manual intervention
  4. Submitting a class with a label that exactly matches an existing class blocks submission and shows the existing entity — the user cannot bypass this
  5. Submitting a class with a semantically similar label (score 0.80-0.95) shows a warning with candidate matches, letting the user decide whether to proceed or link to the existing entity
**Plans**: 5 plans
Plans:
- [x] 12-00-PLAN.md — Wave 0: Install folio-python + create test stubs for all Phase 12 services
- [x] 12-01-PLAN.md — Backend: DuplicateRejection model, Pydantic schemas, HNSW + duplicate_rejections Alembic migration
- [x] 12-02-PLAN.md — Backend: StructuralSimilarityService (folio-python), GlossExtractionService (stub), ReasonerService (owlready2), validation endpoint
- [x] 12-03-PLAN.md — Backend: All-branch semantic search, webhook rebuild trigger, startup freshness check, branch cleanup
- [x] 12-04-PLAN.md — Backend: DuplicateCheckService (composite 40/40/20 scoring), duplicate-check API endpoint, suggestion rejection extension

### Phase 13: Validation Guardrails & Suggestion Generation
**Goal**: LLM suggestions for child classes, sibling classes, annotations, parents, and relationship edges are available via API, filtered through duplicate detection, and blocked by pre-submit validation before they can enter a user's draft
**Depends on**: Phase 12 (ANN index and folio-python must be operational)
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, VALID-06, GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, GEN-09
**Success Criteria** (what must be TRUE):
  1. Calling the suggestion generation API for a class returns structured suggestions tagged with provenance (llm-proposed / user-written / user-edited-from-llm) and a confidence score where the LLM provides one
  2. Every generated suggestion includes ontology context in the prompt — the current class, its parents, existing siblings, and existing annotations are present in what the LLM receives
  3. A new class with no parent, no English label, or an IRI in a foreign namespace is blocked at validation with a specific inline error message before the user can submit
  4. A cycle introduced by a suggested parent assignment is detected and blocked, with a message identifying the cycle path
  5. New IRIs are minted using the project's namespace with UUID-based local names — no accidental collisions with existing IRIs
**Plans**: 4 plans
Plans:
- [x] 13-00-PLAN.md — Wave 0: Test stubs for all Phase 13 services (Nyquist compliance)
- [x] 13-01-PLAN.md — Backend: Pydantic schemas, ValidationService (VALID-01..06), IRI minting
- [x] 13-02-PLAN.md — Backend: OntologyContextAssembler, 5 prompt templates, PROMPT_BUILDERS dispatch
- [x] 13-03-PLAN.md — Backend: SuggestionGenerationService pipeline, generate-suggestions + validate-entity API routes

### Phase 14: Inline Suggestion UX & Property Support
**Goal**: Users can trigger LLM suggestions from the class detail panel or walk through a branch in flashcard mode, accept/reject/edit suggestions in one click, and browse and improve properties (ObjectProperty, DataProperty, AnnotationProperty) using the same pipeline
**Depends on**: Phase 13 (suggestion generation endpoints must be live)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, PROP-01, PROP-02, PROP-03, PROP-04, PROP-05
**Success Criteria** (what must be TRUE):
  1. Every class detail panel has a "Suggest improvements" button; clicking it shows LLM-generated suggestions inline without navigating away
  2. User can enter flashcard iterator mode from any tree branch, step forward and backward through classes sequentially, and return to inline mode without losing their session
  3. Each suggestion card has three affordances visible without scrolling: accept (one click), reject (one click), and edit-then-accept (inline text edit)
  4. A counter in the editor header shows the current session's pending suggestion count, updating in real time as suggestions are accepted or rejected
  5. User can open a property tree panel, select an ObjectProperty, and request LLM suggestions for domain/range, duplicate detection, and validation — using the same UI affordances as the class workflow
**Plans**: 5 plans
Plans:
- [x] 14-00-PLAN.md — Wave 0: Test stubs for suggestion store, hook, and API client (Nyquist compliance)
- [x] 14-01-PLAN.md — Data layer: Generation API client, Zustand suggestion store, useSuggestions hook
- [x] 14-02-PLAN.md — UI components: SuggestionCard, SuggestionSkeleton, SuggestImprovementsButton, ScopeToggle, GroupSection, PendingSuggestionBadge, BranchNavigator
- [x] 14-03-PLAN.md — Class integration: ClassDetailPanel suggestion slots, editor layout wiring, keyboard shortcuts
- [x] 14-04-PLAN.md — Property integration: PropertyDetailPanel suggestion slots, property tab wiring
**UI hint**: yes

### Phase 15: Session Clustering & Batch Submit
**Goal**: At submit time, the system automatically groups a user's accumulated suggestions into ancestor-based PR shards, the user can review and adjust the proposed groupings, and each approved shard becomes a single trackable PR
**Depends on**: Phase 14 (suggestions must be accepted into a session before clustering can run)
**Requirements**: CLUSTER-01, CLUSTER-02, CLUSTER-03, CLUSTER-04, CLUSTER-05, CLUSTER-06, CLUSTER-07, CLUSTER-08, CLUSTER-09
**Success Criteria** (what must be TRUE):
  1. Clicking "Submit session" triggers automatic clustering and shows the user a shard preview tree — a visual breakdown of which suggestions land in which proposed PR, grouped by common ancestor
  2. The preview tree lets the user merge two shards, split a shard, or rename a shard label before submitting — changes are reflected immediately in the preview
  3. A shard with fewer than 3 suggestions is automatically rolled into a "Miscellaneous improvements" shard rather than creating a near-empty PR
  4. Each shard becomes exactly one commit; shards are grouped into PRs by subtree branch (1-N PRs per session), splitting when a PR would exceed ~10 shards or ~50 suggestions; a suggestion never appears in more than one commit
  5. GitHub's commit tab within each PR serves as the shard navigator; the reviewer approves/rejects per-PR and drills into commits for shard-level feedback
**Plans**: TBD
**UI hint**: yes

### Phase 16: Reviewer Enhancements
**Goal**: Reviewers of LLM-assisted suggestions can see provenance, confidence, and duplicate-detection context alongside the existing diff view, and can act on whole batches or individual shards without leaving the existing review page
**Depends on**: Phase 15 (batch + shard data must flow through to reviewer queue)
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03, REVIEW-04, REVIEW-05
**Success Criteria** (what must be TRUE):
  1. An LLM-proposed suggestion displays identically to a human-written suggestion in the diff view — the existing approve/reject/request-changes workflow works without modification
  2. Every suggestion in the diff view shows a provenance badge (llm-proposed / user-written / user-edited-from-llm) and, where available, an LLM confidence score
  3. A collapsible "Similar existing entities" panel appears for each suggestion, showing the top duplicate-detection candidates and their composite scores
  4. Batch-submitted suggestions appear under a batch header in the review queue; the reviewer can approve or reject the entire batch with one action, or expand it to act per-shard
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Sync ALEA Forks | v0.3.0 | ✓ | Complete | 2026-04-03 |
| 8. Optional Auth | v0.3.0 | 2/2 | Complete | 2026-04-03 |
| 9. Production Deployment | v0.3.0 | 1/1 | Complete | 2026-04-03 |
| 10. Anonymous Suggestions | v0.3.0 | 3/3 | Complete | 2026-04-03 |
| 11. Roles, LLM Abstraction & Cost Controls | v0.4.0 | 6/6 | Complete    | 2026-04-06 |
| 12. Toolchain Integration & Duplicate Detection | v0.4.0 | 5/5 | Complete    | 2026-04-06 |
| 13. Validation Guardrails & Suggestion Generation | v0.4.0 | 4/4 | Complete    | 2026-04-07 |
| 14. Inline Suggestion UX & Property Support | v0.4.0 | 5/5 | Complete   | 2026-04-07 |
| 15. Session Clustering & Batch Submit | v0.4.0 | 0/TBD | Not started | - |
| 16. Reviewer Enhancements | v0.4.0 | 0/TBD | Not started | - |
