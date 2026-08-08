# Handoff — OntoKit Roundup, ready to start Phase A

**Date:** 2026-08-08 · **Repo:** ontokit-web (+ ontokit-api) · **For:** a fresh session starting `ce-work` on Phase A of the roundup plan.

## One-paragraph situation

The 2026-08 OntoKit roundup was consolidated, planned, and vetted. The implementation-ready plan
`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md` (on branch `feat/roundup-brainstorm`)
has passed **three review rounds** across two model families (5 in-process + 4 Codex reviewers), converging on
refinements — it is ready for `ce-work`. Damien's decision: **build Phase A next**, with a **phase-gate check-in**
(run all of U1–U7, verify each unit, report the whole phase before Phase B/C). This handoff exists because the
planning session reached ~76% context; start Phase A fresh.

## Non-negotiable working rules (Damien, 2026-08-08)

1. **Full CE harness always** — brainstorm → plan → doc-review(adversarial) → work → code-review → compound. "Proceed" never means skip stages. (Memory: `full-ce-harness-always`.)
2. **Fable orchestrates; fan out Codex workers; never Opus subagents.** `worker_route: codex` in `agents/tier.json` governs. Do not switch the interactive model off Fable, and you cannot run `/model` (client-side) — if a TIER_CHANGE fires, tell Damien. (Memory: `opus-for-review-personas`, now corrected.)
3. **Orchestrator verifies every artifact itself** and re-runs gates before accepting a worker's green claim; adversarially verify findings.
4. **Approval gates:** any send to the `catholicos` org (issues/PRs/pushes), any AWS action, any spend. Fork pushes to `origin` (alea-institute) are free.

## Where the code + plan live

- **Plan (WHAT/HOW):** `docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md` — read Goal Capsule, then U1–U7 with their cited R/KD/KTD, Verification Contract, Definition of Done.
- **Supporting:** `docs/roundup-2026-08/{MASTER-OUTLINE.md, IN-FLIGHT-STATUS.md, DEV-UAT-LOG.md}` and both repos' `docs/residual-review-findings/2026-08-08-*` (the LLM review + three fix-round dispositions + the alignment-review verdicts).
- **Code branch:** `feat/pr-party` in both repos. ontokit-web is worked in a worktree at `.worktrees/pr-party`; ontokit-api at its repo root (already on `feat/pr-party`). Pushed to `origin`: web `2cedd79d`, api `9489b536`.
- **The planning branch `feat/roundup-brainstorm`** holds only docs and is cut from an old `main` (330 behind `origin/dev`) — a doc-only branch; do not build code on it.

## Live DEV environment (already up)

- **URL:** `https://ontokit.dev.openlegalstandard.org` — full stack (pgvector, redis, minio, api, worker, web) on the CPX41 `ontokit-dev`, fronted by hetzner-dev's Coolify traefik via the `*.dev.openlegalstandard.org` wildcard + Let's Encrypt.
- **Auth gate:** the public surface is behind a traefik **basic-auth** middleware (closed a live P0 — auth-disabled DEV was internet-reachable). Credentials live server-side in the traefik dynamic config on hetzner-dev; rotate/read there, not from this doc.
- **Seeded project:** "FOLIO DEV" `9981eedd-1808-4aaa-8fd3-d1f135461808` (18,566 entities). Currently `AUTH_MODE=disabled` for the functional UAT loop — per KTD2 the terminal state must be auth-enabled (U7), and the DoD sweep is collected auth-on.
- **Deployed API SHA:** round-3 fixes `9489b536`; web `2cedd79d`.
- **Local test infra for API gates:** pgvector on `127.0.0.1:5433` (ontokit/ontokit_test/ontokit_test), redis on `127.0.0.1:6380` — the Verification Contract's `TEST_DATABASE_URL`/`TEST_REDIS_URL` point here (throwaway containers).

## Phase A = U1–U7 (the fix/UAT loop). Build these, verify each, report the phase.

- **U1** F3 — right-size mint validation + surface the 422 `errors` list (the live blocker: valid FOLIO mints 422 with a swallowed detail). Red-then-green on live seams. Includes the restriction/blank-node parent test.
- **U2** F1 — default-branch resolution on ontology read endpoints.
- **U3** F4 — public projects list renders the seed (fix in `app/page.tsx`, not the `app/projects/page.tsx` redirect stub; likely a session-gated query under auth-disabled or an SSR in-container URL).
- **U4** browser UAT sweep (chrome-devtools MCP only) with a fix loop — projects, editor tree, class detail, auto-save, suggestion UI, model picker (registry/local/custom states), duplicate warnings; clean console on happy paths.
- **U5** suggestion lifecycle live — dup-block, external-IRI parent accept, personal-branch accumulation, submit-opens-PR, approve→merge→trust (attributed commit, bot committer), reject→no credit.
- **U6** retrospective alignment review of everything built outside the harness on 2026-08-08 (fix rounds 1–3, DEV infra) — **five lenses incl. security**, with the anti-ratification instruction (don't rubber-stamp KD1/KD4-absorbed work; flag any built artifact with no written requirement).
- **U7** Zitadel persona pass — real infra work (KTD9), not an env flip; terminal auth-on sweep; leaves DEV auth-enabled.

Then **stop and report Phase A** before Phase B (demo/UX) and C (pipeline).

## Open Cockpit asks (Damien ↔ agent)

- `ontokit-web-2026-08-08-plan-review-outcome` — proceed decision (answered: build Phase A, phase-gate).
- `ontokit-web-2026-08-08-roundup-execution` — DEV topology (answered).
- `ontokit-web-2026-08-08-aws-dns-access` — Mike's AWS access for the eventual PROD rebuild (still open; gates U15/R16). Not needed for Phase A.

## Do NOT

- Do not push to `catholicos`. Do not touch the AWS box (needs Mike). Do not rebase `feat/pr-party` (KTD11 — U14's molecule map assumes stable hashes).
- Do not build on `feat/roundup-brainstorm`.

## Retire this handoff when

A fresh session has resumed from it, completed Phase A, and the learnings landed in the UAT log + a `docs/solutions/` capture (the U18/DoD `ce-compound` learning: tests that mock every seam prove nothing — real-data UAT found F2/F3).
