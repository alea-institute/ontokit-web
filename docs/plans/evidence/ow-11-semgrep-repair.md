# ow-11: inherited Semgrep repair verified

Date: 2026-11-08

Plan: [Repair the ow-6 Semgrep backtracking finding](../2026-11-08-1525-fix-ow11-semgrep-backtracking-plan.md)

## Disposition

The reported PR #75 finding was **already fixed before this checkout**. This run
reproduced the original rule on the pre-fix source and verified its absence in the
current source. No new production edit or test change is warranted. The plan's
already-resolved path applies; the controller must accept that disposition and
complete its current policy/campaign gates.

[PR #75](https://github.com/alea-institute/ontokit-web/pull/75) was merged on
2026-10-31 as `4e0ed6a62fa95769813703097fa68c24dc8a878b`. Its original blocker was
`javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp`
in `e2e/browser/rehearsal.spec.ts:49`, not the Turtle merge helper suspected during
planning. The rule reports the denial-of-service risk of constructing a regular
expression from a function argument; this receipt does not claim a demonstrated
catastrophic-backtracking input.

[Repair commit e4fc61f](https://github.com/alea-institute/ontokit-web/commit/e4fc61fca2322976c5aef14a230b4229212c3824)
replaced the dynamic `RegExp` URL assertion with a literal substring predicate.
The file in that commit, integrated ow-6, and the current checkout has the same
Git blob: `49e025c775a3dfb8396c36e6fbb0dfaeb89d19d8`. The individual repair commit is
available locally but is not an ancestor of HEAD; its file content was included
in the integrated commit. The
[final PR #75 scan job](https://github.com/alea-institute/ontokit-web/actions/runs/41160132029/job/124415651242?pr=75)
publicly reports success on 2026-10-31. This is historical evidence, not a fresh
policy scan on this branch.

## Preserved source and scope

- Starting branch: `drawdown/ow-11`.
- Starting HEAD: `46a948295a3b2d4b24c4036a9c37dcb5ee2ccdac`, the committed repair plan.
- The working tree was clean; no Git remote was configured.
- Integrated ow-6 commit `4e0ed6a6` is an ancestor. Later changes remain intact.
- No production code, test, scan policy, ignore pattern or dependency manifest changed.
- The chief campaign excerpt is absent from this single-repository checkout.
  Reconcile it through the controller before publication. No remote, login or
  credentials were added or sought; GitHub evidence was read publicly.

## Detecting-rule proof

Semgrep Community Edition **1.184.0**, core revision **ec0383d093**, analyzed both
versions with the same downloaded rule, failure-on-findings enabled, no baseline
filter, and explicit source targets. The
[public rule](https://semgrep.dev/r/javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp)
was downloaded on 2026-11-08; its configuration SHA-256 is
`68c0a7972623b2d2050839dd9b0335246e7e6f9dcfd130cac74cd2f7666438d6`.
The original CI engine/rule version was not exposed by the public job page; this
is a fresh reproduction using the identified detecting rule.

| Source | Result |
| --- | --- |
| `15ead867f4691ca9bf041d550c9cddda063a172b:e2e/browser/rehearsal.spec.ts` | Original dynamic expression detected at line 49; exit 1; one finding; zero errors |
| `46a948295a3b2d4b24c4036a9c37dcb5ee2ccdac:e2e/browser/rehearsal.spec.ts` | Explicitly analyzed; exit 0; zero findings; zero errors |

The historical source was extracted from Git into a temporary file; it was not
reintroduced into the repository. [Sanitized scan proof](ow-11-semgrep-proof.json)
records source identities, rule identity and both results. Raw reports remain
outside the repository.

The default I/O backend failed before analysis with
`Unix_error: Permission denied io_uring_queue_init` (exit 2). Selecting the
available POSIX backend with `EIO_BACKEND=posix` allowed scanning without changing
sandbox permissions or rules. A reproduction command with Semgrep on PATH is:

```bash
EIO_BACKEND=posix semgrep scan --metrics=off --disable-version-check --error \
  --config r/javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp \
  e2e/browser/rehearsal.spec.ts
```

The broader source scan used the workflow's seven packs (`p/default`,
`p/owasp-top-ten`, `p/javascript`, `p/typescript`, `p/react`, `p/nextjs`, `p/jwt`).
It completed with exit 0: **256 applicable rules**, **394 analyzed files**, and
**zero findings**. Existing ignore patterns skipped 414 files. Three parsing
warnings remain: one for `scripts/ctt/pages.mjs`, and two for GitHub Actions
expressions in `.github/workflows/release.yml:115`. This is not an error-free
whole-repository scan. An earlier unmatched root TSX glob failed before scanning;
the corrected invocation used the existing source roots.

The planning candidate `scripts/ctt/turtle.mjs` was separately analyzed by 203
applicable rules with zero findings/errors. It remains unchanged; its prefix
scanner is outside the confirmed repair scope.

The current policy command `semgrep ci --no-suppress-errors --metrics=off
--disable-version-check` exited **13**, requesting login or an explicit
`semgrep scan` configuration. No current policy scan ran. Public-rule proof and
the historical successful job do not replace the controller's policy gate.

## Fresh regression verification

Dependencies installed from the existing lockfile with `npm ci`. Final checks
used **Node 24.22.2**, matching CI's Node 24 major. Hermetic harnesses used
`umask 077` as CI does.

| Check | Result |
| --- | --- |
| `npm run test:coverage -- --run --maxWorkers=2` | Pass: 383 files, 5,743 tests |
| `npm run test:ctt` | Pass: 68 tests |
| `npm run test:e2e:ownership` | Pass: 35 tests |
| `npm run test:e2e:profiles` | Pass: 61 tests |
| `npm run test:e2e:evidence` | Pass: 107 tests |
| `npm run test:e2e:identity` | Pass: 13 tests |
| `npm run test:e2e:hosted-unit` | Pass: 12 tests |
| `npm run lint` | Pass: 0 errors, 21 existing warnings |
| `npm run type-check` | Pass |
| `npm run build` | Pass: optional auth, localhost API/WebSocket URLs |

Coverage: statements **97.93%**, branches **95.01%**, functions **98.21%**, lines
**99.10%**. The coverage invocation supplies the full Vitest gate. All **296**
hermetic harness tests passed, with no skipped cases.

The first CTT attempt overlapped dependency installation and failed because the
Playwright CLI was not yet installed. The initial unbounded Vitest run overloaded
the sandbox and was interrupted after failures; overlapping CTT and ownership
runs also failed. Fresh harness runs after installation and bounded worker
concurrency passed. The complete coverage rerun changed only worker concurrency;
no test, timeout, coverage setting or assertion was weakened. Expected-error
output from negative release-script tests did not represent failing tests.

## Delivery and remaining gates

This is a documentation/evidence follow-up to an already merged repair. No
frontend file changed, so no fresh screenshot is required. The existing browser
assertion remains intact; no new hosted/browser acceptance is claimed. The
controller retains Docker/auth-image and live DEV acceptance. Historical ow-6
screenshots, hosted gaps and dependency-audit findings keep their existing status.

Before publication, the controller must:

1. Accept the plan's evidenced already-resolved disposition; do not claim a new
   regex repair or supersede an open PR #75, since it is already merged.
2. Reconcile the chief campaign's Goal Capsule and cited campaign sections.
3. Run the authenticated current policy scan and required runtime/campaign gates,
   including its Astra/Fable reviews.
4. Publish this local evidence follow-up only if campaign tracking requires a PR.

These are controller gates, not new Damien-only decisions. No push, PR creation,
merge, deployment or new external service occurred in this worker.

Local `ce-code-review` reviewed commit `78284cf0` against the starting plan commit:
no findings or required corrections. It checked the documentation against the
plan and repository instructions, verified the source-blob identities and links,
and preserved the open controller gates. The review ran in the current context;
no independent Astra/Fable review is claimed. Code simplification was inapplicable
to this documentation-only diff, and browser scope mapping found no changed route.
