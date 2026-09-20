# D06 lifecycle verification

Status: **U1 verified and committed as web `a5800e49`; U2 fresh identity implementation is active.** No full-stack acceptance, publication or deployment is claimed.

The [reviewed D06 plan](../plans/2026-09-20-1357-feat-isolated-full-stack-tests-plan.md) is checkpointed as `db916292`. Web implementation is in `.worktrees/web-d06-full-stack`, branch `feat/d06-full-stack-tests-20260920`. The API repair is isolated in `.worktrees/api-d06-image`, branch `fix/d06-runtime-package-permissions-20260920`, based on merged `c95991c7`.

## Observed evidence — 2026-09-20

- Twelve focused ownership/process tests pass; harness ESLint, syntax and whitespace checks pass. Tests include detached descendants, stale process identity, unsafe recovery paths, pre-recording parent death, and private diagnostic expiry.
- A missing API checkout fails nonzero with an actionable prerequisite error.
- Real Docker probes built the API and provisioned PostgreSQL/pgvector, Redis and MinIO. Migration then failed with `ModuleNotFoundError: No module named 'ontokit.core'`.
- Failed-run cleanup removed run-owned containers, networks, volumes and image tags. All 18 pre-existing container identities, 25 volume names and 11 network identities remained present. This verifies resource isolation for those failures, not successful migration or authenticated readiness.

## Confirmed defect

Inside the built API image, `/home/ontokit/app/ontokit` is root-owned with mode `0644`. UID1000 cannot traverse it; Python falls back to the partial package installed before the full source copy. Root can read the source package, confirming it exists.

A tiny Docker reproduction with ordinary `0755` source directories demonstrated that `COPY --chmod=0644 src/version.py ./ontokit/version.py` creates the destination parent without execute permission. The subsequent contents copy with `--chown` leaves that existing parent unchanged. A non-root access check returned exit1. Pre-creating the directory with mode `0755` made the same check return exit0.

The repair is committed locally as API `4d17d949` (not yet reviewed or published). A fresh isolated image successfully applied migrations and verified the complete database head set. Its network-disabled runtime smoke passed as UID 1000, importing `ontokit`, configuration, API and worker and reading all 50 migration revisions. Both focused Dockerfile contract tests passed (the narrow invocation excluded global conftest/coverage because the new checkout lacks those dependencies). Existing Docker CI builds `Dockerfile.prod`; it did not exercise this default Dockerfile's non-root runtime. The temporary reproduction images and retained private diagnostic logs were removed after diagnosis.

## Remaining gates

Normal completion, setup failure, late workflow failure, SIGINT, SIGTERM, and SIGKILL recovery all passed real Docker probes. Every probe removed all owned resources and preserved all pre-existing identities. Hard recovery also succeeded after removing only the run-private temporary directory. The hold-mode premature exit was fixed after two failing signal regressions; both now pass. Sanitized detailed evidence is committed in the implementation checkout at `docs/releases/d06-u1-verification.json`.

U2 real identity and browser setup is active. API repair review/publication and U2–U6 remain required. B10, B11–B13 and hosted DEV acceptance remain unfinished.
