# Tranche 1 held PR package

**Status:** Executed 2026-09-07 after gate B2 was answered yes for T1 only, after replay and with no self-merge.

## Web PR — refresh or supersede #57

Executed PR: https://github.com/CatholicOS/ontokit-web/pull/402

### Title

feat: support optional auth and guarded anonymous proposals

### Body

## Summary

- add coherent `required`, `optional`, and `disabled` authentication modes;
- preserve optional anonymous browsing when Zitadel is not configured, while refusing partial or required-provider configuration;
- expose sign-in-to-edit affordances only when a provider exists;
- allow guarded anonymous proposal sessions without session-gating public projects or graphs;
- preserve both Standard and Developer viewer layouts.

## Issue links

Closes CatholicOS/ontokit-web#401.
Related: CatholicOS/ontokit-web#360.  
Supersedes CatholicOS/ontokit-web#57, which was closed with a pointer comment.

## Source and scope

- CatholicOS replay head: `812eae656e0934e54dfe7e46f5154d63eb05c773` (`upstream-queue/t1-web-replay-20260907`), also backed up on the ALEA fork under the same branch name
- CI follow-up commit `df50cb61` (`ci: build in the credential-free optional-auth mode`) added `AUTH_MODE: optional` to the build job environment after the first CI run left it unset and correctly refused a required-mode build without a provider, mirroring the ALEA fork's release workflow; the PR head is now `df50cb61`, while `812eae65` remains the replay content
- Rebased from synthesis `4986135c` in 13 commits with no conflicts, plus one replay fix restoring `hover.enabled` to `"on"` for monaco-editor 0.56 typing
- CatholicOS base: `dev` at `92f8951a`
- This is a current-upstream synthesis of the old #57 prefix plus later authorization and issuer-validation hardening. Mixed LLM, trust, PR Party, translation, and editor-preference commits are excluded and remain mapped in later tranches.

## Verification

- Fresh `npm ci` on the base lockfile; Vitest passed 163 files and 2,798 tests.
- `tsc --noEmit` completed cleanly.
- ESLint completed with 0 errors and 16 warnings, identical to bare `catholicos/dev` at `92f8951a`.
- The `AUTH_MODE=optional` production build, with no Zitadel values, compiled with 22/22 static pages.
- CatholicOS CI on PR #402 passed after the CI commit: build, lint, test, type-check, Semgrep scan, and CodeQL.
- The Standard/Developer public browser receipt is deferred to the DEV UAT pass.
- Scratch replay completed from synthesis `4986135c` in 13 commits with no conflicts; the only replay fix restored `hover.enabled` to `"on"` for monaco-editor 0.56 typing.

Executed receipt: the replay includes current issuer fail-fast and anonymous-route hardening while preserving optional mode without Zitadel. The owning PR closes #401, relates #360, and supersedes #57.

No self-merge is requested.

## API PR — refresh or supersede #27

Executed PR: https://github.com/CatholicOS/ontokit-api/pull/228

### Title

feat: support optional auth and guarded anonymous suggestions

### Body

## Summary

- add exact authentication modes with optional no-provider support;
- add anonymous suggestion sessions and guarded submission behavior;
- retain public-project reads while keeping private and authenticated mutations closed;
- include current rate-limit, honeypot, cleanup, and authorization hardening.

## Issue links

Closes CatholicOS/ontokit-api#83.  
Supersedes CatholicOS/ontokit-api#27, which was closed with a pointer comment.

## Source and scope

- CatholicOS replay head: `de91234755fafefda6e709608021e48779e4c277` (`upstream-queue/t1-api-replay-20260907`), also backed up on the ALEA fork under the same branch name
- Rebased from synthesis `d2c31aea` in 11 commits with no conflicts, plus one replay fix re-parenting migration `t8u9v0w1x2y3` on `47cc27515626`
- CatholicOS base: `dev` at `ff8b300f`
- This is a current-upstream synthesis of the old #27 prefix. LLM, trust, PR Party, translation, deploy, and later residual seams are excluded and remain mapped separately.

## Verification

- Fresh `uv sync --group dev`; pytest passed 1,580 tests against real PostgreSQL 17 with pgvector and Redis.
- Ruff check and format completed cleanly.
- Mypy completed cleanly across 110 files, and Pyright completed with 0 errors.
- The real PostgreSQL and Redis suite passed the authorization and anonymous-route coverage included in the 1,580-test run.
- Alembic reported the single head `t8u9v0w1x2y3`; a scratch-database `upgrade head` applied `94afeba9ab5c -> 47cc27515626 -> t8u9v0w1x2y3`, and `downgrade -1` reverted cleanly.

Executed receipt: the replay excludes PR #27's unrelated seed-script and annotation-index changes and includes the later HTTP/WebSocket auth parity and anonymous-route hardening. The owning issue #83 was updated rather than duplicated, and the owning PR supersedes #27.

No self-merge is requested.
