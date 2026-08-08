---
title: OntoKit Roundup Execution - Plan
type: feat
date: 2026-08-08
origin: docs/roundup-2026-08/MASTER-OUTLINE.md
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: legacy-requirements
execution: code
---

# OntoKit Roundup Execution - Plan

**Target repos:** `ontokit-web` + `ontokit-api` (branch `feat/pr-party` for code; this doc lives on `feat/roundup-brainstorm`) plus deployment infrastructure (CPX41 `ontokit-dev`, hetzner-dev proxy, ALEA AWS box when unblocked).

---

## Goal Capsule

**Objective:** Take the 2026-08 roundup's remaining scope to done: a fully verified FOLIO DEV environment Damien can UAT, demo mode on real-shaped dummy data, the decided editor-UX refinements, CI with gated deploy automation, and the fork's undelivered work mapped and drafted for upstream delivery — with the externally blocked items (AWS PROD, PR Party live E2E, ontokit.org) planned and parked with explicit unblock conditions.

**Authority hierarchy:** The seven session-settled rulings in Key Decisions bind this plan; research or execution evidence that one cannot work stops work and surfaces to Damien — never silently re-decide. Damien's explicit approval gates: any send to the `catholicos` org (issues, PRs, pushes), any action on the AWS box, any spend. Repo conventions (CatholicOS issue-first BAU, fork-push freedom) apply where this plan is silent.

**Stop conditions:** A blocked unit's external gate (Mike's AWS access; Fr. John's four PR-Party gates; ontokit.org registration) stays parked — do not work around it. A P0 finding in the retrospective alignment review (U6) pauses dependent units until triaged.

**Execution profile:** CE harness end-to-end — this plan executes through `ce-work`; implementation and fix tasks fan out to Codex workers per `agents/tier.json` `worker_route`; the orchestrator verifies every artifact and re-runs gates itself; findings adversarially verified before they count. Red-then-green on live seams (real Postgres, real FOLIO data, live DEV) is the default proof style. Browser verification uses chrome-devtools MCP exclusively.

---

## Product Contract

### Summary

Finish and verify what the fork already built (UAT-and-fix loop on live DEV, persona pass, retrospective alignment review), add the three decided product features (demo mode with dummy-repo seeding, auto-save preference, CI/auto-deploy), and produce the gated upstream delivery map — leaving PROD, PR Party E2E, and the picker parked on named external gates.

### Problem Frame

Months of built features (v0.4.0 LLM suggestions, trust ladder, PR Party) sat undelivered and largely unverified against real data: PROD runs a stripped April build, ~690 fork commits have no upstream PRs, demos wrote gibberish toward live stores, and the GSD-built code failed its first real-data contact (three fix rounds and two live blockers found in one day of UAT). The 2026-08-08 roundup consolidated Damien's outlines and the Fr. John transcripts into rulings; this plan is the vetted route from rulings to done, replacing the ad-hoc execution cascade that ran ahead of the harness.

### Requirements

**Verification & hardening**

- R1. Every suggestion lifecycle flow — mint, edit, save, submit, duplicate-block, review, approve/merge, reject, trust credit — completes correctly on DEV against the real FOLIO ontology.
- R2. Submit-time validation accepts legitimate FOLIO-style entities (external and restriction parents included) and returns the specific validation errors in the 422 payload, never a bare generic message.
- R3. Ontology read endpoints resolve the project's default branch when no `branch` param is given.
- R4. The web UI passes a browser UAT sweep — projects list (shows seeded public project), editor tree, class detail, auto-save, suggestion UI, model picker, duplicate warnings — with zero console errors on happy paths.
- R5. Role gating (admin / editor / suggester / anonymous) is verified live with Zitadel-backed logins on DEV.
- R6. All work built outside the harness on 2026-08-08 (fix rounds 1–3, DEV infra standup) passes a retrospective alignment review against: Damien's initial requirements, the brainstorm consolidation, this plan, and best practices.

**Demo & editor UX**

- R7. Two private point-in-time dummy repos exist under `alea-institute`, seeded with real snapshots: FOLIO.owl and the Catholic Semantic Canon.
- R8. Demo mode routes the user into a cloned demo project pointed at a dummy repo; demo state is visibly indicated; a demo session can never write to a live project or a live repo. Dummy repos stay current via a scheduled re-clone from live.
- R9. Auto-save remains default-ON with a user preference to surface a manual Save button, a first-save teaching toast, and the retained amber unsaved-dirty indicator (the T-May transcript decisions).

**Pipeline & infrastructure**

- R10. Both repos have test CI on the fork (API: pytest + mypy + ruff with a real pgvector service; web: type-check + tests + lint) gating PRs.
- R11. Pushes to the designated deploy branch auto-deploy to FOLIO DEV.
- R12. A gated DEV→PROD auto-promotion workflow exists (green checks + DEV smoke), dormant until FOLIO PROD exists on the AWS box.
- R13. The DEV environment is infrastructure-as-code: compose file, proxy route, env contract, and runbook committed (not hand-rolled server state).

**Upstream delivery**

- R14. A molecule map partitions the fork's undelivered commits into CatholicOS issue+PR tranches under the two-regimes ruling, ordered by dependency and reviewability.
- R15. Tranche 1's issues and PR descriptions are drafted; nothing sends to `catholicos` without Damien's per-tranche go.

**Externally gated**

- R16. FOLIO PROD rebuilt on the ALEA AWS box with the full stack — *blocked on Mike's AWS access.*
- R17. PR Party's live end-to-end gate (that feature plan's final unit) — *blocked on Fr. John's four org gates; outreach deferred until the DEV demo is ready per Damien's ruling.*
- R18. ontokit.org picker site live on the Hetzner box — *blocked on Damien registering the domain.*

### Key Decisions

- KD1. Commit identity: bot pushes with contributor attribution (session-settled: user-directed — chosen over pure-bot and per-user GitHub accounts: preserves Fr. John's authorship/recognition requirement without GitHub-account friction). Ratifies `commit_identity.py` + `mirror_credential.py` as built. Governs R1, R8.
- KD2. Change bundling: two regimes — developer features one-issue-one-PR; user suggestion sessions clustered per session/topic (session-settled: user-directed — chosen over molecules-everywhere: Fr. John explicitly asked for small PRs). Governs R14, R15.
- KD3. Demo mode ships this round as a cloned demo project (entry/exit navigation), seeded by the two dummy repos (session-settled: user-directed — chosen over dummy-repo-only: Damien wants demoable UI now). Governs R7, R8.
- KD4. Topology: FOLIO DEV live on the CPX41 behind the `*.dev.openlegalstandard.org` wildcard now; FOLIO DEV+PROD consolidate onto the ALEA-funded AWS box when Mike grants access; the Damien-funded Hetzner box carries Catholic DEV + the picker (session-settled: user-directed — chosen over Hetzner-PROD cutover: ALEA pays for AWS, Damien pays for Hetzner). Governs R11, R12, R16, R18.
- KD5. Harness: CE-forward — this plan + ce-work; no new GSD (session-settled: user-directed — chosen over native-GSD resumption: v0.4.0 milestone closed, practice already CE). Governs the execution profile.
- KD6. DEV→PROD promotion is automatic on green checks, never manual-gated (session-settled: user-directed — chosen over a human promote button). Governs R12.
- KD7. Fr. John outreach for the PR Party gates waits for a working DEV demo (session-settled: user-directed — chosen over immediate outreach: the ask lands better with a demo behind it). Governs R17.

### Scope Boundaries

**Deferred to follow-up work:** the hosted multi-tenant OntoKit + cross-project references direction (context only, not this round); rebasing the roundup/doc branches onto current `dev`; hosting/federation heartbeat beyond the picker; Catholic DEV standup on the Hetzner box; the P2/P3 residuals from the PR Party review (`docs/residual-review-findings/2026-07-28-pr-party-code-review.md`); alea-institute fork PR queue triage (10+10 open self-review PRs).

**Outside this plan's identity:** Catholic Semantic Canon content work (registries, IDs, Vulgate ingestion — Fr. John's ledger); FOLIO ontology content; the Q1-2026 upstream PRs already open on `catholicos` (#57/#27 et al. ride the existing review flow).

### Outstanding Questions

- Deferred (non-blocking): which AWS instance size/pricing model for the PROD rebuild — decided with Mike when R16 unblocks. Whether `catholic-dev` rides a `damienriehl.com` subdomain or waits for `dev.ontokit.org` — decided when Catholic DEV work starts.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Persona UAT uses Zitadel inside the DEV compose stack (the api repo's existing zitadel + login-v2 profile) with throwaway test users — not the foundation VPS's live Zitadel. Keeps DEV self-contained and John's infra untouched; trade-off is one-time OIDC setup on DEV (scripted by `scripts/setup-zitadel.sh`).
- KTD2. DEV runs two auth configurations. Terminal state is **auth-enabled** (Zitadel): `AUTH_MODE=disabled` is used only for the initial functional UAT loop and MUST sit behind a network-level gate (traefik basic-auth on the hetzner-dev route) for its entire window — an auth-disabled OntoKit on a public URL is a full-access principal against a live GitHub write path (found live in review; gate applied 2026-08-08). The auth-enabled sweep is the DoD-bearing one. Standing up Zitadel is NOT a mere env flip — see KTD9.
- KTD9. Zitadel on DEV is real infra, not a profile toggle: the api repo's `zitadel`/`login` services are unconditional and hardcoded to `localhost` (`ZITADEL_EXTERNALDOMAIN: localhost`, `EXTERNALSECURE: false`, LoginV2 URIs at `localhost:8081`), and `setup-zitadel.sh` defaults to localhost + a sibling-checkout `.env` path. U7 adds the services to the **running server-side DEV compose** (which exists on the box today; U12 later captures the whole compose into repo IaC — U7 does not create `compose.dev.yaml`), overrides external domain/port/secure and the four LoginV2/OIDC base URIs to the DEV hostname over TLS, routes the login UI, parameterizes the setup script, hardens the imported dev defaults (generated masterkey + admin password, shortened PAT expiries, suppressed secret echo), and sets the web `ZITADEL_*`/`NEXTAUTH_*` from the server-side `.env`.
- KTD3. Demo mode is a **cloned demo project** (session-settled: user-directed — chosen over same-project target-switch and snapshot-and-reset: strongest, DB-level isolation — the live project is never touched by a demo session). Entering demo mode routes the user to a demo project whose `GitHubIntegration` points at the dummy repo; demo edits live in the demo project's own rows and branches, so nothing a demo session authors can ever reach the live project or its repo. Flip-back is just navigation — there is no in-flight-content merge risk to resolve. Defense-in-depth still applies at the credential layer: a separate `GITHUB_DEMO_MIRROR_TOKEN` (fine-grained PAT scoped to the two demo repos only) backs demo pushes, and the push seam is deny-by-default against any target not on `DEMO_REPO_ALLOWLIST`, so even a mis-wired demo project cannot push to a live repo. Governs R8 mechanics under KD3.
- KTD3-a. The dummy repos are **kept fresh by a cron** (session-settled: user-directed): a scheduled job (default daily) refreshes each dummy repo from live. Precise semantics (so the refresh cannot corrupt a demo session): the job refreshes **only the default branch** of the dummy repo (force-updates it to match live); **demo-authored branches are never touched**, so a demo session's work survives a refresh. Reading live and writing dummy use **separate credentials** — a source `contents:read`-only credential for live (the CatholicOS Semantic Canon source may be private; the source identity provably cannot push) and the destination-only `GITHUB_DEMO_MIRROR_TOKEN` for the dummy repo; the two are never the same token. The refresh and the demo-project resync run under one serialized step so a demo project never reads a half-updated dummy repo.
- KTD3-b. Demo isolation is enforced by **one project-aware target-authorizer** — a single function every outbound GitHub mutation calls before it writes (`resolve_mirror_credential`, `PullRequestService._get_github_token`, `pr_party_github`, `github_sync`, `bare_repository.push`). This seam does not exist yet; U9 creates it. It resolves (credential, allowed-targets) from the project's demo/live status and denies any target off the project's allowlist. The enumeration must include the non-obvious seams — **webhook registration (which decrypts its own PAT, not via `_get_github_token`) and the PR-Party client factory** — not just the PR-create sites. Because "all writes are covered" is only as good as the enumeration, U9 carries BOTH a per-site routing test AND a guard (grep/lint over the api tree) asserting no outbound GitHub call constructs a client or token outside the authorizer.
- KTD4. CI and DEV auto-deploy land now on GitHub Actions in the fork repos; the PROD-promotion workflow is written but wired to a disabled environment until R16 lands. Chosen over waiting-for-PROD: DEV automation pays for itself immediately and the promotion gate gets exercised against DEV first.
- KTD5. Upstream molecule map is derived from the actual commit graph and feature plans (trust-ladder plan, PR Party plan, v0.4.0 phases), not from raw `git log` slicing — tranche boundaries follow feature seams so each CatholicOS PR reviews as one coherent capability (KD2's dev-regime).
- KTD6. The retrospective alignment review (R6/U6) runs as an independent-context review pass (fresh reviewers per lens: requirements-trace, brainstorm-trace, plan-trace, best-practices) with orchestrator adversarial verification — same standard as the LLM-subsystem review that caught the fix rounds' defects.
- KTD7. The ontokit.org picker is a static single-page site served by the existing Coolify traefik on the Hetzner box. No app runtime; instance links only. Parked until the domain exists (R18).
- KTD10. Two-repo release boundary: web and API auto-deploy independently, so a push landing one repo's schema/contract change before the other's produces a skewed DEV. The mechanism is a **release manifest** — a committed file recording the matched (web-SHA, api-SHA) pair; the deploy workflow deploys exactly that pair and rollback restores exactly that pair, so there is never a per-repo half-deploy. A push updates the manifest, not the live env directly. Cross-model reviewers flagged the unmatched boundary.
- KTD11. Branch/rebase currency: this plan builds all units on `feat/pr-party` and does NOT rebase it against `catholicos/dev` during the execution window — U14/KTD5's commit-graph-derived tranche map assumes stable hashes through Phase D. Two currency deltas are handled at the unit that touches them, not by a global rebase: U10 diffs `editorModeStore.ts` against `catholicos/dev` and drops the upstream-removed `continuousEditing` before editing; U14 records per-file currency deltas in the tranche map. The origin's rebase-vs-merge question is answered "no rebase this round" here.
- KTD8. F3's fix direction: mint validation must validate against resolvable knowledge (project graph + declared imports + well-formed external IRIs), and the 422 must carry the `errors` list verbatim. If diagnosis shows the UAT entity genuinely violated a defensible rule, the rule stays and the error surfacing alone closes F3 — the swallowed detail is the confirmed defect either way.

### Assumptions

- The five agent decisions (KTD1 Zitadel-in-stack, KTD3 cloned-demo-project, KTD4 CI-now/promotion-later, KTD7 picker-as-static-site, R15 gated-sends) went through an adversarial cross-model doc review (5 in-process + 3 independent Codex reviewers). Outcomes folded in: KTD1 corrected (Zitadel is real infra, not a profile flip — now KTD9); KTD3 hardened (guard moved to the shared credential seam, deny-by-default allowlist, schema migration, demo-scoped token); the others held. The one genuine fork (demo-content behavior) was resolved by Damien 2026-08-08: cloned demo project + cron-refreshed dummy repos (now KTD3 / KTD3-a).
- hetzner-dev's traefik continues to front `*.dev.openlegalstandard.org`; its ~3.3GB free RAM is never asked to host the OntoKit stack itself. CPX41 headroom for the added Zitadel services + CI redeploy loop is unmeasured — watch it in U7/U12.
- The FOLIO DEV seed project (18,566 entities) is representative enough for UAT; no additional ontologies needed for this round.
- U8 copies Catholic Semantic Canon content from a CatholicOS source into an alea-institute repo. The perimeter gates cover sends *to* `catholicos`, not extraction *from* it — flagged for Damien's awareness; snapshot is public-domain-derived ontology structure, not privileged content.

### High-Level Technical Design

```mermaid
flowchart LR
  subgraph now [Now]
    dev[FOLIO DEV\nCPX41 ontokit-dev\ncompose: pg17+redis+minio+api+worker+web]
    hz[hetzner-dev\nCoolify traefik\n*.dev wildcard + TLS]
    hz -->|"proxy :3000/:8000"| dev
  end
  subgraph gated [Externally gated]
    aws[FOLIO PROD+DEV\nALEA AWS box\nblocked: Mike]
    picker[ontokit.org picker\nHetzner static\nblocked: domain]
  end
  ci[GitHub Actions fork CI\ntests -> DEV auto-deploy] --> dev
  ci -.->|"promotion gate (dormant, KTD4)"| aws
  demo[Dummy repos x2\nalea-institute private] ---|"cloned demo project"| dev
  upstream[Molecule map\ntranche drafts] -.->|"per-tranche go (R15)"| catholicos[(CatholicOS org)]
```

Sequencing: Phase A (verify & harden) → Phase B (demo & UX) and Phase C (pipeline) in parallel → Phase D (upstream) once A's retrospective review is clean → Phase E parked units activate on their gates.

---

## Implementation Units

| U-ID | Phase | Title | Repo/target | Depends on |
|---|---|---|---|---|
| U1 | A | F3: mint validation + 422 detail | ontokit-api | — |
| U2 | A | F1: default-branch resolution | ontokit-api | — |
| U3 | A | F4: projects list empty on web | ontokit-web | — |
| U4 | A | Browser UAT sweep + fix loop | both + DEV | U1–U3 |
| U5 | A | Suggestion lifecycle live UAT (dup-block, external parent, approve→trust) | ontokit-api + DEV | U1 |
| U6 | A | Retrospective alignment review | both + infra | U1–U3 |
| U7 | A | Zitadel persona pass on DEV (terminal auth-on sweep) | infra + both | U4 |
| U8 | B | Dummy repos: create, seed, refresh cron | infra (gh) | — |
| U9 | B | Demo mode: cloned demo project + target-authorizer | both | U8 |
| U10 | B | Auto-save preference | ontokit-web | — |
| U11 | C | Test CI, both repos | both (gh actions) | — |
| U12 | C | DEV auto-deploy + infra-as-code (owns compose.dev.yaml + cron IaC home) | infra + both | U7, U8, U11 |
| U13 | C | PROD promotion gate (dormant) | infra | U12 |
| U14 | D | Upstream molecule map + tranche-1 drafts | docs + gh | U6, U7, U9, U10 |
| U15 | E | AWS PROD rebuild — BLOCKED (Mike) | infra | U12, gate |
| U16 | E | PR Party live E2E — BLOCKED (Fr. John, after demo) | both | U4, U9, gate |
| U17 | E | ontokit.org picker — BLOCKED (domain) | infra | gate |
| U18 | D | Closeout: gate-status ask, Cockpit, ce-compound learning, cleanup tracking | docs + cockpit | U5, U13, U14 |

**Prerequisites (Damien-performed, before their units start):** U12 needs a dedicated deploy keypair — public half in `ontokit-dev`'s `authorized_keys` (forced-command), private half + known-hosts as GitHub Environment secrets on both forks (credential material is out of scope for Codex workers). U7 needs the DEV auth-gate credential rotated into the runbook. U8 needs Damien to create + store two credentials: a fine-grained destination PAT scoped to exactly the two demo repos (`GITHUB_DEMO_MIRROR_TOKEN`), and a `contents:read`-only source credential for the live repos the cron clones from (must NOT be able to push) — PAT issuance is account-owner-only, out of scope for Codex workers.

### U1. F3 — right-size mint validation and surface 422 detail

**Goal:** A legitimate mint (FOLIO-style parent, well-formed IRI, sane label) submits successfully; an invalid one returns the specific `ValidationService` errors in the 422 body.
**Requirements:** R1, R2 (KTD8).
**Files:** `ontokit-api`: `ontokit/services/suggestion_service.py` (the `_validate_submission_content` gate), `ontokit/services/validation_service.py`, error schema; `tests/integration/test_llm_review_regressions.py` (extend).
**Approach:** Diagnose which `validate_entity` rule rejected the UAT mint against the live FOLIO project; per KTD8, right-size rules that assume project-minted IRI shapes, and thread the `errors` list into the HTTPException detail.
**Execution note:** Red first — reproduce the live 422 as an integration test against the seeded-FOLIO shape before changing either the rule or the surfacing.
**Test scenarios:** valid FOLIO-parent mint submits (was 422); mint with malformed parent still 422s and the body names the rule; **a mint whose parent is a `rdfs:subClassOf [ a owl:Restriction ... ]` blank-node parent submits successfully** (the F2 regression class — restriction parents are legitimate); mint duplicating an existing label 409s with the dup verdict (regression guard); error payload shape is consumable by the web client's `generationErrorMessage`-style mapping.
**Verification:** UAT-1 re-run on DEV succeeds end-to-end; new tests red-then-green; full API gates green.

### U2. F1 — default-branch resolution on read endpoints

**Goal:** `GET /ontology/tree` (and sibling reads) without `branch` resolves the project default branch instead of returning empty.
**Requirements:** R3.
**Files:** `ontokit-api`: the ontology read routes/service; matching tests.
**Test scenarios:** tree without param equals tree with `?branch=main` on the seeded project; project with non-`main` default resolves its own default.
**Verification:** live DEV curl parity; gates green.

### U3. F4 — projects list renders the seeded public project

**Goal:** The public projects list shows FOLIO DEV (API already returns it; UI shows empty). Logged as F4 in `docs/roundup-2026-08/DEV-UAT-LOG.md`.
**Requirements:** R4.
**Files:** `ontokit-web`: `app/page.tsx` (the root projects list + its `useInfiniteQuery`), `components/projects/project-card.tsx`, `lib/api/projects.ts`; tests. (Not `app/projects/page.tsx` — that is a `redirect("/")` stub.)
**Approach:** Diagnose first — the `items`-envelope candidate is refuted (`app/page.tsx` already flattens `page.items`); live candidates are a session-gated query disabled under `AUTH_MODE=disabled` (its queryKey carries `isAuthenticated`), or an SSR fetch using an in-container URL that can't reach the proxy. Fix at the true seam.
**Test scenarios:** anonymous visitor sees public projects; auth-disabled mode never gates the public list; empty-state renders only on genuinely empty responses.
**Verification:** browser check on DEV shows the project card; zero related console errors.

### U4. Browser UAT sweep with fix loop

**Goal:** R4's full sweep passes on DEV with evidence (screenshots + UAT log entries); every finding triaged, dispatched, fixed, and re-verified.
**Requirements:** R1, R4.
**Files:** `docs/roundup-2026-08/DEV-UAT-LOG.md` (evidence); fixes land wherever findings point.
**Approach:** chrome-devtools MCP sweep: projects → editor (tree expand, class detail) → edit + auto-save → suggestion create/save/submit → model picker (registry provider, local provider, custom) → duplicate warning display → graph view. Console must be clean on happy paths. Findings follow the packet → Codex worker → orchestrator-verify loop.
**Test scenarios:** each swept flow lands in the log as pass, or as a finding with severity + repro; the model-picker sweep covers the D1/D2/D3 states (registry loading, registry failure, custom provider).
**Verification:** log shows a full-sweep pass dated after the last fix; screenshots reviewed then deleted.

### U5. Suggestion lifecycle live completion

**Goal:** UAT-2 (true duplicate blocks), UAT-3 (external parent accepted), UAT-4 (approve → real merge → trust credited; reject → no credit) pass live on DEV.
**Requirements:** R1 (KD1's identity mechanics observed in the merge commit).
**Files:** evidence in the UAT log; fixes as found.
**Test scenarios:** minting an exact existing label 409s; external-IRI parent submits; **a save accumulates on the contributor's own branch (not the default branch); submit opens a PR (assert the PR/branch, not just the merge)**; approve merges to the default branch and the commit shows contributor attribution with bot committer; trust outcome rows match the merge result; reject leaves trust unchanged.
**Verification:** git log on the DEV project's repo shows the attributed merge; trust state via API matches.

### U6. Retrospective alignment review

**Goal:** R6's five-lens review of everything built outside the harness on 2026-08-08 — fix rounds 1–3 (both repos), the DEV infra, and the deploy configuration — with verified findings dispatched as fixes.
**Requirements:** R6 (KTD6).
**Files:** report to `docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md` (web repo, roundup branch).
**Approach:** independent reviewers per lens: (1) initial-requirements trace (Damien's four outline docs), (2) brainstorm-consolidation trace (MASTER-OUTLINE rulings), (3) this plan's contracts, (4) best practices (incl. the two `docs/solutions/` learnings), (5) **security posture of the DEV standup + deploy config** — public-surface exposure per auth mode, secret storage/rotation on the box, GitHub write-path credential scope. **Anti-ratification instruction:** where a Key Decision ratifies already-built work (KD1) or absorbs an origin deviation (KD4), the reviewer evaluates the artifact against the requirement's *intent* and records independent evidence for the ratification — the plan's endorsement is not evidence — and flags any built artifact for which no requirement was ever written (the DEV infra standup) as a finding in its own right. Orchestrator adversarially verifies P0/P1 findings before dispatching fixes.
**Test scenarios:** n/a (review unit). Test expectation: none — review deliverable; its findings carry their own red-then-green obligations.
**Verification:** report committed; all confirmed P0/P1 findings fixed and re-verified or explicitly accepted by Damien.

### U7. Zitadel persona pass

**Goal:** R5 verified: four personas exercise the core flows with real logins; role gates hold.
**Requirements:** R5 (KTD1, KTD2, KTD9).
**Files:** the real Zitadel-on-DEV work list per KTD9 — add `zitadel`+`login` to the **running server-side DEV compose** (U7 edits the live compose on the box; U12 later captures it into `deploy/compose.dev.yaml` — U7 does NOT create that file), override external domain/port/secure + the four LoginV2/OIDC base URIs to the DEV host over TLS, a traefik route for the login UI (its own subdomain or path prefix — decide before `setup-zitadel.sh` runs), parameterized `scripts/setup-zitadel.sh`, hardened dev defaults, web `ZITADEL_*`/`NEXTAUTH_*`; runbook section (feeds R13); evidence in UAT log.
**Test scenarios:** anonymous can browse + suggest (per AUTH_MODE contract) but not edit; suggester can suggest, not merge; editor edits but cannot admin; admin reviews/merges; role escalation attempts fail. **Terminal auth-on sweep:** re-run R4's happy-path browser sweep under the Zitadel profile — the DoD full-sweep evidence is collected auth-enabled, not auth-disabled.
**Verification:** per-persona log entries with screenshots; R4 sweep green under auth-on; DEV left in the auth-enabled terminal state (SUPERADMIN/anonymous dev grants removed).

### U8. Dummy repos — create, seed, and schedule the refresh cron

**Goal:** R7's two private repos exist, hold a real clone of live content, and stay fresh via a scheduled re-clone (KTD3-a).
**Requirements:** R7 (KD3, KTD3-a).
**Files:** `alea-institute/ontokit-demo-folio` (clone of FOLIO.owl), `alea-institute/ontokit-demo-semantic-canon` (clone of the CatholicOS Semantic Canon source); a README in each declaring demo status + last-refresh; the refresh job — **U8 owns the job logic + schedule and runs it as a server cron now; U12 later captures that cron into IaC (no cycle: U8 delivers the runnable job, U12 only formalizes its home)**. The job (default daily, configurable) refreshes each dummy repo's default branch from live AND runs the paired demo-project resync in the same serialized step, so a demo session never sees a half-updated repo and demo-authored branches survive.
**Approach:** `gh repo create` private; seed by cloning live content. Create a **fine-grained `GITHUB_DEMO_MIRROR_TOKEN`** scoped to exactly these two repos (per KTD3) — the live `GITHUB_MIRROR_TOKEN` is NOT granted access. The refresh job reads live (clone/pull, read-only) and writes only the dummy repos.
**Test scenarios:** repos private; content loads in OntoKit import (spot-check one); the demo token can push to both demo repos and nothing else; the live mirror token cannot push to either demo repo; the refresh job updates a dummy repo after a simulated live change and never writes toward live.
**Verification:** both repos exist with cloned content; a manual refresh-job run succeeds and is read-only against live; token scoping proven by the push tests (fine-grained, not broad `repo`).

### U9. Demo mode — cloned demo project + entry/exit navigation + credential guard

**Goal:** R8 shipped per KTD3: entering demo mode routes to a cloned demo project pointed at the dummy repo, a visible demo banner, and a credential-layer guarantee that no demo session can write to a live repo. No in-flight-content merge path (isolation is by separate project, not target-switch).
**Requirements:** R8 (KD3, KTD3, KTD3-a, KTD3-b; KD1 identity still applies in demo pushes).
**Files:** `ontokit-api`: (1) an alembic migration adding an `is_demo` marker to `projects` (and a link from a demo project to its dummy repo); (2) **idempotent deploy-time provisioning** that creates exactly one demo `Project` per dummy repo (two demo projects — FOLIO, Semantic Canon), each with its own `GitHubIntegration` pointing at that dummy repo, re-runnable without duplicating; (3) the **single project-aware target-authorizer** from KTD3-b, wired into every enumerated outbound-mutation call site (`resolve_mirror_credential`, `pull_request_service._get_github_token` + its 7+ `create_pull_request` sites, `pr_party_github`, `github_sync`, `bare_repository.push`) so a demo project resolves the demo token + demo allowlist and a live project cannot reach a demo repo. `ontokit-web`: demo entry/exit navigation (routes to the demo project) + persistent demo banner. Tests both sides.
**Test scenarios:** a demo project pushes only to its dummy repo; **three refusal tests** — a live PR-create, a PR-Party REST write, and a mirror push are each refused server-side when the project is demo and the target is off-allowlist; the live mirror token is never selected for a demo project; the demo banner reflects server truth after reload; a demo project's edits never appear in any live project or repo (the isolation assertion).
**Execution note:** The single target-authorizer is the unit's heart — one seam every write calls; carry an exhaustive test that each enumerated call site routes through it (the guarantee is only as strong as the enumeration). Provisioning must be idempotent (re-running the deploy does not create duplicate demo projects).
**Verification:** live DEV demo flow writes only to `ontokit-demo-folio`; UAT log evidence.

### U10. Auto-save preference

**Goal:** R9 shipped: default auto-save ON; settings preference surfaces a manual Save button; first-save toast teaches the behavior.
**Requirements:** R9.
**Files:** `ontokit-web`: `lib/stores/editorModeStore.ts`, `app/settings/page.tsx` (alongside the existing Hide-Save-Button control — reconcile the two so they don't contradict), editor save affordance components; tests.
**Execution note:** Before editing `editorModeStore.ts`, diff it against `catholicos/dev` and drop the upstream-removed `continuousEditing` field (per KTD11) so the preference is built on the upstream-current shape — otherwise U14's tranche re-proposes a feature Fr. John already removed.
**Test scenarios:** default state auto-saves on navigate-away with toast on first occurrence; preference ON shows Save button that saves immediately; preference persists; the legacy hide-save-button setting and this preference cannot express a contradictory combination.
**Verification:** browser check of both modes on DEV.

### U11. Test CI — both repos

**Goal:** R10: every fork PR runs the real gate suites.
**Requirements:** R10.
**Files:** `ontokit-api`: `.github/workflows/test.yml` (pytest with `pgvector/pgvector:pg17` + redis services, mypy, ruff) + a secret-scan step over the `deploy/` tree; `ontokit-web`: `.github/workflows/test.yml` (type-check, vitest, lint). Every new workflow declares an explicit least-privilege `permissions:` block (mirror the existing `pr-target-guard.yml` convention).
**Test scenarios:** Test expectation: none — CI config; proof is a green run on a real PR and a red run on an intentionally broken draft PR (then closed).
**Verification:** both workflows green on the current branches; the intentional-failure check demonstrated; **both workflows registered as required status checks in branch protection** on the deploy branch, so they actually gate merges (a workflow that exists but is not required is not a gate).

### U12. DEV auto-deploy + infrastructure-as-code

**Goal:** R11 + R13: push to the deploy branch → DEV updates itself; the entire DEV environment reproducible from committed files.
**Requirements:** R11, R13 (KD4, KTD4).
**Files:** deploy workflow (SSH deploy to the current DEV host — CPX41 now, AWS later, host as a repo variable; **deploys the matched (web-SHA, api-SHA) pair from the KTD10 release manifest, atomically; rollback restores the prior pair**); `deploy/` directory in `ontokit-api` (or a shared infra home): compose.dev.yaml (incl. the traefik basic-auth gate from KTD2 and the Zitadel services from KTD9), traefik route template, env contract (`.env.example` — **placeholders only, every secret stays in the server `.env`/GitHub Environment**), RUNBOOK.md covering deploy/rollback/logs/auth-mode flip/gate-credential rotation.
**Approach:** Promote the hand-rolled server state into the repo, **scrubbing all secrets to placeholders before the first commit** (git history is permanent); server switches to pulling the committed compose. Also delete `ontokit-api/railway.json` and (per Damien's per-send gate) close upstream issue #100, citing the KD4 topology ruling.
**Prerequisites:** the deploy keypair setup named in the Implementation Units prerequisites block.
**Test scenarios:** Test expectation: none — infra; proof is a no-op redeploy from CI producing a healthy stack, a from-scratch dry-run of the runbook's bootstrap section against a throwaway directory, and a secret-scan step (in U11 CI) passing on the `deploy/` tree.
**Verification:** a real push deploys DEV with health checks green; drift check runs on **non-secret files only** (no `.env` content in workflow logs); no secret material in the committed tree; a secret-scan runs over full git history (placeholders-first means secrets never enter even one commit — the scan proves it).

### U13. PROD promotion gate (dormant)

**Goal:** R12's workflow exists and is exercised against DEV as its rehearsal target, wired to a disabled `production` environment until R16.
**Requirements:** R12 (KD6, KTD4).
**Files:** promotion workflow: trigger on green DEV deploy → smoke suite against DEV URL → promote step (gated on `vars.PROD_ENABLED`, off until R16). **Smoke suite covers one full write path end-to-end** on a dedicated throwaway smoke project (NOT the seeded FOLIO project — the smoke must not mutate the demo/UAT seed): mint a class, save, submit, assert non-422, then discard in addition to health, projects API, one UI route — because health/projects/UI-route all stayed green through F2 (every submit 422'd) and F3 today, so a write-path check is the one that would have caught them. Promotion binds the exact green revision (immutable), not "latest".
**Activation checklist (for R16 day):** the authority chain must be in place before `PROD_ENABLED` flips — branch protection with required reviews on the deploy branch, PROD secrets in a GitHub Environment restricted to the deploy branch, CODEOWNERS review required on `.github/workflows/**` (so a PR cannot rewrite the checks that gate its own deploy). This gives "green checks" a protected pipeline to derive authority from; it does not add a manual promote button (KD6 preserved).
**Test scenarios:** Test expectation: none — infra; proof is the write-path smoke suite passing against live DEV and the promote step visibly skipped-by-gate.
**Verification:** workflow run log shows gate semantics; activation checklist documented in the runbook for R16 day.

### U14. Upstream molecule map + tranche-1 drafts

**Goal:** R14 + R15: the fork's undelivered work partitioned into reviewable tranches; tranche 1 drafted end-to-end, sends awaiting Damien.
**Requirements:** R14, R15 (KD2, KTD5).
**Files:** `docs/roundup-2026-08/UPSTREAM-DELIVERY-MAP.md`: tranche table (feature seam → commit ranges → target repo → issue draft → PR scope → dependency order → review-size estimate); tranche-1 issue bodies + PR descriptions as files.
**Approach:** Derive seams from the feature plans (trust-ladder, PR Party, v0.4.0 phases) per KTD5; respect the existing open upstream PRs (#57/#27) as already-in-flight prefixes, not re-sends. **Commit cutoff:** the map is built against a recorded HEAD after U7/U9/U10 land (this unit depends on them) so no later code-producing unit adds commits the map misses.
**Test scenarios:** Test expectation: none — docs deliverable; tranche 1's dependency order is validated by cherry-picking onto upstream `dev` in a scratch worktree. Tranches beyond 1 are marked **provisional** in the map (order asserted, not yet cherry-pick-verified) — R14's whole-map claim is satisfied by the provisional labeling, not by claiming every tranche was tested.
**Verification:** Damien can read the map and approve tranche 1 in one sitting; nothing was sent; later tranches carry the provisional marker.

### U18. Closeout — gate-status ask, Cockpit, and the compounding learning

**Goal:** The DoD's cross-cutting deliverables have an owner: the `briefs/qa` ask that surfaces the three external gates (R16–R18) and their status, the Cockpit on-deck/asks refresh, and a `ce-compound` learning capturing the GSD-code-verification lesson (unit tests that mock every seam prove nothing — the live-Postgres integration harness and the F2/F3 blockers found only in real-data UAT are the evidence).
**Requirements:** DoD items (Cockpit visibility, closeout).
**Files:** `briefs/qa/ontokit-web-<date>-external-gates.json`; `briefs/on-deck.json` update; a learning under `docs/solutions/`.
**Test scenarios:** Test expectation: none — docs/cockpit deliverable; proof is the ask rendering on the board with the three gates and the learning committed.
**Verification:** board shows the gate-status ask; `docs/solutions/` learning exists and links the review + fix-round dispositions.

### U15. AWS PROD rebuild — BLOCKED on Mike's access

**Goal:** R16 when unblocked: full stack on the ALEA AWS box per the June plan's shape, DEV+PROD co-resident per KD4, promotion gate activated. **Includes the demo-gibberish cleanup** — purge the demo data written toward the live store during earlier demos (the origin's `[O2 §3.1]` item; the full-stack rebuild is the only unit that touches the polluted live store). Decide reseed-from-scratch vs migrate-and-purge as part of activation. **Cleanup carries its own tracked state independent of R16:** if the pipeline lands but AWS PROD stays parked, U18 surfaces the outstanding demo-gibberish cleanup as its own gate-status line so the plan cannot close with it silently unaddressed.
**Requirements:** R16, R8-adjacent cleanup (KD4, KD6). **Unblock condition:** working scoped AWS credentials for the ontokit account — OR Mike executing the runbook bootstrap himself (instance upsize from 8GB, Docker install, security-group rules, DNS) — plus an instance size agreed with Mike. (SG/DNS alone is insufficient: the box also needs Docker and an upsize.)
**Approach (pre-work allowed now):** none beyond U12/U13 artifacts, which are its inputs. Everything else waits.
**Test scenarios:** deferred to activation.
**Verification:** deferred to activation.

### U16. PR Party live E2E — BLOCKED on Fr. John (after demo)

**Goal:** The PR Party feature plan's final live gate, using the working DEV demo as the outreach vehicle per KD7.
**Requirements:** R17 (KD7). **Unblock condition:** Damien approves the answerer-workflow send AND the outreach draft; Fr. John accepts the PAT, creates the org webhook, merges the answerer workflow, and issues the shared generation token.
**Approach (pre-work in this plan):** prepare and hold two drafts once U4+U9 give the demo — (1) the outreach issue+message, and (2) the `catholicos/.github` answerer-workflow issue+PR (the `claude-pr-answers.yml` asset targeting `dev`, a third repo outside U14's fork-only map — nothing else owns drafting it). Both route through Damien's per-send gate.
**Verification:** deferred to activation.

### U17. ontokit.org picker — BLOCKED on domain registration

**Goal:** R18 when unblocked: static picker page (Catholic / FOLIO / architecture instances) served via the Hetzner traefik per KTD7.
**Requirements:** R18 (KD4). **Unblock condition:** Damien registers ontokit.org.
**Approach (pre-work allowed now):** confirm ontokit.org availability via WHOIS and record the result (no approval, spend, or external party needed). If unavailable, surface an alternative-name decision to Damien before the picker or the `catholic-dev` subdomain question (Outstanding Questions) is scheduled — both lean on the name existing.
**Verification:** deferred to activation.

---

## Verification Contract

- **API gates** (ontokit-api, live stores required): `.venv/bin/pytest -q` with `TEST_DATABASE_URL=postgresql+asyncpg://ontokit:ontokit_test@127.0.0.1:5433/ontokit_test` and `TEST_REDIS_URL=redis://127.0.0.1:6380/0`; `.venv/bin/mypy ontokit`; `.venv/bin/ruff check ontokit tests`. All green, no new suppressions.
- **Web gates** (ontokit-web, in the `feat/pr-party` worktree): `npm run type-check`; `npm run test`; `npm run lint` (0 errors; the 19 legacy warnings are the accepted floor — no additions).
- **Live DEV smoke** (after any deploy): `https://ontokit.dev.openlegalstandard.org/health` healthy; `/api/v1/projects` returns the seeded project; UI happy path via chrome-devtools with clean console.
- **Fix-unit proof style:** red-then-green — the defect reproduced as a failing test against the live seam before the fix commit, per the Goal Capsule execution profile.
- **Review units (U6):** findings count only after adversarial verification; the report names refuted findings.
- **Orchestrator re-runs every gate itself** before accepting a worker's green claim.

---

## Definition of Done

- R1–R15 verified per the Verification Contract; R16–R18 either done (gate lifted) or parked with their unblock conditions current and visible in the Cockpit (a dedicated `briefs/qa` ask surfaces the three external gates and their status).
- The UAT log shows a dated full-sweep pass **collected under auth-enabled DEV** (KTD2); zero open P0/P1 findings across UAT and the retrospective review.
- The DEV auth-disabled window was network-gated for its full duration and DEV ends in the auth-enabled terminal state.
- All committed work is pushed to the ALEA fork; nothing was sent to `catholicos` without a recorded per-tranche approval.
- Infra-as-code matches the running DEV server (drift check green); hand-rolled state retired.
- Abandoned experiment code from any fix loop is removed, not left in the diffs.
- `docs/roundup-2026-08/` documents (UAT log, delivery map) current; Cockpit on-deck and asks updated; a `ce-compound` learning captured for the GSD-code-verification lesson (tests that mock every seam prove nothing).
