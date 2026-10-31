# OW-2 hosted persona UAT — implementation and execution receipt

**Status: harness implemented; hosted DEV acceptance remains incomplete.**
This receipt covers only `ow-2` and the [implementation plan](../2026-10-26-1030-test-ow-2-hosted-persona-uat-plan.md).
No serving deployment, ordinary persona, authentication mode, paid-provider configuration or hosted journey was verified in this sandbox.

## Starting state and authority

- Build started on clean `drawdown/ow-2` at `40cb226a`, the committed plan, over source `43783d39`.
- No Git remote is configured. Publication and DEV execution belong to the controller; no remote or credentials were sought.
- The chief campaign file and named historical branch refs are absent. The supplied campaign rules govern this work; the controller still owns reconciling its Goal Capsule and R11/R15–R20 excerpts. Existing D10 and October 20 handoff artifacts are present and were read.
- No product UI, API contract, CTT content, deployment settings, schema, packages or services changed. No frontend screenshot applies: only test harness and documentation changed.

## Delivered behavior

`npm run test:e2e:hosted-suggestions` launches a dedicated Playwright configuration. It preserves the original seven D10 cases and refusal probes, adding seven hosted cases: four persona sign-in/protected-read/federated-logout/relogin cases, public/private visibility through sign-in, anonymous proposal-to-triage, and a separately reported elapsed-expiry observation.

Preflight requires four distinct controller-attested ordinary identities, a fresh serving web/API/worker revision record bound to target origins, optional mode with an active provider on both sides, and non-billing import/index/save/submit proof. API and worker revisions must agree. Health and provider probes use HTTPS without redirects. No fixture write occurs without these prerequisites.

Each hosted project has a run marker. The private append-only ledger is synced before import and immediately after the returned ID, before later setup. Failed, interrupted and successful runs retain projects and private authentication state. A lost response leaves its import intent for controller reconciliation. A hard kill cannot guarantee a receipt, but the ledger survives; the absence of a receipt is never success. Cleanup is a separate operation after verified backup of the affected projects and related data.

The ledger also records observed suggestion session IDs/branches, PR numbers and added membership IDs at the existing response boundaries. Revision history and any resource created before a response was lost remain recoverable through the retained project and its run marker; this is not a full database change journal.

Public receipts contain fixed case names and outcomes, validated refusal probes, runtime revisions, runner revision, mode and retention status. Raw child logs, assertion text, target input and browser authentication state remain private. Missing reports leave cases `not-run`; they do not imply zero failures. Skips, retries, duplicates, wrong profiles or missing evidence cannot accept a run.

`acceptance.chainAccepted` requires the complete hosted case inventory and a matching post-run deployment readback. `acceptance.hostedAcceptance` remains false because genuine hosted application-cookie expiry is not implemented or claimed. Real access renewal and refresh recovery run only when the recorded observation window permits them; otherwise they explicitly remain `not-observed`. Isolated clock-controlled proof is unchanged.

## Verification

| Check | Observed result |
|---|---|
| Last full Vitest run before the final review repair | 374 files, 5,533 tests passed |
| Final focused hosted fixture/config tests | 4 files, 12 tests passed, including paginated visibility, incomplete-page refusal and retention before a failed save assertion |
| Hosted runner synthetic tests | 12 passed, including failed/interrupted retention, redaction, exact inventory, missing/matched readback, real Playwright discovery, symlink and file-mode refusal |
| Playwright discovery / browser availability | Exactly 14 tests in two files discovered; headless Chromium launch passed; no real hosted case executed |
| Existing evidence inventory suite | 107 passed |
| Existing profile suites under Node 24.15 | 60 passed |
| Existing identity suite | 13 passed |
| Existing ownership/diagnostics suites | 35 passed |
| TypeScript | Passed |
| ESLint | 0 errors, 21 existing warnings |
| Hosted command without credential input | Expected exit 1; `preflight-incomplete`, all 14 cases `not-run` |

Proof-first tests initially failed because the new hosted contract/fixture modules did not exist, then passed after implementation. No existing tests were removed or weakened.

Real Playwright discovery reproduced an additional harness loader failure: importing the launcher from fixtures brought `import.meta` into Playwright's CommonJS transform. A dedicated ledger module and the existing ontology-path helper repaired it. The discovery regression failed before the repair and passed afterward. Fixture tests retained all assertions and updated only the mocked module path for the moved ledger.

The follow-up review found that the caller could lose an observed session ID when `saveExistingLabel` failed its status, change-count or Saved-UI assertion before returning. A narrow observer now syncs the session ID before those assertions. The regression exercised a real failed status assertion and a real ledger file: it failed with the missing ledger before the repair, then passed afterward. All original save assertions remain intact.

The default system Node 22.22.1 was compiled without TypeScript support; existing profile tests failed to import TypeScript even with its experimental flag. They passed under the locally installed Node 24.15 toolchain. This was an execution environment difference, not a product fix. The dependency installation audit reported existing vulnerabilities; dependency changes remain `ow-6` scope.

The [actual incomplete receipt](2026-10-26-ow-2-preflight-incomplete.json) came from the CLI invocation without target input. Other runner invocations used synthetic targets and reports; their private test receipts establish validator behavior only and must not be published as DEV evidence.

### Review

The full `ce-code-review` examined snapshot `08416805` with correctness, project standards, testing, maintainability, security, reliability and adversarial lenses. A follow-up review covered the additional resource records and boundary tests. Its P2 finding about lost session IDs on failed save assertions was repaired in `bca4b6f9`.

The final correctness/adversarial addendum reviewed `bca4b6f9`, independently ran the retention regression, and reported no outstanding actionable findings. Reviewers ran on Astra. The checkout disables cross-model review, so the adversarial pass used a local reviewer. The remaining live-execution and expiry-policy limits below remain open; review approval does not close them.

Simplification reused the existing seven-case inventory count and removed one redundant comment. No tests were removed or weakened. The loader diagnosis and retention reasoning are preserved here and in regression tests; no separate learning artifact is needed.

### Browser gate

The repository's existing Playwright stack is the campaign-specified driver. No product route changed. Discovery and Chromium launch passed; the actual workflow routes remain unexercised because the required hosted target and controller attestations are absent. Starting an unrelated local frontend would not establish DEV acceptance.

| Workflow route | Result | Reason |
|---|---|---|
| `/auth/signin` and provider logout | Skip | No authorized four-persona target input |
| `/settings` | Skip | Real credential renewal/recovery requires the hosted identities and observed policy |
| `/` and `/projects/{id}` | Skip | Run-owned fixtures cannot be created before runtime/mode/no-billing preflight |
| `/projects/{id}/editor` | Skip | Same preflight; no ontology write attempted |
| `/projects/{id}/suggestions` and `/projects/{id}/suggestions/review` | Skip | Same preflight; no real submission or review attempted |

## Controller execution contract

1. Reconcile the chief campaign excerpts. Supply four verified, ordinary DEV accounts using existing authorized access; the sandbox worker does not read their credentials. Apply the existing September 30 Mailpit authorization in the API lane if still needed, without reopening the settled access decision.
2. Verify current serving revisions and auth-mode agreement, and prove that import, indexing, save and submit for these fixtures cannot bill. Record that evidence before selecting the optional-configured inventory. A different mode stays incomplete; do not change shared DEV policy for this test.
3. Prepare a protected target JSON outside Git, owned by the invoking controller, mode `0600`. Its shape is shown below; all values are placeholders, never source credentials. The runtime timestamp must be no more than 30 minutes old. Each ordinary-persona assertion must derive from an access-policy audit, not merely four different IDs.
4. Run from this branch in an existing browser-capable environment. `OW2_TARGET_FILE` and `OW2_AFTER_FILE` name controller-owned files, with the latter initially absent or containing an older readback:

   ```sh
   npm run test:e2e:hosted-suggestions -- --target "$OW2_TARGET_FILE" --after "$OW2_AFTER_FILE"
   ```

5. The private run directory contains `browser-finished.json` once all browser cases pass. The controller has 60 seconds from that marker to write a fresh post-run runtime readback to `OW2_AFTER_FILE`, using the `runtime` shape below. Its timestamp must be at or after `browserFinishedAt`, and origins/revisions/mode must still match. A deployment change or missing readback prevents acceptance. Do not manufacture the timestamp from the pre-run record.
6. Inspect the sanitized receipt under `.e2e-runs/receipts/`, preserve it under `docs/plans/evidence/`, and inspect every screenshot visually before publication if a subsequent product fix requires one. Keep private files outside commits. Retain fixtures until a verified backup covers cleanup.

```json
{
  "web": "https://web.example.test",
  "api": "https://api.example.test",
  "issuer": "https://identity.example.test",
  "login": "https://login.example.test",
  "users": {
    "owner": {"id": "owner-subject", "email": "owner@example.test", "password": "<supplied privately>"},
    "suggester": {"id": "suggester-subject", "email": "suggester@example.test", "password": "<supplied privately>"},
    "editor": {"id": "editor-subject", "email": "editor@example.test", "password": "<supplied privately>"},
    "unrelated": {"id": "unrelated-subject", "email": "unrelated@example.test", "password": "<supplied privately>"}
  },
  "hosted": {
    "version": 1,
    "retain": true,
    "observationWindowSeconds": 600,
    "refreshIdleSeconds": 86400,
    "refreshAbsoluteSeconds": 172800,
    "ordinaryPersonas": {
      "owner": {"subject": "owner-subject", "nonAdministrative": true},
      "suggester": {"subject": "suggester-subject", "nonAdministrative": true},
      "editor": {"subject": "editor-subject", "nonAdministrative": true},
      "unrelated": {"subject": "unrelated-subject", "nonAdministrative": true}
    },
    "noBilling": {"import": true, "index": true, "save": true, "submit": true},
    "runtime": {
      "observedAt": "<actual UTC timestamp, milliseconds, Z>",
      "webOrigin": "https://web.example.test",
      "apiOrigin": "https://api.example.test",
      "web": "<40-character serving web commit>",
      "api": "<40-character serving API commit>",
      "worker": "<same serving API commit>",
      "authModes": {
        "web": {"mode": "optional", "providerConfigured": true},
        "api": {"mode": "optional", "providerConfigured": true}
      }
    }
  }
}
```

The controller must replace lifetime examples with actual policy observations. No TTL shortening, clock shifting, cookie forging, mode change or account privilege escalation is authorized by this runner.

## Remaining acceptance gates

- Controller: current DEV deployment/mode/non-billing proof and four verified personas, then all 14 browser cases on the matching pair. No user decision is presently identified.
- Browser-capable runner: unchanged isolated baseline, lifecycle, mode and suggestion matrices, observing backup requirements for their existing destructive cleanup.
- D08: individually observed real renewal, refresh recovery and cookie expiry; any unobserved obligation keeps full chain acceptance partial.
- Controller: exercise sequential D10 cases across real access expiry with DEV's actual refresh policy. Stored browser authentication state and API bearers need that live validation; no refresh-rotation failure was demonstrated here.
- Web/API lanes: reproduce and repair any real hosted failures, then rerun the final compatible pair. No product defect was inferred from missing access.

Broader B02/B03/B11 obligations, D11 rehearsal, B12 sockets and other mandate items remain separate. Local commits are ready for controller scanning and publication to `dev`; nothing was pushed or deployed by this worker.

| Plan unit | Delivery state |
|---|---|
| U1 | Implemented and synthetically verified |
| U2 | Hosted observations implemented; real execution and expiry evidence open |
| U3 | Original seven journeys adapted and retention tested; real matched-pair matrix open |
| U4 | Reproduced harness defects repaired and local evidence recorded; DEV acceptance open |

No unresolved requirement needs a new Damien decision at this stage. The existing controller/API authorization and execution handoff cover the missing prerequisites. This is a local implementation delivery, not a completed `ow-2` acceptance claim.
