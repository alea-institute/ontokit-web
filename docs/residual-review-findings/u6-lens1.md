# U6 Retrospective Alignment Review — Lens 1: Initial-Requirements Trace

Scope: 2026-08-08 out-of-harness API/web LLM-review fix rounds 1–3 and the FOLIO DEV infrastructure standup. This trace treats `MASTER-OUTLINE.md` as the requirement source and `IN-FLIGHT-STATUS.md` as contemporaneous scope/status evidence, not as authorization. Later plan ratifications are not used as evidence.

## Findings

### [P1] FOLIO DEV was deployed to the host reserved by the final ruling for Catholic DEV

**Requirement.** MASTER-OUTLINE's final, superseding topology says: “**FOLIO DEV *and* PROD both live on the ALEA-funded AWS box**” and “The Damien-funded Hetzner CPX41 (`ontokit-dev`, 178.156.208.239 …) hosts **Catholic DEV + the future `ontokit.org` picker**” (`docs/roundup-2026-08/MASTER-OUTLINE.md:22-30`).

**Built artifact.** The live route sends both web and API traffic to `178.156.208.239` (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:31-39`). The UAT record identifies that address as the “FOLIO DEV” environment and records an 18,566-entity FOLIO import (`docs/roundup-2026-08/DEV-UAT-LOG.md:1-15`).

**Mismatch.** The implementation used the Catholic-DEV/picker host for FOLIO DEV, contrary to the final topology. The earlier same-day ruling that put FOLIO DEV on Hetzner (`MASTER-OUTLINE.md:14-20`) was explicitly superseded by the evening ruling, so it cannot cure this mismatch. A later plan's decision to absorb the deviation likewise is not initial-requirement evidence.

### [P1] The required production-path E2E/persona gate was deferred, and the delivered submit path remained unusable

**Requirement.** MASTER-OUTLINE requires: “exercise all roles (admin / editor / suggester) end-to-end before calling it production” (`docs/roundup-2026-08/MASTER-OUTLINE.md:64-68`), and the review gate specifically required “live-Postgres integration harness” green plus re-verification before DEV deployment (`:34-38`). The intended pipeline is substantive user change → commit → PR on a real repository (`:64-67`).

**Built artifact.** The fix rounds added substantial submit-time validation and duplicate enforcement in `ontokit/services/suggestion_service.py` (`.worker-reports/u6-evidence/api-fixround-code.diff:1237-1350`) and corrected the save path to call the real `commit_changes` method (`:1410-1451`). API commit `9489b536` records round-3 regression evidence and `45b82a42` scopes parent validation (`.worker-reports/u6-evidence/api-fixround-commits.txt:1-2`).

**Mismatch.** Live evidence refutes completion of the asked-for gate. Authentication/persona UAT was explicitly deferred because the deployment used `AUTH_MODE=disabled` (`docs/roundup-2026-08/DEV-UAT-LOG.md:3-8`). Round 2 made every submit fail on restriction-bearing FOLIO ontologies and its tests lacked blank-node-parent fixtures (`:26-39`). After round 3, submit still returned a generic validation 422 and blocked UAT-2/3/4 (`:48-57`). The later re-run then spent more than 60 minutes in an unbounded full-corpus duplicate loop, making submit unusable on the real 18,566-entity ontology (`:79-91`). Thus the rounds aligned in *direction* but did not deliver the required working database→commit→PR loop or all-role end-to-end proof.

### [P1] The explicitly ruled-in demo toggle and two dummy repositories were silently dropped

**Requirement.** Damien's recorded ruling is unambiguous: “build the in-app demo toggle this round, seeded by TWO point-in-time dummy repos (Semantic Canon snapshot + FOLIO.owl snapshot)” (`docs/roundup-2026-08/MASTER-OUTLINE.md:14-18`). The testing requirement separately says “tests and demos hit a throwaway repo, never live data” (`:74-77`).

**Built artifact.** Neither fix-round diffstat contains a demo-mode, toggle, seed, or repository fixture artifact (`.worker-reports/u6-evidence/api-fixround-diffstat.txt`; `.worker-reports/u6-evidence/web-fixround-diffstat.txt`). The contemporaneous scan identified “Demo mode / dummy repo / demo-data cleanup” as absent (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:36-43,77-79`). The environment instead imported the real 18MB FOLIO OWL into a project named FOLIO DEV (`docs/roundup-2026-08/DEV-UAT-LOG.md:10-16`).

**Mismatch.** The required toggle and both point-in-time dummy repos were not built, and the deployed UAT used a real ontology import rather than the required throwaway-repository mechanism. A staging label alone does not satisfy this distinct requirement.

### [P2] DEV was stood up without the required green-check promotion path or underlying CI

**Requirement.** The ruling requires “gated DEV→PROD auto-promotion on green checks” (`docs/roundup-2026-08/MASTER-OUTLINE.md:14-20`); the detailed requirement says DEV is a waypoint and green DEV pushes to PROD programmatically (`:42-46`).

**Built artifact.** The compose evidence contains runtime services, health checks, and container state but no CI or promotion service/workflow (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:1-144`). The same-day status scan states neither repository had test/build CI or a deploy workflow and that auto-promotion was absent (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:44-49,80-81`).

**Mismatch.** A manually stood-up DEV tier was delivered without the requested gated path that makes DEV a waypoint. Container health checks (`dev-infra-compose-and-env.txt:69-78,97-107`) are runtime probes, not green CI checks or programmatic promotion.

### [P2] The live infrastructure standup and its auth-disabled/basic-auth design had no authored initial requirement

**Requirement.** MASTER-OUTLINE asks for “a pre-live tier where changes are validated before touching the live ontology” (`docs/roundup-2026-08/MASTER-OUTLINE.md:74-77`) and establishes target homes (`:22-30`), but it does not specify or authorize this Docker Compose topology, Coolify/Traefik route, `AUTH_MODE=disabled`, or shared HTTP Basic Auth. The status scan described Hetzner/staging as “plan only” at consolidation time (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:44-46`).

**Built artifact.** The stack adds Postgres/pgvector, Redis, MinIO, API, worker, web, named volumes, public host ports, and `APP_ENV: staging` (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:1-133`). It disables app authentication in both API and web (`:63,109-124`). A Traefik Basic Auth middleware was then attached to both public routers (`.worker-reports/u6-evidence/dev-infra-traefik-route.txt:3-26`).

**Mismatch.** The general concept of staging was asked for, but no written initial requirement authored this concrete standup or its temporary authentication architecture. This is therefore extra built scope, independently of whether it was operationally sensible. The UAT log confirms Basic Auth was a reactive security fix after the public auth-disabled system was found to grant every visitor full access to a real GitHub write path (`docs/roundup-2026-08/DEV-UAT-LOG.md:69-77`), not implementation of an initial requirement.

### [P2] Zitadel-backed, role-realistic deployment was replaced by disabled application authentication

**Requirement.** MASTER-OUTLINE asks for “Zitadel SSO login” on a hosted deployment while removing GitHub-account friction (`docs/roundup-2026-08/MASTER-OUTLINE.md:55-57`). It also requires admin/editor/suggester persona testing (`:64-68`).

**Built artifact.** Compose sets `AUTH_MODE: disabled` for API and web (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:63,120`). The UAT log says the dev user has full access and the “persona-gating UAT [was] deferred to a Zitadel-enabled pass” (`docs/roundup-2026-08/DEV-UAT-LOG.md:6-8`).

**Mismatch.** The deployed environment did remove GitHub-login friction, but by eliminating application identity and roles rather than exercising the requested Zitadel/social-login route. Proxy Basic Auth protects the perimeter but cannot establish OntoKit admin/editor/suggester identities. This also explains why the persona requirement was not tested.

### [P2] The requested auto-save/manual-save preference and teaching affordance remained absent

**Requirement.** MASTER-OUTLINE requires auto-save default ON, a preference that can enable a manual Save button, an auto-save/saved teaching toast, and retention of the dirty indicator (`docs/roundup-2026-08/MASTER-OUTLINE.md:95-99`).

**Built artifact.** The web fix-round diffstat lists LLM settings, editor panels/layouts, hooks, and stores but no settings preference or toast implementation (`.worker-reports/u6-evidence/web-fixround-diffstat.txt`). The status scan explicitly says only “Hide Save Button” exists and the auto-save preference is absent (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:36-40,77`). Browser UAT still listed auto-save as pending (`docs/roundup-2026-08/DEV-UAT-LOG.md:41-44`).

**Mismatch.** This explicitly asked-for UX work was not included in any of the three web fix rounds or the deployment work.

### [P3] The deployed compose embeds undocumented fixed service credentials

**Requirement.** No MASTER-OUTLINE requirement asks for fixed database/object-store credentials. The stated LLM hosting intent is cost containment and user-owned keys (`docs/roundup-2026-08/MASTER-OUTLINE.md:79-86`), while the broader LLM requirement emphasizes ontology integrity (`:82`).

**Built artifact.** Compose hard-codes `POSTGRES_PASSWORD: postgres`, the application DB URL with `ontokit:ontokit`, and `MINIO_ROOT_PASSWORD: minio123` / `MINIO_SECRET_KEY: minio123` (`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:5-9,35-38,56-62,88-94`). Only three unrelated secret key names are withheld through `.env` (`:134-137`).

**Mismatch.** These credential choices are additional, undocumented implementation policy, not a traced requirement. Because the services remain on an internal Docker network and only web/API ports are published (`:67,124,127-133`), the evidence does not establish direct public database/MinIO exposure; this finding is limited to lack of requirement provenance and fixed-secret configuration, not a claim of exploitability.

## Traced clean

- **LLM generation was made actually configurable.** Requirement: the system proposes LLM-generated annotations, translations, definitions, and relationships for human approval (`docs/roundup-2026-08/MASTER-OUTLINE.md:79-83`). Built: the web added an exact generation-model selector and persists `model` (`.worker-reports/u6-evidence/web-fixround-code.diff:85-219`); the API now reports configured only when a model exists (`.worker-reports/u6-evidence/api-fixround-code.diff:144-156`). This directly repairs the happy-path model gap rather than expanding scope.

- **Duplicate and ontology-integrity defenses align with the dominant O4 intent.** Requirement: “no duplicate classes/properties, no AI slop; integrity outranks ease” and embeddings may support near-duplicate detection (`docs/roundup-2026-08/MASTER-OUTLINE.md:79-85`). Built: submit-time deterministic label, parent, semantic-duplicate, and validation gates were added (`.worker-reports/u6-evidence/api-fixround-code.diff:1237-1350`); unsafe generated IRIs are rejected server-side (`:1053-1136`) and unsafe Turtle IRIs are rejected in the web serializer (`.worker-reports/u6-evidence/web-fixround-code.diff:653-693`). The live performance/correctness failures are recorded above, but the artifact's purpose is requirement-traceable.

- **Paid-provider controls honor BYOK/cost containment.** Requirement: “users bring their own LLM key; hosting stays cheap, LLM costs land on the user” (`docs/roundup-2026-08/MASTER-OUTLINE.md:85`). Built: unknown paid-model pricing now fails closed before generation (`.worker-reports/u6-evidence/api-fixround-code.diff:95-143,833-901`), paid embeddings pass budget/audit controls (`:450-719`), and generation/merge actuations disable automatic 5xx retry to avoid repeated charges or effects (`.worker-reports/u6-evidence/web-fixround-code.diff:250-380`).

- **Anonymous paid semantic work was closed consistently with BYOK.** Requirement: LLM costs belong to the user, not the host (`docs/roundup-2026-08/MASTER-OUTLINE.md:85`). Built: semantic and duplicate routes changed from optional to required users and add role/budget error handling (`.worker-reports/u6-evidence/api-fixround-code.diff:1-94,157-252`). This is a necessary enforcement detail of the authored cost model.

- **Suggestion state and human-review UX were hardened without changing the asked workflow.** Requirement: LLM proposes and “human approves yes/no per item,” with session/topic grouping (`docs/roundup-2026-08/MASTER-OUTLINE.md:79-86`). Built: suggestion state is scoped by project and branch and API errors are made actionable (`.worker-reports/u6-evidence/web-fixround-code.diff:544-651,694-816`); the session beacon uses the server-issued signed token (`:529-543`).

- **Real commits, branch serialization, and merge truthfulness align with the production pipeline.** Requirement: database → commit → PR on a real repository and contributor-personal branches (`docs/roundup-2026-08/MASTER-OUTLINE.md:64-68`). Built: saves use the real git service's `commit_changes`, mutations take a PostgreSQL advisory transaction lock, and failed PR merges are no longer marked merged (`.worker-reports/u6-evidence/api-fixround-code.diff:1351-1357,1410-1451,1508-1538`). These changes trace directly to making the requested pipeline truthful.

- **Commit identity independently matches the reconciled intent, not merely the later ratification.** Requirement intent combines bot credentials with contributor recognition: “bot *credentials* push, but commit author/`Co-Authored-By` carries the contributor's identity” (`docs/roundup-2026-08/MASTER-OUTLINE.md:58-61`). Contemporaneous implementation evidence says `commit_identity.py` mints per-user noreply authors while `mirror_credential.py` supplies a system machine token (`docs/roundup-2026-08/IN-FLIGHT-STATUS.md:26-30`), and the fix-round save paths continue resolving an author identity before committing (`.worker-reports/u6-evidence/api-fixround-code.diff:1410-1445,1546-1599`). The functional split independently satisfies both halves of the original divergence. Neither supplied fix-round diff shows these two modules being newly created on August 8, so this verdict is about alignment of the ratified artifact, not attribution of its build date.

- **The contribution-workflow documentation is traceable governance, not orphan scope.** Requirement: issue-first upstream, one feature per PR, asynchronous review with local multi-model review, and FOLIO as canary (`docs/roundup-2026-08/MASTER-OUTLINE.md:48-53`). Built: both diffstats record the same 36-line `AGENTS.md` contribution-workflow addition (`.worker-reports/u6-evidence/api-fixround-diffstat.txt`; `.worker-reports/u6-evidence/web-fixround-diffstat.txt`), and web commit `7ac21727` describes it as downstream/upstream contribution workflow (`.worker-reports/u6-evidence/web-fixround-commits.txt:21`).

## Verdict

As a body, the August 8 out-of-harness work honors much of the *functional intent* of the LLM requirements: the fix rounds meaningfully repaired model selection, cost attribution, authorization, duplicate/integrity gates, contributor-attributed real commits, and human-review state. It does not, however, honor the initial requirements as a complete delivery. The live standup contradicted the final host allocation, introduced a concrete infrastructure/auth design that was never authored, omitted the ruled-in demo toggle and two dummy repos, omitted CI-driven DEV→PROD promotion and auto-save UX, deferred Zitadel persona testing, and deployed before the real FOLIO submit path passed end-to-end. The fairest overall verdict is **partially aligned but not requirements-complete or production-path validated**; later plan ratification should not erase those trace failures.
