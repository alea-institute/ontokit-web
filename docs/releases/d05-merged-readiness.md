# D05 merged submission recovery

[API PR49](https://github.com/alea-institute/ontokit-api/pull/49) merged into ALEA `dev` at 2026-09-20T18:16:31Z, merge `c95991c720e49d1a36abc16803cbb5a1f052e2fe`. Published head: `8497e440c1dd0bffb389fa1281fa30b6ff8c8017`.

Submission now maps budget refusal to 402 and pricing unavailability to a fixed safe 503. Saved drafts and paid-call audit records survive; fresh-request retries succeed. No automatic retry/refund or new resubmit validation was added.

Verification: 3,260 local tests passed, zero skipped, 90% coverage; Ruff, mypy and pyright clean. Eight real HTTP/PostgreSQL/Redis/Git scenarios prove durable refusal/retry/accounting behavior. Eight local code-review lenses found no actionable defects; Claude exhausted its turn limit and a native adversarial fallback completed. No independent cross-model code-review approval is claimed.

Published CI: lint, test, build, docker_preflight, pyright and Semgrep succeeded; six conditional publication/scanning/Dependabot jobs skipped. CE babysitter returned success with no fixes or residuals, current-base merge identity verified and no review feedback. The separate merge used the reviewed head precondition and normal repository protections.

[Plan and all durable verification receipts](https://github.com/alea-institute/ontokit-api/blob/8497e440c1dd0bffb389fa1281fa30b6ff8c8017/docs/releases/d05-submission-recovery-readiness.md).

No deployment occurred in D05. D02 owns matched DEV recovery/activation and authenticated browser acceptance. B14 taxonomy and frontend parsed-error messaging remain separately tracked.
