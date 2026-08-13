---
title: "Validate before you mutate — a deploy that refuses mid-flight leaves a state that reports success"
date: "2026-08-13"
category: conventions
module: DEV infrastructure (CPX41 ontokit-dev) / deploy tooling
problem_type: near_miss
component: tooling
symptoms:
  - "ontokit-deploy refused with 'AUTH_MODE must be set in /opt/ontokit/.env' on a box that had been deploying fine for days"
  - "the SSH wrapper reported exit code 0 because the command was piped to `tail`, masking the real status"
  - "after the refusal, `status` reported the NEW api/web SHAs as deployed"
  - "`docker ps` showed both containers still 'Up 3 days' — no image had been rebuilt"
related:
  - "CatholicOS/ontokit-api#211"
  - "docs/solutions/conventions/self-check-that-can-pass-via-another-credential-proves-nothing.md"
---

## What happened

Moving DEV from api `20cb6aa7` / web `cfa91623` to the `feat/pr-party` heads, `ontokit-deploy`
refused partway through with `AUTH_MODE must be set in /opt/ontokit/.env`.

Two separate defects stacked, and either alone would have been survivable.

### 1. The required key lived somewhere else all along

The `chore/deploy-workflow-hardening` change added `: "${AUTH_MODE:?…}"` against `.env`.
But the U7 auth flip had set `AUTH_MODE: optional` **in `compose.yaml`**, where it appears three
times (service environment plus build args). `.env` never held it, and never needed to —
`docker exec ontokit-api-1 printenv AUTH_MODE` returned `optional` the whole time.

So the script demanded a key from a file that never carried it, while the value it wanted sat
in the very file it was about to invoke. **A box configured exactly as its own runbook
prescribed could not deploy.**

### 2. The refusal happened *after* the mutation, and `status` then lied

`deploy_pair` does `git checkout --detach` on both repos **before** sourcing `.env` and asserting
the required keys. When the assertion fired:

- both repos already pointed at the **new** SHAs;
- no image was rebuilt, so the containers kept serving the **old** build;
- `status` reads `git rev-parse HEAD`, not the running images — so it reported the new SHAs as
  deployed.

The system was in a state where the git tree said "new", the containers said "old", and the
verification surface said "success". A monitor trusting `status` would have called it green.

## The rule

**Assert every precondition before the first mutating step.** A validation that runs after a
checkout, a copy, or a write converts a clean refusal into a half-applied state. Ordering is
the whole fix: same checks, moved above the first mutation, and the failure becomes a no-op.

**A status surface must report what is RUNNING, not what is INTENDED.** Reading git HEAD to
answer "what is deployed" measures the wrong object. Report the SHA baked into the running
image, or compare the two and flag the drift — otherwise the check passes precisely when it
should scream.

**Never let a pipe eat an exit code.** `ssh … 'cmd' | tail -40` reports `tail`'s status, not the
command's. This deploy returned 0 while failing. Use `set -o pipefail`, redirect to a file and
echo `$?`, or check `PIPESTATUS`.

## Family resemblance

This is the same shape as two earlier learnings: "a self-check that can pass via another
credential proves nothing," and "silence is not success." In all three, the verification
surface reported an outcome it had not actually established. When adding a check, ask what
else could make it pass — and whether it is measuring the artifact or merely its intention.

## Workaround applied

Appended `AUTH_MODE=optional` to `/opt/ontokit/.env` (matching compose and the live state
exactly; backup at `.env.bak-preauthmode-20260813`) and re-ran. Upstream fixes proposed in
CatholicOS/ontokit-api#211.
