---
title: Fifteen units, isolated workers — where cross-unit defects actually surface, and five invariants that survived contact
date: 2026-07-28
lane: ontokit (PR Party as a first-class OntoKit feature)
module: pr-party
problem_type: architecture_pattern
tags: [multi-agent, orchestration, integration-contracts, mutation-testing, idempotency, fail-open, fail-closed, prompt-injection, migrations, react-query, packet-design]
status: solved
related:
  - docs/plans/2026-07-26-011-feat-pr-party-ontokit-native-plan.md
  - docs/residual-review-findings/2026-07-28-pr-party-code-review.md
  - ../ontokit-api/docs/residual-review-findings/2026-07-28-pr-party-code-review.md
  - ~/Coding Projects/docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md
---

# Fifteen units, isolated workers

**2026-07-28 · ontokit-web + ontokit-api · PR Party (U1–U15) built by a fleet of isolated Opus workers under one orchestrator**

## Context

PR Party — async PR review for the CatholicOS GitHub org — was specced as 15 units across two repos and handed to
isolated workers, one packet per unit, orchestrator holding integration. Every unit landed green on its own suite.
That is exactly the condition under which the interesting failures hide, and the notes below are the ones that
generalize past this feature.

None of this is a description of PR Party. For what it does, read the plan; for what is still open, read the two
residual-findings docs. This is what the build taught about *how* to run work of this shape.

---

## 1. Cross-unit contract breaks are invisible to per-unit tests — the orchestrator's diff read is the only tier that sees them

Serial integration inspection at each hand-off caught two defects that no unit's own suite could have caught, because
each unit was internally consistent and fully green:

- **A worker mapped "discuss live" to `verdict: "comment"`.** Its tests asserted the mapping it had written, and they
  passed. Shipped, this would have posted **real GitHub comment-reviews** on colleagues' PRs every time a reviewer
  chose "let's discuss this live" — the one option that is supposed to *park a card and post nothing*. The unit's
  contract with the verdict enum was correct in isolation and wrong against the product meaning owned by another unit.
- **U1's model docstring stated the opposite `author_kind` convention from what U4 implemented.** Both sides were
  self-consistent; the disagreement existed only in the space between them, which is the space no unit test covers.

The structural lesson: **with isolated workers, per-unit tests certify internal consistency, and nothing else.**
Cross-unit defects live at the seams by definition, so the orchestrator's diff-and-contract read *at each integration
point* is not overhead layered on top of testing — it is the only tier of verification that can see that class of bug
at all. Budget for it as a first-class step, and do it serially at each hand-off rather than in one pass at the end,
because a contract break inherited by three downstream units is three times the rework.

## 2. Packets should invite refusal — a worker that reports an impossible instruction beats one that satisfies it

Two workers **declined to implement what their packet said**, and reported back instead of guessing. Both refusals
were correct, and both saved a real defect:

- **"A failed row and a fresh pending row cannot coexist"** — stated as index semantics. Implementing it would have
  made **C6 retry structurally impossible**: if the failed row blocks the new pending row, the user can never retry.
  The honest partial-index semantics were the *opposite* of what the packet asserted.
- **"Synthesize the PR title from the brief prose"** — the worker reported that this fabricates a field GitHub owns,
  rather than inventing a plausible title.

The generalizable move is in packet design: **write packets that make "this instruction is wrong" a legitimate
deliverable.** A worker optimizing purely for "satisfy the packet" will find *some* implementation of an incoherent
instruction, and it will be green, and it will be wrong in a way that reads as intentional. Say explicitly that
reporting a contradiction is success, and the failure mode largely disappears.

## 3. Mutation testing as the acceptance bar for security invariants — green tests do not prove containment

The brief worker owned six load-bearing properties: tool-denial at the subprocess boundary, budget fail-closed, head
re-check before publish, link allowlist, artifact-path guard. Each was accepted only after **reverting the source
change and confirming the owning test went red.**

This caught what a green suite cannot show you: a test that passes both with and without the control is not testing
the control. Section A4/B4 of the residual findings has a live instance of the failure this bar prevents — the brief
head-SHA re-check test **cannot fail if `populate_existing` is dropped**, because the fake session ignores execution
options. That test is green today and asserts nothing.

Bar to carry forward: **for any invariant whose violation is a security or data-integrity event, the acceptance
criterion is "revert the source, watch the test fail" — not "the test passes".** It costs one revert per invariant.

## 4. When a plan names a mitigation, verify the mitigation reaches the mechanism

The plan's fix for double-actuation was `retry: false`. That is a React Query option — and **React Query already does
not retry mutations**, so the setting was a no-op against the stated threat. The actual 3-attempt 5xx retry loop lived
**inside the shared API client's `request()`**, one layer below, unreachable from the query layer entirely.

The mitigation was named at the layer where the *feature* lived rather than the layer where the *behavior* lived. This
is a specific and recurring planning failure: a plan can correctly identify a risk, name a real-sounding control, and
have the control apply to nothing. **Trace every named mitigation down to the code that implements the mechanism it
claims to constrain** — and if the mechanism turns out to live in shared infrastructure, that is a scope discovery,
not a detail.

## 5. Derive idempotency keys from intent; do not remember them

A remembered idempotency key (module-level `Map`, component state, anything in memory) is **lost precisely when it is
needed** — the user's retry very often *is* a page reload, and a reload wipes the memory that would have deduplicated
it. Deriving the key deterministically from the intent tuple means the reload reproduces the same key and the server
recognizes the replay.

The second half is easy to get wrong in the safe-looking direction: **the digest must include the body and any
override, not just the identity of the target.** With identity alone, a reviewer who edits their notes and re-taps
gets a silent replay of the *old* receipt — the system reports success and posts nothing new. The user-visible symptom
is "my edit didn't save" with no error anywhere.

## 6. Fail-open vs fail-closed is a per-route decision, never a per-service one

The same Redis-backed limiter serves two routes with deliberately opposite postures:

- **Actuation fails closed (503).** Cannot verify the limit ⇒ do not post a real GitHub review under a human's identity.
- **Credential PUT fails open.** A Redis blip that locks a reviewer out of *connecting the PAT that un-degrades them*
  protects nothing — it converts a transient infra hiccup into a user who cannot fix their own account.

The generalizable test is to ask what the failure actually guards against on **that specific route**. "This service
fails closed" is not a security posture; it is a default that will be wrong on roughly half the routes it covers.
Write the posture down per route, with the reason, or the next person will "fix the inconsistency".

## 7. Config-driven identity beats seeded migrations — and empty config must not mean "delete everything"

Environment-specific identity data (here: Zitadel user ids) does **not** belong in a seed migration. A seed migration
is correct in exactly one environment and silently wrong in every other — it ships fake rows to dev, wrong rows to
staging, and cannot be corrected without another migration. The repo already had the right precedent in
`SUPERADMIN_USER_IDS`: identity comes from config, reconciled at boot.

The trap on the other side, which the review caught: **a reconcile-on-boot loop must treat empty config as
"unconfigured", not as "the desired set is empty".** Otherwise a dropped or mistyped env var cascades away the
reviewer rows — and with them the **encrypted PATs** — on the next container restart. The guard is one branch: if the
configured set is empty, reconcile nothing and log it.

---

## Cross-references

- **Plan (authoritative, implementation-ready):** `docs/plans/2026-07-26-011-feat-pr-party-ontokit-native-plan.md`
  — U1–U15, M1/M2, KD14–KD20, KTD11–KTD21.
- **Residual review findings (web-leading):** `docs/residual-review-findings/2026-07-28-pr-party-code-review.md`
- **Residual review findings (api-leading):** `ontokit-api/docs/residual-review-findings/2026-07-28-pr-party-code-review.md`
- **Prototype-round findings, superseded but instructive:**
  `~/Coding Projects/docs/residual-review-findings/2026-07-26-pr-party-dashboard-review.md`
