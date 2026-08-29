---
title: Same-family review validates the rule where it was applied; a second model asks where it wasn't
date: 2026-07-28
lane: ontokit (PR Party)
module: review-process
problem_type: process_pattern
tags: [code-review, cross-model, adversarial-review, codex, invariants, prompt-injection, idempotency, concurrency, verification]
status: solved
related:
  - docs/audits/2026-08-20-recent-plan-completion-audit.md
  - docs/roundup-2026-08/UPSTREAM-DELIVERY-MAP.md
---

# What the second model saw

**2026-07-28 · ontokit-web + ontokit-api · PR Party, reviewed twice**

## Context

PR Party's two-repo diff was reviewed by eight Opus personas — correctness, security, adversarial, testing,
reliability, data-migration, maintainability, project-standards. They found real defects, and those were fixed.
The round closed with an explicit caveat written into the findings doc: *no independent model has looked at this*,
because the `codex` CLI on the box was unauthenticated.

It was authenticated later the same day. One `codex adversarial-review` per repo, scoped to the branch diff,
returned `needs-attention` on both and produced **four findings the eight personas had missed** — two high, and
one of them in the feature's single highest-consequence class (posting a GitHub review nobody asked for).

That ratio is the point. Not "a second opinion is nice" — a specific, repeatable blind spot.

## 1. Three of the four were invariant-scope bugs

The pattern in each case: **a rule the build genuinely implemented, applied to a strict subset of the places it
needed to hold.**

- The web guard `isTrustedGitHubLink` existed, was well-written, and was applied to LLM brief links and Q&A
  URLs — while the degraded-mode `deep_link` went straight to `window.open` and PR-derived `pr_url` / `diff_url`
  rendered as raw hrefs.
- The brief-generation delimiter scheme existed and stripped its tokens — in exactly one letter case.
- The concurrency guard existed as a partial unique index and correctly stopped two first-time INSERTs — while
  two requests claiming the same *existing* row could both flip it to pending and both post a real review,
  because the index cannot arbitrate two transactions UPDATEing one row.

Every one of those is a "yes, that's handled" during review. The plan says the invariant holds; the code shows
the invariant being enforced; the tests assert it at the site being read. **A reviewer sharing the author's
priors reads the same plan language, finds the mechanism, confirms it works, and moves on.** The question that
finds these is not *does the guard work?* but *enumerate every site this class of data reaches, then subtract the
ones the guard covers* — and that question is unnatural to ask about code whose framing you already accept.

The practical form: for any invariant a plan states, review it as a **coverage set, not a mechanism**. Write down
the sinks, then check them off. If you cannot produce the list, you have not reviewed the invariant.

## 2. The fourth was an inverted design rationale, defended by its own comment

The idempotency key was *derived* from the action's intent, with a long, persuasive docstring explaining why:
a remembered key would be lost on reload, exactly when a user retries. That reasoning is correct as far as it
goes, and every reviewer who read it agreed with it.

What it missed is that the same property makes an approval **unresubmittable forever** — dismiss an approval,
resubmit it identically at the same head SHA, and the server replays the old receipt and posts nothing. The
docstring had pre-answered the question, so nobody asked the next one.

**A confident rationale comment is a review hazard, not a review aid.** It tells you which failure mode the
author considered, which is precisely the set you do not need to re-check. Read them as a map of what was
*not* considered.

## 3. Worker gate claims are hints; the orchestrator's own run is the evidence

The Codex worker that applied the API fixes reported `make test` "indefinitely stalled" on a pre-existing
`TestClient` health request, with a plausible diagnosis (Starlette/HTTPX incompatibility, faulthandler trace,
version numbers). Re-run outside its sandbox: **2547 passed in 29 seconds.**

Nothing was wrong with the code and nothing was wrong with the worker's honesty — its environment differed. But
a well-argued environmental artifact is indistinguishable from a real regression in a summary, and this one came
with more supporting detail than most true findings do. The gate result that counts is the one the orchestrator
ran itself.

Same rule, other direction: three of the four cross-model findings were forwarded to fix workers with
"VERIFY this finding against the actual code first — if it does not hold, say so." All four held. Asking is
cheap; a fix applied to a finding that was never real is worse than no fix.

## 4. Where this is worth the cost

The adversarial pass was two commands and a few minutes. It is worth running whenever:

- the change can take a **real, externally visible action** (post, merge, send, charge, delete) — the blast
  radius pays for the review many times over;
- the change **implements an invariant** that is stated in prose somewhere (containment, idempotency, isolation,
  authorization) — that is exactly the invariant-scope target;
- the plan and the review were produced under **the same priors**, which for us is the normal case, since the
  personas read the plan the planner wrote.

It is not worth it for mechanical diffs, and it does not replace in-family review — the eight personas found
things Codex did not. The two rounds are complementary: same-family review is better at *depth against the
intended design*, cross-model review is better at *what the intended design forgot*.
