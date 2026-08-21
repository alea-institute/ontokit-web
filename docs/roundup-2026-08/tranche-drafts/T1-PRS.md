# Tranche 1 held PR package

**Status:** Draft only. Replace placeholders with final upstream branch names, SHAs, issue numbers, and exact verification output immediately before the authorized batch.

## Web PR — refresh or supersede #57

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

Closes `[web optional-auth issue]`.  
Related: CatholicOS/ontokit-web#360.  
Supersedes or refreshes CatholicOS/ontokit-web#57.

## Source and scope

- ALEA source head: `[final web SHA]`
- Current local synthesis candidate: `4986135c` (`upstream-queue/t1-web-synthesis`), based directly on CatholicOS web `dev` at `c714c74b`
- CatholicOS base: `[refreshed catholicos/dev SHA]`
- This is a current-upstream synthesis of the old #57 prefix plus later authorization and issuer-validation hardening. Mixed LLM, trust, PR Party, translation, and editor-preference commits are excluded and remain mapped in later tranches.

## Verification

- `[exact Vitest result]`
- `[exact type-check result or refreshed baseline disposition]`
- `[exact lint result]`
- `[exact production build result]`
- `[Standard/Developer public browser receipt]`
- `[final scratch replay receipt]`

Current scratch receipt: 163 files/2,798 tests, type-check, lint with zero errors/15 baseline warnings, and optional/no-Zitadel production build with 22 static pages pass. The candidate includes current issuer fail-fast and anonymous-route hardening while preserving optional mode without Zitadel. Refresh and rerun immediately before the authorized batch.

No self-merge is requested.

## API PR — refresh or supersede #27

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
Supersedes or refreshes CatholicOS/ontokit-api#27.

## Source and scope

- ALEA source head: `[final API SHA]`
- Current local synthesis candidate: `d2c31aea` (`upstream-queue/t1-api-synthesis`), based on CatholicOS API `dev` at `a21b7d5c`
- CatholicOS base: `[refreshed catholicos/dev SHA]`
- This is a current-upstream synthesis of the old #27 prefix. LLM, trust, PR Party, translation, deploy, and later residual seams are excluded and remain mapped separately.

## Verification

- `[exact unit/integration result]`
- `[exact Ruff result]`
- `[exact mypy result]`
- `[exact authorization/security result]`
- `[final scratch replay receipt]`

Current scratch receipt: 1,580 tests, Ruff, and strict mypy pass. The candidate excludes PR #27's unrelated seed-script and annotation-index changes and includes the later HTTP/WebSocket auth parity and anonymous-route hardening. Refresh and rerun immediately before the authorized batch.

No self-merge is requested.
