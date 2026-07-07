---
title: "A session-capped WIP that refactored a query left the test suite orphaned-red"
category: workflow
component: pr-drain
date: 2026-07-07
tags: [session-cap, wip-commit, orphaned-red, ce-review, test-doubles, resume, git-ground-truth]
severity: medium
reviewer: kieran-python-reviewer + security-sentinel (/ce:review, re-run)
commit: f8a14d3
pr: alea-institute/ontokit-api#7 (PR-4 cost controls & role gating)
---

# Session-capped mid-refactor → orphaned-red suite

## Problem

PR-4 was cut by a session cap at ~90% with a WIP commit (`11c2fb2`,
"mid-/ce:review hardening … session-capped") sitting on top of the feature
commit. The WIP had done real, correct hardening — including consolidating
`get_budget_status` from **three DB round-trips into one** (FILTER'd SUM columns,
`result.one().monthly/.daily/.week`). But because the session was cut *during*
the review pass, it never re-ran the suite. On resume, the api suite was
**orphaned-red: 10 failures** — the budget-status and status-route test doubles
still mocked the *old* three-query shape (`side_effect=[scalar_one, scalar_one,
scalar_one]`), so `float(row.monthly)` blew up on a bare `Mock`.

The failures were invisible in the handoff notes: the STATUS entry and commit
message both read as "hardening in progress," implying working code. Only running
the suite revealed the red.

## Root cause

A refactor changed a function's DB-access shape but the interrupting cap landed
between "change the implementation" and "reconcile the tests + re-run." The WIP
commit is honest ("session-capped") but a WIP commit is **not a safe-point** —
the tree it captured does not pass. This is the same *orphaned-red* class the
lane has hit before (a source change rewrites behavior while origin-side tests
still assert the old contract), except here the stale tests were the PR's own,
authored one session earlier.

## Fix / resolution

1. **Trust git, not self-reports.** Resumed by diffing the WIP vs the feature
   commit and *running the suite* before believing any "≈done" note. The red
   surfaced immediately.
2. **Reconcile the doubles to the new shape**, don't revert the refactor (the
   consolidation is a legitimate optimization for a member-polled endpoint):
   added `_db_status(monthly, daily, week)` / `_budget_row(...)` helpers modeling
   the single `result.one()` shape, plus an `await_count == 1` assertion that
   *pins the consolidation* so a future re-expansion is caught.
3. **Re-run /ce:review fresh** rather than trusting the interrupted pass. Two
   reviewers per side. It caught a **MEDIUM the cut had hidden**: `get_budget_status`
   returned `budget_consumed_pct` as a bare fraction (0.8) while the sibling
   `get_llm_usage`/`LLMUsageResponse` use the 0–100 convention (`*100`) — a latent
   **100× mis-render** for the first consumer of the snapshot. Also 3 LOWs
   (unconditional `daily_remaining` static lookup; a compiled-SQL pin for the
   consolidated query's BYO/UTC/`LEAST` bound that the mocked tests couldn't see;
   hoisted a per-call role-descriptor dict to module scope).
4. **Squash the WIP into a coherent `feat` + `harden` history** (amend + reword +
   `--force-with-lease`) before opening the PR — a WIP commit should never reach a
   reviewer.

## Lessons

- **A "session-capped" WIP commit is a red flag, not a checkpoint.** Re-run the
  full suite + lint + typecheck on resume before extending the work; assume the
  tree is broken until proven green.
- **When a refactor changes a call's result shape, the test doubles are part of
  the refactor** — reconcile them in the same breath and add an assertion that
  pins the new shape (`await_count`, compiled-SQL) so the optimization can't be
  silently undone.
- **Always re-run `/ce:review` after a mid-review cut.** The interrupted pass is
  worth nothing; a fresh pass found a latent 100× unit bug that the green-again
  suite would not have.
- Mirror the finished side's commit shape (web here was clean `feat` + `harden`);
  a coherent two-commit history makes the slice reviewable and the harden pass
  auditable.
