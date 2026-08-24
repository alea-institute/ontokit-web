# CatholicOS final batch manifest

**Prepared:** 2026-08-21
**Status:** Held planning artifact; do not create, update, push, or merge any CatholicOS issue or pull request from this document yet.
**Authority:** The user authorized one issue-first batch after the remaining local implementation and validation work is complete. No self-merge is authorized.

## Purpose

This manifest turns the delivery map into an executable publication queue. It does not replace the detailed T1 drafts or the PR Party activation package. It records what must exist, how records link, which local evidence belongs to each tranche, and what must still be refreshed immediately before the authorized batch.

The batch is issue-first:

1. Refresh CatholicOS `dev` in both repositories and search every target tracker for duplicates.
2. Freeze and replay each proposed branch against that refreshed base.
3. Create or update all owning issues.
4. Create the corresponding pull requests with explicit `Closes`, `Related`, and `Supersedes` links.
5. Publish the cross-repository dependency index after every URL is stable. Prefer an existing CatholicOS organization-wide tracking issue; otherwise use one umbrella issue in `CatholicOS/ontokit-api`, the dependency backbone for this batch.
6. Request review; never self-merge.

Any failed replay, red verification gate, ambiguous issue owner, or changed external premise stops the affected tranche. Unaffected tranches may remain drafted, but the batch must not pretend the stopped tranche is ready.

Every external record carries a stable correlation marker such as `ontokit-2026-08-t3-api-generation`. Search that exact marker immediately before each mutation, not only at the start of the batch. Record every returned URL in the publication journal before proceeding. After an interruption, resume from the first incomplete row; update or skip an exact existing match and stop on ambiguous matches.

## Linkage contract

Every code PR must have exactly one owning issue in its repository. Cross-repository issues and prerequisite issues are `Related`, not `Closes`. A PR that replaces an old prefix names it as `Supersedes` but does not close it until a CatholicOS reviewer confirms the replacement. A mixed ALEA source commit is replayed at file/feature level and the PR body names both the included and excluded seams.

Independent delivery branches start directly from refreshed CatholicOS `dev`. A PR that cannot compile or test without an unmerged prerequisite uses an explicit stack: its branch starts from the prerequisite delivery branch, its PR targets that branch, and its body names the dependency. After the prerequisite merges, rebase the child onto refreshed `dev`, retarget it, rerun every gate, and update the immutable receipt. Never copy prerequisite files into a nominally independent diff.

Use these placeholders consistently until the pre-send refresh resolves them:

- `[WEB-Tn-ISSUE]`, `[API-Tn-ISSUE]`, `[ORG-Tn-ISSUE]` — owning issue URL.
- `[WEB-Tn-PR]`, `[API-Tn-PR]`, `[ORG-Tn-PR]` — linked PR URL.
- `[FINAL-WEB-SHA]`, `[FINAL-API-SHA]` — immutable tested source heads.
- `[WEB-DEV-SHA]`, `[API-DEV-SHA]` — refreshed CatholicOS bases.
- `[RECEIPT]` — exact command result or live acceptance record, never a generic “tests pass.”

## Batch index

| Order | Tranche | Required issue records | Proposed PR records | Current readiness | Send condition |
|---:|---|---|---|---|---|
| T1 | Optional auth, anonymous contribution, public viewing | web issue or refreshed equivalent; API #83 update | web replacement/refresh for #57; API replacement/refresh for #27 | Complete local synthesis pair is green | Final base refresh and clean replay |
| T2 | DEV deploy and CI | API #211 update plus one deploy/CI owner if #211 is too narrow; web CI owner only if no current issue exists | API deploy/CI PR; web CI companion only if it carries code not already in T1 | Current-upstream candidates are green at API `56800cda` and web `256d2344` | Required-check design is documented; PROD activation remains visibly dormant |
| T3 | LLM configuration and controlled generation | one web owner; one API umbrella plus one child owner for each independently mergeable API PR | web configuration/UI PR; API configuration/generation/hardening PRs sized for review | Paired current-upstream candidates are green at API `1b8bde28` and web `2c6a7813` | Hold for the issue-first final batch; split API configuration/generation/hardening only if reviewer capacity requires it |
| T4 | Trust ladder, distinct decisions, and auto-accept | one web trust/UI owner and one API trust/lifecycle owner | linked web/API PR pair | Paired reviewed current-upstream candidates are green at API `1029cd26` and web `6890216b` | Authenticated quiet-period, halt/resume, and TRUSTED-gate UAT receipt |
| T5 | PR Party | web and API feature owners; D5 API control owner; `.github` answerer issue | web/API PRs, D5 API PR, and held organization answerer PR | Mirror lifecycle/status foundation is green in the combined T4/T5 heads; D5 is reviewed and green; main PR Party synthesis remains | Demo ready, org approval, credential intake, webhook/token gates, live-E2E window |
| T6 | Translation provenance | one web owner and one API owner | linked web/API PR pair | ALEA implementation and real-seam API proof exist | Current-upstream replay plus authenticated visual/live acceptance |
| T7 | Editor preference and annotation round-trip | required web preference owner; web #361 update; API #212 owner | web preference/round-trip PRs; API annotation parity PR | Local residuals are green | Authenticated preference UAT and scoped serialization/parity receipts |
| T8 | Cross-feature correctness and dependency residuals | existing web #344, #345, #348, #359, #360; API #208 and #209; create no duplicates | small issue-linked web/API PRs, split by owner feature | Local residual branches are green | Replay only after each prerequisite feature tranche exists upstream |
| T9 | Documentation learnings | no issue by default | docs-only PR only for learnings CatholicOS maintainers will actively use | Source docs mapped | Record an explicit omit or destination rationale per learning |
| T10 | Demo mode and picker deltas | one web demo owner and one API demo owner; picker tracked separately from CatholicOS code | web/API demo PR pair; deployment/picker changes only in their owning repository | U8/U9 code is green locally | Demo PRs: private repos, separate scoped credentials, live isolation/UAT. Picker: confirmed domain control. |

## Publication journal

This table is the crash-safe execution record. `planned` means no external mutation has occurred. Expand a conditional split into one row per actual record before the first send.

| Correlation marker | Repository | Issue state | Issue URL | PR state | PR URL |
|---|---|---|---|---|---|
| `ontokit-2026-08-t1-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t1-api` | `CatholicOS/ontokit-api` | planned update | — | planned | — |
| `ontokit-2026-08-t2-api` | `CatholicOS/ontokit-api` | planned update/owner | — | planned | — |
| `ontokit-2026-08-t2-web` | `CatholicOS/ontokit-web` | conditional | — | conditional | — |
| `ontokit-2026-08-t3-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t3-api-config` | `CatholicOS/ontokit-api` | planned child | — | planned | — |
| `ontokit-2026-08-t3-api-generation` | `CatholicOS/ontokit-api` | planned child | — | planned | — |
| `ontokit-2026-08-t4-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t4-api` | `CatholicOS/ontokit-api` | planned | — | planned | — |
| `ontokit-2026-08-t5-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t5-api` | `CatholicOS/ontokit-api` | planned | — | planned | — |
| `ontokit-2026-08-t5-api-d5` | `CatholicOS/ontokit-api` | planned | — | planned | — |
| `ontokit-2026-08-t5-org` | `CatholicOS/.github` | planned | — | planned | — |
| `ontokit-2026-08-t6-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t6-api` | `CatholicOS/ontokit-api` | planned | — | planned | — |
| `ontokit-2026-08-t7-web-preference` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t7-web-annotation` | `CatholicOS/ontokit-web` | planned #361 update | — | planned | — |
| `ontokit-2026-08-t7-api-annotation` | `CatholicOS/ontokit-api` | planned #212 update | — | planned | — |
| `ontokit-2026-08-t8-web-344` | `CatholicOS/ontokit-web` | planned #344 update | — | planned | — |
| `ontokit-2026-08-t8-web-345` | `CatholicOS/ontokit-web` | planned #345 update | — | planned | — |
| `ontokit-2026-08-t8-web-348` | `CatholicOS/ontokit-web` | planned #348 update | — | planned | — |
| `ontokit-2026-08-t8-web-359` | `CatholicOS/ontokit-web` | planned #359 update | — | planned | — |
| `ontokit-2026-08-t8-web-360` | `CatholicOS/ontokit-web` | planned #360 update | — | planned | — |
| `ontokit-2026-08-t8-api-208` | `CatholicOS/ontokit-api` | planned #208 update | — | planned | — |
| `ontokit-2026-08-t8-api-209` | `CatholicOS/ontokit-api` | planned #209 update | — | planned | — |
| `ontokit-2026-08-t9-docs` | destination selected at refresh | conditional/omit | — | conditional/omit | — |
| `ontokit-2026-08-t10-web` | `CatholicOS/ontokit-web` | planned | — | planned | — |
| `ontokit-2026-08-t10-api` | `CatholicOS/ontokit-api` | planned | — | planned | — |
| `ontokit-2026-08-batch-index` | existing org tracker or `CatholicOS/ontokit-api` | planned umbrella | — | not applicable | — |

## Held issue and PR briefs

### T1 — optional auth, anonymous contribution, and public viewing

Use the complete drafts in `T1-ISSUES.md` and `T1-PRS.md`. The local candidates are web `4986135c` and API `d2c31aea`. Preserve optional mode with all Zitadel values absent; refuse partial configuration and required mode without a coherent provider.

### T2 — DEV deploy and CI

**Issue title:** Make OntoKit deploys immutable, preflight-safe, and enforceable by CI

**Problem statement:** The integration workflow can deploy, but strict plan acceptance also requires immutable matched revisions, validation before host mutation, running-image truth, rollback/smoke evidence, and required checks on the deploy branch. API #211 owns the false-success/runtime-truth defect; use a broader owner issue only for acceptance criteria that do not belong in #211.

**Proposed API PR title:** `ops: make DEV deploys immutable and promotion fail closed`

**PR scope:** local deploy-truth fix, matched release manifest, write-path smoke, dormant protected-environment promotion scaffold, forced-command and rollback evidence. The PR must state that it grants no PROD activation authority.

The acceptance checklist also requires explicit least-privilege workflow permissions, CODEOWNERS approval for workflow changes, reviewed branch protection, a deploy-branch-restricted protected PROD environment, and proof that the forced-command deploy key cannot execute arbitrary shell. Separately authorized Stage B follows the settled parallel stand-up, UAT, then DNS-cutover path; this batch publishes rollout-neutral Stage A only.

**Proposed web PR title:** `ci: enforce the web integration quality gates`

Create this companion only if refreshed upstream still lacks the web workflow changes and they cannot be reviewed cleanly with another web tranche. Required-status configuration is repository state, not code; record it as an activation checklist rather than claiming the workflow file alone enforces it.

### T3 — LLM configuration and controlled generation

**Issue titles:**

- Web: `Add project-scoped LLM configuration and guarded generation UX`
- API umbrella: `Add project-scoped LLM providers and controlled ontology generation`
- API configuration child: `Add project-scoped LLM provider configuration`
- API generation child: `Add metered and policy-bound ontology generation`

**Problem statement:** OntoKit needs explicit project/provider configuration, metering and failure visibility, constrained generation, and safe public/auth boundaries. Before drafting final PRs, re-audit the mapped seam against the tracked retrospective (`docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md`), the focused cost/infrastructure review (`docs/residual-review-findings/u6-lens4.md`), and the current integration code. Confirmed findings either land in the owning PR or receive linked issues with a reasoned deferral.

**Proposed PR titles:**

- Web: `feat: add project-scoped LLM configuration and guarded generation`
- API configuration: `feat: add project-scoped LLM provider configuration`
- API generation/hardening: `feat: add metered and policy-bound ontology generation`

Each independently mergeable API PR closes its own child issue; the API umbrella remains open and is only `Related`. Keep provider configuration before generation and name the exact dependency in the latter PR. If the generation branch requires unmerged configuration code, use the explicit stack/retarget contract above.

Before either API branch freezes, complete this security closure ledger. Each row must name current code evidence, disposition (`fixed here`, `linked issue`, or `not reproducible`), exact verification, and whether it blocks real-key deployment:

- custom-provider SSRF bypass, DNS rebinding, and outbound error-body exposure — **fixed locally:** API `a4be506b` requires an exact approved private origin, resolves once, pins the validated numeric address through the connection, blocks metadata, disables redirects, and returns/logs only safe failure detail; web `a272c8dc` preserves structured machine-readable errors while presenting a user-safe message;
- prompt/output/RDF injection and server-side IRI/Turtle validation — **verified in the held source:** shared prompt delimiters/caps, strict JSON parsing, server-side safe-IRI checks, web Turtle IRI refusal, save/submit Turtle parsing, and server-derived mint detection all have focused coverage;
- atomic budget reservation, missing-usage estimation, `test_connection` metering, and failure audit — **fixed locally:** API `35a25c56` atomically reserves paid embedding spend and meters connection tests; API `f89b8222` applies the same pre-actuation boundary to ordinary generation with a conservative output allowance and successful-use reconciliation. Failure/cancellation receipts remain budget-visible, finalization outages alert without reopening the cap, and provider adapters estimate missing usage;
- embedding/dedup integrity, project-level job throttling, and merge-triggered reindexing — **fixed locally:** API `5a67885f` adds the project-level lease/queue contract; API `d7477474` fixes completed-job coverage and validates paid-provider transitions before mutation; API `738f20a6` replaces incremental full-refresh writes with a retry-safe private snapshot and source-revision-checked atomic activation, uses conflict-safe single-entity upserts, enforces persisted dimensions, and installs valid dimension-specific HNSW indexes. Merge-triggered refresh remains covered;
- server-side minting authorization, submit idempotency, trust/rate-limit expiry, and actuator retry behavior — **mostly verified/fixed:** server-derived mint checks and branch-level cross-process submission serialization already exist; PR Party actuation has durable idempotency/degraded-retry coverage; API `92c7e2b8` repairs TTL-less trust and PR Party counters with non-extending `EXPIRE NX`;
- provider-key encryption/KDF, log redaction, and fail-soft alerting — **fixed locally:** API `a48e534b` moves LLM and embedding keys to domain-separated HKDF-SHA256 while retaining legacy-decrypt migration, and API `367145b2` emits stable structured validation/dedup outage alerts without raw tenant text or exception detail.

Held source heads are API `fix/t3-security-api` at `738f20a6` and web `fix/t3-security-web` at `a272c8dc`. The generation slice passes 54 focused tests; the final vector-adjacent slice passes 137 unit tests; and five disposable real-PostgreSQL tests prove concurrent spend serialization, migration/index validity, unique snapshot IDs, and duplicate behavior. Ruff, strict changed-source mypy, advisory Pyright, and diff checks pass. The web receipt remains the full 208-file/3,295-test suite, type-check, changed-file ESLint, and diff checks. The API's broader synchronous `TestClient` route harness stalls on its first anonymous-route case in this environment, so it is not claimed as passing; real-PostgreSQL/Redis replay remains part of final synthesis validation. Neither branch is pushed or merged.

The API delivery candidate is synthesized on `upstream-queue/t3-api-synthesis` at `1b8bde28`, based on T1 synthesis `d2c31aea`. The empty-to-head migration, 154 focused non-`TestClient` unit tests, four direct route-hardening tests, and two real-PostgreSQL vector-integrity tests pass; Ruff, formatting, and diff checks are green. Targeted mypy reports only the pre-existing FOLIO annotation mismatch outside T3.

The web delivery candidate is synthesized on `upstream-queue/t3-web-synthesis` at `2c6a7813`, based on T1 synthesis `4986135c`. All 175 test files and 2,891 tests pass; type-check passes; lint has zero errors and 18 warnings; and the optional/no-Zitadel production build emits 22 static pages. A read-only refresh confirmed both candidates descend from unchanged CatholicOS `dev` heads web `c714c74b` and API `a21b7d5c`. Both candidates are local and unpushed; publication remains held for the final issue-first batch.

The web acceptance matrix must cover the generation entry point, missing/invalid provider configuration, in-progress state, zero-result state, partial/provider failure, successful suggestions, and explicit human accept/reject, with authenticated browser receipts for every reachable state.

### T4 — trust ladder and auto-accept

**Issue titles:**

- Web: `Expose trust policy, outcomes, and auto-accept controls`
- API: `Implement auditable trust progression and quiet-period auto-accept`

**Proposed PR titles:**

- Web: `feat: add trust-ladder and auto-accept administration`
- API: `feat: add auditable trust progression and auto-accept`

The API acceptance receipt must include elapsed quiet period, halt/resume behavior, TRUSTED gating, the submitter snapshot, and the `system:auto-accept` decider for an automatic outcome. Human actor identity is recorded separately for objections and manual resolutions. Do not convert the existing implementation evidence into a live-UAT claim.

The local API delivery candidate is now `upstream-queue/t4-distinct-t5-sync-api` at `1029cd26`, based on T4 API `8d6fc226`. It adds auditable distinct decisions and the PR/GitHub lifecycle foundation without regressing trust or `system:auto-accept`. Its full suite passes 2,150 tests; all nine real-PostgreSQL proofs pass; Ruff and changed-source mypy are clean; Alembic has one reversible head; and legacy mirror receipts are bound to their repository identity during migration. The remaining full-project mypy findings are the pre-existing embedding-model shim, outside this tranche.

The local web delivery candidate is now `upstream-queue/t4-distinct-t5-sync-web` at `6890216b`, based on T4 web `d4ed4581`. All 186 test files and 3,003 tests pass; type-check passes; lint has zero errors and 18 pre-existing warnings; and the optional/no-Zitadel production build emits 22 static pages. Both combined candidates completed local `ce-code-review`; every actionable API finding was applied and the web review has no remaining finding. External code egress was denied before transmission. Both branches are local, unpushed, and unmerged; authenticated DEV UAT remains a send condition rather than a claimed receipt.

### T5 — PR Party

Use `../pr-party/HELD-ACTIVATION-PACKAGE.md` for the organization answerer issue/PR, outreach, integrity checks, and live E2E. Create repository feature issues for the web and API seams after duplicate search.

**Feature issue titles:**

- Web: `Add the PR Party review workspace and Q&A lifecycle`
- API: `Add PR Party intake, reviewer identity, reconciliation, and Q&A`
- API D5: `Add an operator-safe reviewer-credential ciphertext rewrap`

**Proposed PR titles:**

- Web: `feat: add the PR Party review workspace`
- API: `feat: add the PR Party service and GitHub reconciliation`
- API D5: `ops: add safe PR Party credential rewrap`

D5 source is local API `f3c4251d`. Its PR closes only the D5 control issue and relates the main PR Party issue. It re-encrypts the same stored PAT under the current application key; it does not replace or revoke the GitHub PAT. The retryable mirror lifecycle/status foundation is already synthesized in API `1029cd26` and web `6890216b`; the remaining local T5 work is the main PR Party feature seam. Deployment and execution remain a separately controlled application-key-rotation step.

### T6 — translation provenance

**Issue titles:**

- Web: `Add multilingual translation coverage and review surfaces`
- API: `Add provenance-preserving translation generation and review`

**Proposed PR titles:**

- Web: `feat: add translation coverage and review surfaces`
- API: `feat: add provenance-preserving translation workflows`

The final bodies must link the pair, identify the API real-Postgres/git lifecycle receipt, and record authenticated visual acceptance for settings, editor annotations, coverage, backfill, and review.

### T7 — editor preference and annotation round-trip

**Issue titles:**

- Web preference: `Persist the ontology editor mode preference`
- Web annotation: update CatholicOS web #361 rather than creating a duplicate
- API parity: use CatholicOS API #212

**Proposed PR titles:**

- Web: `feat: persist the ontology editor mode preference`
- Web: `fix: preserve annotation values through class edits`
- API: `fix: align indexed and RDF annotation classification`

Keep the small editor-preference change separate from annotation serialization unless refreshed upstream makes that separation artificial. Preference acceptance requires default auto-save on navigate-away, the first-save teaching toast, an immediately effective manual Save affordance when selected, persisted state, and reconciliation with the legacy hide-save-button control so contradictory states are impossible. The web annotation PR must prove unchanged untagged labels and subject form remain stable; the API PR must prove cold/indexed parity for declared custom annotation properties.

### T8 — cross-feature correctness and dependencies

Use the existing issues as owners wherever their scope matches:

- web #344 and #345 — U7 sweep fixes;
- web #348 — audit UI hardening;
- web #359 — deterministic Storage in the Node 25 test runner;
- web #360 — coherent server-side Zitadel validation without localhost fallback;
- API #208 — project-bound audit cursors and integration hardening;
- API #209 — exact `folio-python==0.4.0` pin and `owlready2` removal;
- API #212 is owned by T7 and must not be delivered again in T8.

API #211 belongs to T2. If an issue is closed or its current scope differs at refresh time, update or create the narrow replacement before opening the PR. These PRs are deliberately small, but many depend on types or services introduced by earlier tranches; never replay them onto upstream in isolation merely to make the diff appear smaller.

### T9 — documentation learnings

For every mapped learning, record one of:

1. destination path and PR;
2. folded into the owning code PR because it documents that seam; or
3. omitted because it is ALEA-specific process history rather than durable CatholicOS guidance.

Do not create a documentation issue merely to account for a commit. The batch index must retain the omit rationale so the 277-commit ledger remains complete.

### T10 — demo mode and picker deltas

**Issue titles:**

- Web: `Add a clearly identified resettable demo-project experience`
- API: `Provision and isolate resettable demo projects`

**Proposed PR titles:**

- Web: `feat: add the resettable demo-project experience`
- API: `feat: provision and isolate resettable demo projects`

Source heads are web `d7e490ec` and API `b5b13d8f`, including API refresh ancestor `e894f20f`. The API issue owns immutable source/destination identity, exact-two-repository authorization, idempotent provisioning/resync, and branch-preserving refresh. The web issue owns entry/exit, server-truth status, exact resettable-repository naming, unavailable/preparing states, and accessible responsive behavior.

The activation receipt disables ambient Git credential helpers, proves the source credential can read the approved source but cannot push, and proves the destination credential can write exactly the two demo repositories but fails against an approved third-repository canary. Token material remains redacted. Web acceptance requires a persistent server-truth banner naming the exact dummy repository, exit to the originating live project, blocking preparation and actionable unavailable states, keyboard-only entry/exit, visible focus, semantic status/banner announcements, non-color-only state, and responsive touch targets.

The picker is not bundled into a CatholicOS PR unless its eventual hosting/configuration repository is CatholicOS-owned. Public RDAP and DNS checks on 2026-08-21 still show no registered/delegated `ontokit.org`; picker activation therefore remains held even though registration was selected.

When that gate clears, the picker contract is a static single page that preserves direct instance URLs. Each choice shows its plain-language name, ontology or purpose, intended audience, destination hostname, and current availability. Unavailable choices remain visible with an explanation but cannot be activated. Live acceptance covers links, TLS, redirects, keyboard operation, visible focus, descriptive link names, non-color-only availability, logical focus order, mobile layout, and responsive touch targets.

## Final pre-send checklist

- [ ] Refresh CatholicOS web/API `dev` and record exact SHAs.
- [ ] Refresh issue/PR searches and replace every placeholder without creating duplicates.
- [ ] Freeze every local source branch and ensure no protected user file is included.
- [ ] Rebuild each delivery branch from its refreshed CatholicOS base; do not stack raw ALEA integration history.
- [ ] Run repository-appropriate unit, integration, type, lint, build, security, and browser gates and paste exact receipts.
- [ ] Scan every proposed branch and its introduced history for secrets; verify diffs and generated artifacts contain no credential material.
- [ ] Sanitize pasted receipts so they contain no secret value, ciphertext, authorization header, or sensitive credential identifier.
- [ ] Verify optional auth without Zitadel remains supported in T1 and any later auth-touching tranche.
- [ ] Verify every code PR closes exactly one owning issue and links cross-repository prerequisites as related.
- [ ] Verify every cutoff and post-cutoff source change appears once in the batch index or has an explicit omit rationale.
- [ ] Create/update issues first, then PRs, then the cross-repository index.
- [ ] Recheck each correlation marker immediately before mutation and durably record each returned URL before the next mutation.
- [ ] Request review and leave all PRs unmerged.

## Items intentionally outside publication authority

- AWS security-group, IAM, EC2, Route 53, and PROD changes.
- DNS registration, delegation, or cutover.
- GitHub secrets, environments, branch protection, rulesets, webhooks, or credential installation.
- Demo repository creation or seeding before separate scoped credentials exist.
- PR Party reviewer outreach before demo readiness.
- Google federation before ALEA-side and CatholicOS-side domain-name resolution.

Those actions retain their existing explicit gates even after the issue/PR batch is prepared.
