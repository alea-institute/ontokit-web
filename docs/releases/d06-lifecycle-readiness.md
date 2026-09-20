# D06 lifecycle verification

Status: **U1–U3 verified; U4 branch/PR/search/lint implementation is active.** No full-stack acceptance, publication or deployment is claimed.

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

U2 real identity and browser setup is committed as `19c40e86`, following production session fix `6f1d9687`. API repair review/publication and U4–U6 remain required. B10, B11–B13 and hosted DEV acceptance remain unfinished.

## U2 live verification findings

Fresh identity bootstrap and the production web build now run. Browser validation exposed a production identity mismatch: the installed Auth.js OAuth callback replaces the provider profile ID with a generated application ID, while OntoKit UI membership/reviewer comparisons use Zitadel subjects. The initial JWT callback must preserve the trusted provider account ID. The strengthened session regression reproduced the mismatch before a scoped `auth.ts` fix; all 5,222 frontend tests, repository lint and type checking pass. A subsequent real callback passed the strict Zitadel subject assertion. The production fix is committed as web `6f1d9687`. Disposable client profile/email claims now match the existing setup script. Fresh run `b0de0c9e0180654e206ee73c341ca356` passed all four browser tests: two genuine ordinary-user callbacks, protected API reads for each, and anonymous 401 rejection. Wrong issuer, invalid bootstrap PAT and wrong callback probes all rejected setup as intended and cleaned up. Detailed sanitized U2 evidence is committed in the implementation checkout at `docs/releases/d06-u2-verification.json`. Existing sessions created before the identity fix require a new sign-in to receive the corrected subject. All failed probes cleaned their owned resources and preserved existing Docker identities.

## U3 persistence verification

Fresh run `e2a9b56af512d7a2bae80b5f12143ee6` passed all 15 tests with zero skips/failures: the authentication foundation plus 11 real HTTP persistence and rejection tests. These cover project CRUD, imported Git source/main branch, class hierarchy and typed property labels, source revision persistence, 401/403/422 rejected-write state preservation, and 404/422 absence of partial projects. Cleanup removed all owned resources and preserved every neighboring resource identity. Type checking, targeted ESLint and whitespace checks pass. Tests and sanitized source fingerprints are committed as `f09738e5`, with `docs/releases/d06-u3-verification.json` in the implementation checkout. No production changes were needed for U3.

The U1–U3 simplification review completed all three lenses. Commit `13b10944` reuses the private environment writer with identical serialization and permissions; no auth/ownership guards were removed. Focused ownership/diagnostics and eight identity tests, full lint and type checking passed. U4 is assigned to a fresh worker from this committed baseline.
