---
module: ontokit (api + web)
date: "2026-08-09"
problem_type: convention
component: testing_framework
severity: high
applies_when:
  - "planning any feature that crosses a database, git, queue, or provider seam"
  - "reviewing a plan's Verification Contract or a PR claiming green suites"
  - "deciding what a unit suite's green result actually proves"
tags:
  - integration-testing
  - mocks
  - real-seams
  - verification
  - test-adequacy
---

# Tests that mock every seam prove nothing — every plan gets a real-seam proof unit

## Context

Twice in two days, large all-green mocked unit suites concealed defects that broke the happy path outright:

- **Phase A DEV UAT (2026-08-08).** 2,588 green api unit tests hid F5 (a 70-minute submit hang), F7 (capabilities-blind editor), F8 (empty graph), and F9 (auth-disabled API reachable from the internet). All four were found only by real-data UAT against the live DEV seams (`docs/roundup-2026-08/DEV-UAT-LOG.md`). The same day's LLM subsystem review (`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md`) found three P0s that 592 green unit tests were structurally blind to: a git method mocked into existence, a DB CHECK constraint absent from mocked sessions, and an unreachable model config.
- **Translations build (2026-08-09).** The plan's dedicated real-seam proof unit (`ontokit-api:tests/integration/test_translation_lifecycle.py` — real Postgres, real bare git, providers faked only at the HTTP boundary) caught 4 real bugs that 2,600+ green mocked unit tests missed: async lazy-load `MissingGreenlet` failures in the translation jobs and again in the confirmation route, the provisional gate ignored at commit eligibility, and wrong bot identities at the author/committer seam.

The pattern: every layer tested against a mock of the adjacent layer means the seams themselves — where these bugs live — are never executed.

## Guidance

- **Every feature plan includes one real-seam integration unit as its proof unit.** Real database (migrated, not `create_all`-only), real git (temp bare repos), real queue execution inline where possible. Fake only the paid/external provider boundary (HTTP-level), never internal services, scorers, or commit paths.
- **The proof unit exercises the advertised loop end-to-end** — the acceptance examples from the plan, not synthetic fragments — and is listed in the plan's Verification Contract as a gate.
- **Unit suites declare constraints on models**, so `create_all` test schemas match migrations (the mocked-session CHECK-constraint blindness from the LLM review cannot recur silently).
- **A worker's or reviewer's "suite green" claim is not evidence of a working seam.** Treat it as evidence only for the layer it exercises; the proof unit is what speaks for the seams.

## Why This Matters

Both rounds produced not-deployable software behind fully green dashboards. The cost asymmetry is stark: the translations proof unit was one module (~5 scenarios, ~6s runtime) and caught in minutes what DEV UAT had needed a full manual sweep to catch the day before. Mock-only suites also promote structural blindness into false confidence — the more of them there are (2,588 green), the more convincing the lie.

## When to Apply

At plan time (the proof unit is an Implementation Unit with its own U-ID), at review time (its absence is a finding), and at integration time (the orchestrator runs it as an authoritative gate, not just the unit suite).

## Examples

- Working example: `ontokit-api:tests/integration/test_translation_lifecycle.py` — configure → mint via the real source-save route → jobs inline → verified commit with split author/committer + in-graph annotations → coverage reflects it → confirmation flow → era-scoped backfill precision → in-flight edit race discards stale output.
- Counter-example (what not to trust): the 2026-08-08 review's P0-1 — `commit_to_branch` didn't exist anywhere in the git service, yet tests passed because the mock created the attribute.
