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
- R8. An in-app demo/live toggle switches the project's GitHub write target between live integration and the dummy repos; demo state is visibly indicated; demo mode can never write to a live repo.
- R9. Auto-save remains default-ON with a user preference to surface a manual Save button, and a first-save teaching toast (the T-May transcript decision).

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
- KD3. Demo mode ships this round with the in-app toggle, seeded by the two dummy repos (session-settled: user-directed — chosen over dummy-repo-only: Damien wants demoable UI now). Governs R7, R8.
- KD4. Topology: FOLIO DEV live on the CPX41 behind the `*.dev.openlegalstandard.org` wildcard now; FOLIO DEV+PROD consolidate onto the ALEA-funded AWS box when Mike grants access; the Damien-funded Hetzner box carries Catholic DEV + the picker (session-settled: user-directed — chosen over Hetzner-PROD cutover: ALEA pays for AWS, Damien pays for Hetzner). Governs R11, R12, R16, R18.
- KD5. Harness: CE-forward — this plan + ce-work; no new GSD (session-settled: user-directed — chosen over native-GSD resumption: v0.4.0 milestone closed, practice already CE). Governs the execution profile.
- KD6. DEV→PROD promotion is automatic on green checks, never manual-gated (session-settled: user-directed — chosen over a human promote button). Governs R12.
- KD7. Fr. John outreach for the PR Party gates waits for a working DEV demo (session-settled: user-directed — chosen over immediate outreach: the ask lands better with a demo behind it). Governs R17.

### Scope Boundaries

**Deferred to follow-up work:** rebasing the roundup/doc branches onto current `dev`; hosting/federation heartbeat beyond the picker; Catholic DEV standup on the Hetzner box; the P2/P3 residuals from the PR Party review (`docs/residual-review-findings/2026-07-28-pr-party-code-review.md`); alea-institute fork PR queue triage (10+10 open self-review PRs).

**Outside this plan's identity:** Catholic Semantic Canon content work (registries, IDs, Vulgate ingestion — Fr. John's ledger); FOLIO ontology content; the Q1-2026 upstream PRs already open on `catholicos` (#57/#27 et al. ride the existing review flow).

### Outstanding Questions

- Deferred (non-blocking): which AWS instance size/pricing model for the PROD rebuild — decided with Mike when R16 unblocks. Whether `catholic-dev` rides a `damienriehl.com` subdomain or waits for `dev.ontokit.org` — decided when Catholic DEV work starts.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Persona UAT uses Zitadel inside the DEV compose stack (the api repo's existing zitadel + login-v2 profile) with throwaway test users — not the foundation VPS's live Zitadel. Keeps DEV self-contained and John's infra untouched; trade-off is one-time OIDC setup on DEV (scripted by `scripts/setup-zitadel.sh`).
- KTD2. DEV runs two auth configurations in sequence: `AUTH_MODE=disabled` for the functional UAT loop (full access, no login friction), then the Zitadel profile for the persona pass (R5). Config flip is a compose env change + restart, documented in the runbook (R13).
- KTD3. The demo/live toggle switches the project's GitHub integration target (live repo ↔ dummy repo), not a parallel database. Rationale: the DB already isolates per-project; the risk demo mode must kill is external writes. Mechanism rides the existing `GitHubIntegration` row per project + a visible mode banner. Governs R8 mechanics under KD3.
- KTD4. CI and DEV auto-deploy land now on GitHub Actions in the fork repos; the PROD-promotion workflow is written but wired to a disabled environment until R16 lands. Chosen over waiting-for-PROD: DEV automation pays for itself immediately and the promotion gate gets exercised against DEV first.
- KTD5. Upstream molecule map is derived from the actual commit graph and feature plans (trust-ladder plan, PR Party plan, v0.4.0 phases), not from raw `git log` slicing — tranche boundaries follow feature seams so each CatholicOS PR reviews as one coherent capability (KD2's dev-regime).
- KTD6. The retrospective alignment review (R6/U6) runs as an independent-context review pass (fresh reviewers per lens: requirements-trace, brainstorm-trace, plan-trace, best-practices) with orchestrator adversarial verification — same standard as the LLM-subsystem review that caught the fix rounds' defects.
- KTD7. The ontokit.org picker is a static single-page site served by the existing Coolify traefik on the Hetzner box. No app runtime; instance links only. Parked until the domain exists (R18).
- KTD8. F3's fix direction: mint validation must validate against resolvable knowledge (project graph + declared imports + well-formed external IRIs), and the 422 must carry the `errors` list verbatim. If diagnosis shows the UAT entity genuinely violated a defensible rule, the rule stays and the error surfacing alone closes F3 — the swallowed detail is the confirmed defect either way.

### Assumptions

- The five synthesis call-outs (KTD1, KTD3, KTD4 sequencing, KTD7 shape, R15's gated-sends default) were presented to Damien but not itemwise affirmed before he directed plan-write; they stand as agent decisions for the adversarial doc review to test.
- hetzner-dev's traefik continues to front `*.dev.openlegalstandard.org`; its ~3.3GB free RAM is never asked to host the OntoKit stack itself.
- The FOLIO DEV seed project (18,566 entities) is representative enough for UAT; no additional ontologies needed for this round.

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
  demo[Dummy repos x2\nalea-institute private] ---|"demo-mode write target"| dev
  upstream[Molecule map\ntranche drafts] -.->|"per-tranche go (R15)"| catholicos[(CatholicOS org)]
```

Sequencing: Phase A (verify & harden) → Phase B (demo & UX) and Phase C (pipeline) in parallel → Phase D (upstream) once A's retrospective review is clean → Phase E parked units activate on their gates.

---

## Implementation Units

| U-ID | Title | Repo/target | Depends on |
|---|---|---|---|
| U1 | F3: mint validation + 422 detail | ontokit-api | — |
| U2 | F1: default-branch resolution | ontokit-api | — |
| U3 | F4: projects list empty on web | ontokit-web | — |
| U4 | Browser UAT sweep + fix loop | both + DEV | U1–U3 |
| U5 | Suggestion lifecycle live UAT (dup-block, external parent, approve→trust) | ontokit-api + DEV | U1 |
| U6 | Retrospective alignment review | both + infra | U1–U3 |
| U7 | Zitadel persona pass on DEV | infra + both | U4 |
| U8 | Dummy repos: create + seed | infra (gh) | — |
| U9 | Demo/live toggle | both | U8 |
| U10 | Auto-save preference | ontokit-web | — |
| U11 | Test CI, both repos | both (gh actions) | — |
| U12 | DEV auto-deploy + infra-as-code | infra + both | U11 |
| U13 | PROD promotion gate (dormant) | infra | U12 |
| U14 | Upstream molecule map + tranche-1 drafts | docs + gh | U6 |
| U15 | AWS PROD rebuild — BLOCKED (Mike) | infra | U12, gate |
| U16 | PR Party live E2E — BLOCKED (Fr. John, after demo) | both | U4, U9, gate |
| U17 | ontokit.org picker — BLOCKED (domain) | infra | gate |

### U1. F3 — right-size mint validation and surface 422 detail

**Goal:** A legitimate mint (FOLIO-style parent, well-formed IRI, sane label) submits successfully; an invalid one returns the specific `ValidationService` errors in the 422 body.
**Requirements:** R1, R2 (KTD8).
**Files:** `ontokit-api`: `ontokit/services/suggestion_service.py` (the `_validate_submission_content` gate), `ontokit/services/validation_service.py`, error schema; `tests/integration/test_llm_review_regressions.py` (extend).
**Approach:** Diagnose which `validate_entity` rule rejected the UAT mint against the live FOLIO project; per KTD8, right-size rules that assume project-minted IRI shapes, and thread the `errors` list into the HTTPException detail.
**Execution note:** Red first — reproduce the live 422 as an integration test against the seeded-FOLIO shape before changing either the rule or the surfacing.
**Test scenarios:** valid FOLIO-parent mint submits (was 422); mint with malformed parent still 422s and the body names the rule; mint duplicating an existing label 409s with the dup verdict (regression guard); error payload shape is consumable by the web client's `generationErrorMessage`-style mapping.
**Verification:** UAT-1 re-run on DEV succeeds end-to-end; new tests red-then-green; full API gates green.

### U2. F1 — default-branch resolution on read endpoints

**Goal:** `GET /ontology/tree` (and sibling reads) without `branch` resolves the project default branch instead of returning empty.
**Requirements:** R3.
**Files:** `ontokit-api`: the ontology read routes/service; matching tests.
**Test scenarios:** tree without param equals tree with `?branch=main` on the seeded project; project with non-`main` default resolves its own default.
**Verification:** live DEV curl parity; gates green.

### U3. F4 — projects list renders the seeded public project

**Goal:** The public projects list shows FOLIO DEV (API already returns it; UI shows empty).
**Requirements:** R4.
**Files:** `ontokit-web`: projects page + its data hook; tests.
**Approach:** Diagnose first — candidates: SSR fetch using an in-container URL that can't reach the proxy, a session-gated query left disabled under `AUTH_MODE=disabled`, or response-shape drift (`items` envelope). Fix at the true seam.
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
**Test scenarios:** minting an exact existing label 409s; external-IRI parent submits; approve merges to the default branch and the commit shows contributor attribution with bot committer; trust outcome rows match the merge result; reject leaves trust unchanged.
**Verification:** git log on the DEV project's repo shows the attributed merge; trust state via API matches.

### U6. Retrospective alignment review

**Goal:** R6's four-lens review of everything built outside the harness on 2026-08-08 — fix rounds 1–3 (both repos), the DEV infra, and the deploy configuration — with verified findings dispatched as fixes.
**Requirements:** R6 (KTD6).
**Files:** report to `docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md` (web repo, roundup branch).
**Approach:** independent reviewers per lens: (1) initial-requirements trace (Damien's four outline docs), (2) brainstorm-consolidation trace (MASTER-OUTLINE rulings), (3) this plan's contracts, (4) best practices (incl. the two `docs/solutions/` learnings). Orchestrator adversarially verifies P0/P1 findings before dispatching fixes.
**Test scenarios:** n/a (review unit). Test expectation: none — review deliverable; its findings carry their own red-then-green obligations.
**Verification:** report committed; all confirmed P0/P1 findings fixed and re-verified or explicitly accepted by Damien.

### U7. Zitadel persona pass

**Goal:** R5 verified: four personas exercise the core flows with real logins; role gates hold.
**Requirements:** R5 (KTD1, KTD2).
**Files:** DEV compose zitadel profile (from `ontokit-api` compose + `scripts/setup-zitadel.sh`); runbook section (feeds R13); evidence in UAT log.
**Test scenarios:** anonymous can browse + suggest (per AUTH_MODE contract) but not edit; suggester can suggest, not merge; editor edits but cannot admin; admin reviews/merges; role escalation attempts fail.
**Verification:** per-persona log entries with screenshots; gates re-verified after the config flip back.

### U8. Dummy repos — create and seed

**Goal:** R7's two private repos exist and hold real point-in-time snapshots.
**Requirements:** R7.
**Files:** `alea-institute/ontokit-demo-folio` (FOLIO.owl snapshot), `alea-institute/ontokit-demo-semantic-canon` (Semantic Canon snapshot from the CatholicOS source); a README in each declaring frozen-demo status and snapshot date.
**Approach:** `gh repo create` private; seed via one commit each; grant the mirror/bot token write access.
**Test scenarios:** repos private; snapshots load in OntoKit import (spot-check one).
**Verification:** both repos exist with content; bot token can push to them and not by accident to anything else new.

### U9. Demo/live toggle

**Goal:** R8 shipped per KTD3: per-project write-target switch, visible demo banner, hard guarantee that demo mode cannot write to a live repo.
**Requirements:** R8 (KD3, KTD3; KD1 identity still applies in demo pushes).
**Files:** `ontokit-api`: GitHubIntegration/mode surface + guard at the push seam (`github_sync.py` / `mirror_credential.py` path); `ontokit-web`: toggle UI + banner + confirmation on mode switch; tests both sides.
**Test scenarios:** demo project pushes land in the dummy repo; flipping to live requires explicit confirmation; a live-repo URL configured while mode=demo is refused at the push seam (fail-closed, not UI-only); banner state matches server truth after reload.
**Execution note:** The fail-closed server-side guard is the unit's heart — prove it with an integration test that attempts a live write in demo mode.
**Verification:** live DEV demo flow writes only to `ontokit-demo-folio`; UAT log evidence.

### U10. Auto-save preference

**Goal:** R9 shipped: default auto-save ON; settings preference surfaces a manual Save button; first-save toast teaches the behavior.
**Requirements:** R9.
**Files:** `ontokit-web`: `lib/stores/editorModeStore.ts`, `app/settings/page.tsx` (alongside the existing Hide-Save-Button control — reconcile the two so they don't contradict), editor save affordance components; tests.
**Test scenarios:** default state auto-saves on navigate-away with toast on first occurrence; preference ON shows Save button that saves immediately; preference persists; the legacy hide-save-button setting and this preference cannot express a contradictory combination.
**Verification:** browser check of both modes on DEV.

### U11. Test CI — both repos

**Goal:** R10: every fork PR runs the real gate suites.
**Requirements:** R10.
**Files:** `ontokit-api`: `.github/workflows/test.yml` (pytest with `pgvector/pgvector:pg17` + redis services, mypy, ruff); `ontokit-web`: `.github/workflows/test.yml` (type-check, vitest, lint).
**Test scenarios:** Test expectation: none — CI config; proof is a green run on a real PR and a red run on an intentionally broken draft PR (then closed).
**Verification:** both workflows green on the current branches; the intentional-failure check demonstrated.

### U12. DEV auto-deploy + infrastructure-as-code

**Goal:** R11 + R13: push to the deploy branch → DEV updates itself; the entire DEV environment reproducible from committed files.
**Requirements:** R11, R13 (KD4, KTD4).
**Files:** deploy workflow (SSH deploy to the current DEV host — CPX41 now, AWS later, host as a repo variable); `deploy/` directory in `ontokit-api` (or a shared infra home): compose.dev.yaml, traefik route template, env contract (`.env.example`), RUNBOOK.md covering deploy/rollback/logs/auth-mode flip.
**Approach:** Promote the hand-rolled server state into the repo verbatim-then-refactor; server switches to pulling the committed compose.
**Test scenarios:** Test expectation: none — infra; proof is a no-op redeploy from CI producing a healthy stack, and a from-scratch dry-run of the runbook's bootstrap section against a throwaway directory.
**Verification:** a real push deploys DEV with health checks green; drift between server and repo is zero (`diff` in the workflow).

### U13. PROD promotion gate (dormant)

**Goal:** R12's workflow exists and is exercised against DEV as its rehearsal target, wired to a disabled `production` environment until R16.
**Requirements:** R12 (KD6, KTD4).
**Files:** promotion workflow: trigger on green DEV deploy → smoke suite against DEV URL (health, projects API, one UI route) → promote step (no-op/disabled env).
**Test scenarios:** Test expectation: none — infra; proof is the smoke suite passing against live DEV and the promote step visibly skipped-by-gate.
**Verification:** workflow run log shows gate semantics; activation checklist documented in the runbook for R16 day.

### U14. Upstream molecule map + tranche-1 drafts

**Goal:** R14 + R15: the fork's undelivered work partitioned into reviewable tranches; tranche 1 drafted end-to-end, sends awaiting Damien.
**Requirements:** R14, R15 (KD2, KTD5).
**Files:** `docs/roundup-2026-08/UPSTREAM-DELIVERY-MAP.md`: tranche table (feature seam → commit ranges → target repo → issue draft → PR scope → dependency order → review-size estimate); tranche-1 issue bodies + PR descriptions as files.
**Approach:** Derive seams from the feature plans (trust-ladder, PR Party, v0.4.0 phases) per KTD5; respect the existing open upstream PRs (#57/#27) as already-in-flight prefixes, not re-sends.
**Test scenarios:** Test expectation: none — docs deliverable; the map's dependency order is validated by checking each tranche builds green when cherry-picked onto upstream `dev` in a scratch worktree (spot-check tranche 1 only).
**Verification:** Damien can read the map and approve tranche 1 in one sitting; nothing was sent.

### U15. AWS PROD rebuild — BLOCKED on Mike's access

**Goal:** R16 when unblocked: full stack on the ALEA AWS box per the June plan's shape, DEV+PROD co-resident per KD4, promotion gate activated.
**Requirements:** R16 (KD4, KD6). **Unblock condition:** working AWS credentials or Mike-performed SG/DNS actions; instance sizing decided with Mike (Outstanding Questions).
**Approach (pre-work allowed now):** none beyond U12/U13 artifacts, which are its inputs. Everything else waits.
**Test scenarios:** deferred to activation.
**Verification:** deferred to activation.

### U16. PR Party live E2E — BLOCKED on Fr. John (after demo)

**Goal:** The PR Party feature plan's final live gate, using the working DEV demo as the outreach vehicle per KD7.
**Requirements:** R17 (KD7). **Unblock condition:** Damien approves the outreach draft; Fr. John completes the four org gates (PAT, webhook, answerer workflow merge, generation token).
**Approach (pre-work in this plan):** the outreach draft (issue + message) is prepared as part of this unit but held; drafting starts once U4+U9 give the demo.
**Verification:** deferred to activation.

### U17. ontokit.org picker — BLOCKED on domain registration

**Goal:** R18 when unblocked: static picker page (Catholic / FOLIO / architecture instances) served via the Hetzner traefik per KTD7.
**Requirements:** R18 (KD4). **Unblock condition:** Damien registers ontokit.org (availability check is part of this unit's activation).
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

- R1–R15 verified per the Verification Contract; R16–R18 either done (gate lifted) or parked with their unblock conditions current and visible in the Cockpit.
- The UAT log shows a dated full-sweep pass; zero open P0/P1 findings across UAT and the retrospective review.
- All committed work is pushed to the ALEA fork; nothing was sent to `catholicos` without a recorded per-tranche approval.
- Infra-as-code matches the running DEV server (drift check green); hand-rolled state retired.
- Abandoned experiment code from any fix loop is removed, not left in the diffs.
- `docs/roundup-2026-08/` documents (UAT log, delivery map) current; Cockpit on-deck and asks updated; a `ce-compound` learning captured for the GSD-code-verification lesson (tests that mock every seam prove nothing).
