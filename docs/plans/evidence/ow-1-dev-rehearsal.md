# ow-1 DEV rehearsal outcome — 2026-10-26

**Hosted acceptance remains open.** This worker implemented and tested the hosted runner
safeguards in [the ow-1 plan](../2026-10-26-0932-fix-ow-1-dev-rehearsal-plan.md).
It did not execute against DEV, import hosted projects, sign in to real accounts, or
produce a genuine hosted receipt. Synthetic runner tests do not establish DEV acceptance.

## Starting state and delivered changes

The build began on clean `drawdown/ow-1` at plan commit `1cc6c5e4`, following integrated
rehearsal/handoff changes at `43783d39`. No remote is configured. The named historical
rehearsal branches and chief campaign repository are absent from this clone; the
controller retains campaign-authority/current-base reconciliation and publication.

Local implementation commits: `d0dabc8d` (hosted retention and ownership) and
`f5810d63` (runtime-bound acceptance and real subprocess regression). Publication,
merge and deployment were not attempted in this remote-free worker clone.

- U1: Hosted imports journal the full run marker before the request and each returned
  project ID before membership/index work. Lost responses remain uncertain. Hosted
  teardown never sends project DELETE requests. The ordinary isolated cleanup path and
  its credential-removal assertions remain enforced.
- U1: Hosted private artifacts are retained under the ignored, owned and protected
  `.e2e-runs/retained/` tree. Final-artifact backup verification is the only optional
  private-removal path; missing, stale, mismatched, failed or changed proof retains data.
  The journal and preliminary outcome remain outside the removable private subtree.
- U2: Version-2 receipts distinguish runner checkout from before/after DEV service
  observations. Acceptance requires all four mandatory cases once each, pinned source
  evidence, selected web/API/worker revisions and resolved disposition. Failed or
  interrupted runs cannot claim acceptance. Browser output stays private, and public
  evidence contains only bounded fields and fixed failure categories.
- U4: [The controller protocol](../../../e2e/README.md#baif-rehearsal-profile-folio-catholic-os-and-ctt)
  documents file-based and callback-based deployment observations, retention, backup
  verification, failed receipts and the remaining genuine DEV run.

A real Playwright subprocess regression also caught a fixture-loading defect introduced
by the shared helper: Playwright's CommonJS transform could not parse the transitive
`import.meta` path calculation. A small `scripts/e2e/paths.js` bridge now provides the same
runtime root to both Node ESM and transformed fixtures. The regression fails before that
repair and passes after it. It uses an intentionally absent synthetic browser cache, so
no browser launches or host is contacted; it proves actual config/spec loading and private
capture of the launch diagnostic, not the four browser journeys.

No application component, browser journey assertion, ontology pin, CTT namespace or CTT
quotation behavior changed. No migration, data rewrite, release, service, deployment or
billing change was introduced. No frontend page changed, so a changed-page screenshot
is not applicable.

## Verification

All fixtures used for local runner checks were synthetic. Existing test cleanup ran with
a sandbox-only wrapper that copied and content-verified fixtures before deletion; those
backups remain outside Git. Unreadable cleanup fixtures were retained in place when
backup verification was unavailable. Removal-specific tests also verified their own synthetic
backups. Runtime and source test doubles are not deployment observations.

| Check | Result |
|---|---|
| Baseline `npm run test:ctt` | 23 passed before implementation |
| Baseline `npm run test:e2e:evidence` | 107 passed before implementation |
| New disposition proof before implementation | Failed because the disposition module did not yet exist |
| New hosted acceptance proof before implementation | 32 tests failed against the prior hosted runner |
| `npm run test:ctt` after implementation | 68 passed, including retained/removal paths, import uncertainty, runtime mismatch, strict inventory, interruption and redaction |
| `npm run test:e2e:evidence` | 107 passed; local receipts still explicitly refuse hosted acceptance |
| `npm run test:e2e:profiles` | 60 passed under the temporary Node 24 runtime |
| `npm run test:e2e:ownership` | 35 passed, including shared ownership, process cleanup and diagnostic retention |
| Real Playwright child-process diagnostic check | Passed; synthetic launch-error sentinel stays in the private mode-0600 log |
| `npm run type-check` | Passed |
| `npm run lint` | Zero errors; 21 existing warnings |
| Initial full Vitest run | 5,520 passed; two UI integration tests failed |
| Both failing files with `--maxWorkers=2` | All 22 tests passed; no application or test changes |
| Full Vitest with `--maxWorkers=2` | 371 files / 5,522 tests passed |
| Isolated rehearsal and suggestions profiles | Not executed: Docker socket access denied; paired API checkout absent |
| DEV rehearsal | Not executed: credentialed work is reserved for the authorized controller runner |

The sandbox's Node 22 binary lacks compiled TypeScript support; six shared-profile tests
could not load TypeScript under it. A temporary Node 24.15.0 toolchain resolved those
failures without changing project dependencies or weakening assertions. The initial
full-suite concurrency failures and the bounded rerun are recorded separately above.

## Review and remaining limits

A seven-reviewer local code review found no actionable defects in the initial code read.
The subsequent real subprocess regression found the module-loading defect described above;
focused follow-up independently verified its repair, final runtime-root equivalence and
private child-log behavior. No actionable code findings remain. The full review did not
replace the controller's DEV acceptance gate. Separate-provider review was disabled by
checkout configuration; the local adversarial review ran.

The simplification pass changed artifact hashing to bounded chunks and removed redundant
comments. A new independent test strengthens the uncertain-import retry guard without
removing or weakening the original assertions. Actual Chromium signal forwarding and the
CLI's delayed evidence-file handoff are not exercised end to end here; interruption and
runtime validation are covered through runner injection seams. The controller must observe
these boundaries during the real run. The existing code, tests and plan carry the reasoning,
so no separate learning document was added.

## Required controller continuation

1. Reconcile the chief campaign Goal Capsule and cited R-IDs, current `dev`, and the paired
   API lane. Review, scan and publish the local branch through the campaign gate.
2. Verify three distinct ordinary DEV personas and the current web/API/worker runtime.
   The older persona/Mailpit and MinIO findings are historical; recheck before acting.
3. Prepare the pinned source cache and a fresh run identity. Collect the independent
   deployment-status evidence using the documented controller protocol. Keep target
   credentials and raw status data outside worker access and repository artifacts.
4. Run the exact four-case hosted rehearsal on the intended runtime pair. Retain both
   public project copies and private artifacts. Reconcile every uncertain import by its
   full marker before another attempt; deletion still requires verified backup.
5. Commit the sanitized real receipt as
   `docs/plans/evidence/ow-1-dev-rehearsal-<run-id>.json`, update this note and D11 with the
   actual four outcomes and runtime identities, and repeat after any runtime-affecting
   repair. If a web repair is required, add its regression test and inspected Playwright
   screenshot under `docs/plans/evidence/`.

U3 and the accepted-receipt portion of U4 remain incomplete. These are controller-owned
execution prerequisites, not new decisions or requests for Damien's time. B02/B03/B08/B09/B11
retain their wider acceptance remainders; ow-2 and later mandate items were not started.
