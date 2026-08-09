# Master handoff — OntoKit, 2026-08-09

**For:** a fresh session picking up where this one left off. This session ran Phase A of the roundup end-to-end, closed two live security exposures, cleaned up stale infra, then brainstormed the first of five recovered intents. Three threads are open: **(T1)** plan/build the translations feature, **(T2)** the remaining 4 brainstorm intents, **(T3)** the U7 Zitadel standup. Read this, then pick a thread — nothing is blocked on anything except where noted.

## Non-negotiable working rules (Damien)
1. **Full CE harness always** — brainstorm → plan → doc-review(adversarial) → work → code-review → compound. "Proceed" never means skip stages.
2. **Fable orchestrates; fan out Codex workers, never Opus subagents.** `worker_route: codex` in `~/Coding Projects/agents/tier.json` governs. Read it before dispatching. Codex has **no network / no SSH** — box edits are the orchestrator's own work; Codex handles repo-local code + tests. Do not switch the interactive model off Fable without asking.
3. **Orchestrator verifies every artifact itself** and re-runs gates before accepting a worker's green claim; adversarially verify findings (this session downgraded a review P1 that way).
4. **Approval gates:** any send to the `catholicos` org, any AWS action, any spend. Fork pushes to `origin` (alea-institute) are free. **Never merge CatholicOS PRs** (peer review).
5. **Chrome DevTools MCP only** for visual checks. **AskUserQuestion** for decisions (one-click on Remote Control). Decisions Damien must make → also a `briefs/qa` Cockpit ask.

---

## T1 — Translations feature: ready for ce-plan (RECOMMENDED next)

**Requirements-only plan (this session's brainstorm output):**
`docs/plans/2026-08-09-001-feat-translations-annotation-plan.md` — passes the Ready-for-Planning check (R1–R14 continuous, KD/Flow/AE links consistent, work-relationships section present, all open items classified `Deferred to Planning`).

**What it is:** LLM auto-translates a concept's labels (prefLabel + altLabel) into each instance's admin-configured languages at mint; definitions/examples on-demand. The verification mechanism (admin-chosen: consensus+back-translation default, or cheaper confidence-scored; optional "provisional until a native confirms" gate) **is** the commit gate — machine translations commit under it, NOT through human PR review. Every translation carries provenance (model/method/trust/state/timestamp) enabling era-scoped re-translation. Coverage view + admin bulk backfill with a cost preview (default cheap async batch). Native-speaker reviewer is a multi-assignable role tag. All cost/config per-instance (BYOK).

**To pick up:** `ce-plan docs/plans/2026-08-09-001-feat-translations-annotation-plan.md`. The load-bearing planning decision flagged in Outstanding Questions is the **translation-provenance representation** (a plain `"x"@es` literal can't hold provenance) — the coverage view, provisional flags, native-review queue, and era-scoped backfill all depend on it. Grounding already done: `lib/ontology/annotationProperties.ts`, `components/editor/ClassDetailPanel.tsx` + `lib/ontology/turtleClassUpdater.ts` (existing per-value lang-tag handling), Phase A trust ladder + commit-identity (KD1) this extends.

---

## T2 — The other 4 recovered intents (brainstorm sequence)

Damien's ruling (Phase A gate, ask `ontokit-web-2026-08-08-phase-a-gate`): pull all five 2026-08-08 consolidation-dropped intents back via **full ce-brainstorm→ce-plan**, in this order. Intent 1 (translations) is done (T1). Remaining, in order:

- **#2 — User-configurable N-day auto-accept** of edits/PRs (feature → `ce-brainstorm`). Touches the Phase A trust ladder + review workflow.
- **#3 — "Then-current credentials" + contributor identity metadata** carried on bot-authored submissions (feature → `ce-brainstorm`). Closely related to Phase A KD1 attribution mechanics.
- **#2-eval — SSO evaluation** (Google login / other SSO vs Zitadel) — this is an **adopt-vs-evaluate verdict → `ce-pov`**, not a build brainstorm. Timely, since U7 is standing up Zitadel now.
- **#4-eval — FOLIO tooling evaluation** across Generative-FOLIO / folio-python / folio-api / OWL — **verdict → `ce-pov`**.

Source of all five: `docs/residual-review-findings/u6-lens2.md`. Memory: `project_five_dropped_intents_brainstorm`. Each is independently plannable; the translations plan's "How This Work Fits Together" section maps the relationships (#3 shares the trust/role model; the two evals are `ce-pov`-shaped).

---

## T3 — U7 Zitadel standup (Phase A's last unit)

**Detailed handoff:** `docs/handoffs/2026-08-08-u7-zitadel-standup-handoff.md` — the KTD9 work list. Build the credential-free Zitadel-on-DEV infra with DEV kept `AUTH_MODE=disabled`; **STOP before the auth-on flip** (Damien owns that timing). 

**Update since that handoff:** the DEV auth-gate credential Damien needed to provide is now **SET and validated** (stored `~/.config/ontokit-dev/gate-credential`, mode 600; the traefik basic-auth `ontokit` user authenticates: no-auth 401 / with-auth 200). So the only remaining human step for the eventual flip is Damien's go — the infra standup itself is fully autonomous now. Codex can't reach the box; the orchestrator does the box edits (SSH `root@178.156.208.239` via `~/.ssh/hetzner_dev`), Codex does repo-local compose-as-code + script parameterization + tests.

---

## Phase A — done & verified (context; do not redo)

U1–U6 + U5 complete on `feat/pr-party` (api `23aab106`, web `add33b20`), pushed to the ALEA fork, deployed to DEV (`https://ontokit.dev.openlegalstandard.org`, behind traefik basic-auth). Every fix red-then-green on live seams; api 2588 tests / web 3189 green. Full record: `docs/roundup-2026-08/DEV-UAT-LOG.md`. Retrospective 5-lens review + dispositions: `docs/residual-review-findings/2026-08-08-retrospective-alignment-review.md` (+ `u6-lens{1..5}.md`).

**Live findings F1–F9 — all resolved this session:** F1 default-branch, F3 mint-validation, F4 projects list, F5 (70-min submit hang → 26s: storage-key-as-git-path → shadow file → unbounded dup sweep; fixed with path-from-git-tree + baseline guard + 25-entity cap), F7 capabilities-blind editor UI, F8 empty graph, **F9 + F9-v6 (Docker port-publish bypassed ufw → auth-disabled API/web were internet-reachable; closed at DOCKER-USER (IPv4) + ip6tables INPUT (IPv6), persisted)**. F6 stale Coolify triad **fully decommissioned** (apps 7/8/9 deleted via Coolify's own teardown job; `ontokit-api.dev` gated to a deadend 503 at the traefik file provider; `ontokit.dev` pinned to CPX41 via router priority).

**Routed U6 findings (tracked, not Phase-A-gating):** → U12 IaC (encode the F9/F9-v6 firewall + basic-auth + deadend routers as versioned infra so a rebuild can't reopen them; rotate default DB/MinIO creds; resource limits). → U9 (deny-by-default GitHub target authorizer — note: `github_integrations`=0 on the DEV seed, so submit opens a LOCAL bare-repo PR; no live GitHub credential to abuse there). → new ontokit-api issues (paid-embedding budget check-then-spend race; active-jobs migration racing live workers). → U7 (the KD1 author≠committer attribution proof needs a real named persona — under auth-disabled the actor is anonymous so author==committer).

**Phase A gate decisions (answered, ask retired):** U7 infra-now/flip-later; stale Coolify decommissioned; all 5 intents → brainstorm/plan; proceed B‖C with U12 IaC front-loaded. Cockpit: `briefs/qa/ontokit-web-2026-08-08-phase-a-gate*` (folded into `qa-state.json`); on-deck updated.

## Branches & environment
- **Code:** `feat/pr-party` in both repos — do NOT rebase (KTD11: U14's molecule map assumes stable hashes). ontokit-web worked in the worktree `.worktrees/pr-party`; ontokit-api at its repo root.
- **Docs/plans/brainstorms:** `feat/roundup-brainstorm` (this branch — docs only, cut from old main; do not build code here).
- **Local API test infra:** pg `127.0.0.1:5433`, redis `127.0.0.1:6380` (throwaway).
- **Web rebuilds on the box MUST be `--no-cache`** AND confirm no stale `ontokit-api.dev` chunks remain (turbopack cache baked the old host once — F6).

## Retire this handoff when
A fresh session has resumed from it and either planned/built translations (T1), advanced the brainstorm sequence (T2), or completed the U7 standup (T3) — and updated the relevant tracker (`docs/roundup-2026-08/DEV-UAT-LOG.md`, on-deck, or the plan). The U18/closeout `ce-compound` learning (tests that mock every seam prove nothing — real-data UAT found F5/F7/F8/F9) is still to be written.
