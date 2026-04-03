# Roadmap: OntoKit Web

## Milestones

- ✅ **v0.2.0 Core Editor** - Phases 1-6 (shipped)
- 🚧 **v0.3.0 Deployment** - Phases 7-10 (in progress)

## Phases

<details>
<summary>✅ v0.2.0 Core Editor (Phases 1-6) - SHIPPED</summary>

Phases 1-6: Mode system, editor decomposition, auto-save, form editing, suggestion workflow, graph visualization, keyboard shortcuts, accessibility. See archived plans for details.

</details>

### 🚧 v0.3.0 Deployment (In Progress)

**Milestone Goal:** Sync ALEA forks with CatholicOS upstream and deploy the full stack to production with optional authentication for public read-only browsing.

- [ ] **Phase 7: Sync ALEA Forks** - Fast-forward both ALEA repos to CatholicOS main
- [x] **Phase 8: Optional Auth** - Make authentication optional via AUTH_DISABLED env var across both repos (completed 2026-04-03)
- [ ] **Phase 9: Production Deployment** - Install Postgres, switch branches, configure env, rebuild, restart on production server
- [ ] **Phase 10: Anonymous Suggestions** - Allow anonymous users to suggest changes on public projects with optional name/email collection

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
**Plans**: TBD

## Progress

**Execution Order:** 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Sync ALEA Forks | v0.3.0 | 0/TBD | Not started | - |
| 8. Optional Auth | 2/2 | Complete   | 2026-04-03 | - |
| 9. Production Deployment | v0.3.0 | 0/TBD | Not started | - |
| 10. Anonymous Suggestions | v0.3.0 | 0/TBD | Not started | - |
