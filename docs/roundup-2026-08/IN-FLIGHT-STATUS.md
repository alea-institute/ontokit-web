# In-Flight Status Scan — 2026-08-08

Companion to `MASTER-OUTLINE.md`. A repo survey of `ontokit-web` + `ontokit-api`
(branches, `.planning/` state, feature presence) run the same day the outline was
consolidated. Headline: **most of the outlined feature surface already exists on the
fork; the genuine work is delivery, deployment, and a short list of true gaps.**

## Headlines

1. **v0.4.0 "LLM-Assisted Ontology Improvements" is COMPLETE.** GSD milestone
   10/10 phases, 35/35 plans (last activity 2026-04-08): roles/LLM/cost (P11),
   toolchain + dedup (P12), validation + generation (P13), inline suggestion UX (P14),
   session clustering + batch submit (P15), reviewer enhancements (P16). The
   LLM-assisted-improvements PRD (`O4`) is largely **built**, including BYOK,
   duplicate defense, embeddings/semantic search, and session clustering.
2. **PR Party is 14/15 units done, twice code-reviewed, never run live.** Only
   U14 (live end-to-end gate) remains, blocked on four *external* actions:
   Fr. John's PAT intake, CatholicOS org-webhook creation, merging the answerer
   workflow into `catholicos/.github`, and the shared generation token.
3. **The GitHub write pipeline is REAL, not fake** — `pygit2` pushes
   (`github_sync.py`) + REST PR creation (`pull_request_service.py`,
   `pr_party_github.py`). But every call is gated on a configured
   `GitHubIntegration` row + resolvable token; unconfigured deployments silently
   fall back to DB-only PRs. The Aug-8 outline's "it's just fake" suspicion is a
   **configuration/deployment problem, not a code gap**.
4. **The commit-identity divergence (Q1) is already reconciled in code.**
   `ontokit/services/commit_identity.py` mints per-user noreply author identities;
   `mirror_credential.py` pushes with a system-owned machine token (deprecated
   per-user-PAT fallback). Bot pushes, contributor authors — the recommended
   option. The ruling is now ratify-or-reverse.
5. **~690 commits are undelivered upstream.** Two `feat/pr-party` branches
   (web +386 / api +303 vs main) have **zero** CatholicOS PRs. The 10+10 open
   `origin` PRs are a self-review staging queue. Upstream hasn't even merged
   AUTH_MODE yet (catholicos web #57 / api #27, open since 2026-04-03).

## Genuine gaps (the real new work)

- **Auto-save preference** — ABSENT. Only a "Hide Save Button" toggle exists
  (`app/settings/page.tsx:335`); auto-save itself is unconditional, no on/off
  preference (T-May decision not yet implemented). Upstream issue #212 adjacent.
- **Demo mode / dummy repo / demo-data cleanup** — ABSENT in both repos. No
  demo-mode, dummy-repo, or staging deployment artifacts (api `app_env` accepts
  `"staging"` but nothing deploys it).
- **Hetzner/staging environment** — plan only
  (`docs/rollout-roadmap:docs/plans/2026-06-09-002-...hetzner-dev-environment-plan.md`),
  never executed.
- **CI** — neither repo has test/build CI nor any deploy workflow. DEV→PROD
  auto-promotion (Q6) would be built on top of CI that does not exist yet.
- **U14 live E2E** — the whole untested risk surface of PR Party.
- **Entity-graph port** — milestone complete; needs only visual verify + PRs
  (catholicos #88 web / #37 api already open from the upstream queue).

## Branch map (2026-08-08)

| Repo | Branch | vs main | vs origin/dev | Note |
|---|---|---|---|---|
| web | `feat/pr-party` | +386 | +56 | 14/15 units built; cut from trust-ladder |
| web | `feat/trust-ladder` | +376 | +46 | trust ladder + commit identity |
| web | `feat/roundup-brainstorm` | +1 | 330 behind | **this consolidation; old base — will need rebase/move** |
| web | `docs/rollout-roadmap` | +15 | 330 behind | roadmap + Hetzner plan docs |
| web | `feat/ecosystem-loop-spec` | +4 | 330 behind | shared suggestion schema draft |
| api | `feat/pr-party` | +303 | +57 | U1–U9, U15 modules |
| api | `feat/trust-ladder` | +287 | +41 | commit-identity endpoints |
| both | `upstream-queue/*` | — | — | 8+6 branches, one origin PR each (self-review queue) |

## Feature presence vs the master outline

| Outline item | Status | Evidence |
|---|---|---|
| Suggestion workflow (suggester role, sessions, review queue) | **DONE** both repos | `app/projects/[id]/suggestions/`, `ontokit/services/suggestion_service.py`, trust ladder services |
| LLM-assisted contributions (O4) | **DONE** | `lib/api/generation.ts`, `ontokit/services/llm/` (13 providers), dedup + embeddings + clustering |
| BYOK cost model | **DONE** | LLM config/BYOK (origin PR #6 pair) |
| GitHub wiring | **REAL, config-gated** | `github_sync.py:97,149,175`, `pull_request_service.py:277` |
| Commit identity (bot + attribution) | **DONE** | `commit_identity.py`, `mirror_credential.py`, `user_settings.py:159,184` |
| Zitadel SSO (no GitHub-login coupling) | **DONE** | `auth.ts:19-40`, `auth_mode` required/optional/disabled |
| Notifications/bell, PR Party queue UI | **DONE** | `app/pr-party/`, `components/pr-party/`, bell + ntfy |
| Auto-save preference toggle | **ABSENT** | only Hide-Save-Button exists |
| Demo mode / dummy repo | **ABSENT** | zero hits both repos |
| Staging/Hetzner env | **PLAN ONLY** | 2026-06-09-002 plan, never run |
| Test/deploy CI | **ABSENT** | workflows = dependabot/semgrep/release/pr-guard only |
| DEV→PROD auto-promotion | **ABSENT** | no deploy workflow exists at all |

## Consequences for the roundup

- The brainstorm's center of gravity shifts from *build features* to:
  **(a) deliver upstream** (issue-first molecule/PR strategy for ~690 commits),
  **(b) deploy for real** (staging + PROD sync + CI + config so the real pipeline
  fires), **(c) close true gaps** (demo mode, auto-save pref, U14 E2E).
- Q1 (commit identity) and much of Q2's machinery are already answered by code.
- Q5 (GSD vs CE): no in-flight GSD remains; post-April work already uses CE
  unified plans in `docs/plans/`. The question is effectively settled by practice.
- Railway nuance for Q4: `railway.json` still exists in ontokit-api and upstream
  issue #100 "Deploy API to Railway" is open — killing Railway should close both.
