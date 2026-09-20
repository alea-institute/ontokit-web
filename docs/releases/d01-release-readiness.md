# D01 repaired release readiness

Observed: 2026-09-20. This packet records local preparation under [D01](../plans/2026-09-20-0659-chore-repaired-release-baseline-plan.md). Progress belongs in the [master roadmap](../plans/2026-09-20-0649-requirements-delivery-roadmap.md).

## D03 follow-up

The original observations below are historical. [D03](d03-image-readiness.md) now resolves the configured-provider build/runtime blocker locally at `30b8ecb2`, with three image profiles and 5,222 tests passing. API prerequisites and authenticated DEV acceptance remain open. Publication status is tracked in the master roadmap.

## Verdict

**Local D01 preparation complete; not ready for authenticated DEV activation.** The committed integration candidate passes its regression, type and lint checks and the optional-auth production image build; verification results follow below. Configured-provider image fidelity and API trust/error-contract gaps require focused follow-up. Live host and promotion settings also need operator evidence.

No push, PR creation, merge to `dev`/`main`, manifest mutation, deployment approval, database reset, or live write occurred.

## Revision identity

| Role | Revision / location |
|---|---|
| Preserved web source | `5e619336d5a5257ca0102b558337823e40238aae` on `fix/coverage-defects-20260919` |
| Common ancestor | `4cbe4d4c17437660b70764acb364d24b20ef20ba` |
| Verified ALEA web dev | `5eb9888fb84b85c3bbef1dc0aa3bfc4d9bddd075` |
| Local candidate | `release/d01-repaired-dev-20260920`, checkout `.worktrees/d01-release-candidate`; commit `3d45af5b8f66a90079c0169d1bf1a8821c970d79` |
| Provisional ALEA API candidate | `24242ea04114ea5a757ca34462d92795a557f4a8` |
| Stale API checkout | `773c51aa0dd2959fd07c48627d86d66639cd13fb`; not changed |
| Current upstream API manifest | API `455f706c000d87d3d87d7939cfeab470fe78cd2b`; web `4cbe4d4c17437660b70764acb364d24b20ef20ba` |

Read-only GitHub branch and manifest queries confirmed both ALEA `dev` tips above. The source's historical regression receipt covers 362 files / 5,148 tests; it is not the candidate's receipt.

## Integration scope and verification

[The complete inventory](d01-path-inventory.md) accounts for 223 source paths: 51 production, 161 tests, eight documentation, and three excluded automatic status files. All 220 substantive paths are retained. Three-way application was conflict-free; no repair implementation was rewritten.

A separate read-only integration check found:

- Initially all 161 test paths matched the source byte for byte. Integration verification then required one fixture correction, described below; the other 160 remain byte-identical.
- Forty-six production paths match source exactly. The five overlapping pages retain both patches' added/removed-line sequences.
- All 11 nonoverlapping upstream paths match upstream exactly, preserving the retired-demo hook, parser, banner, notice, routes, and tests.
- No unexplained candidate additions or tracked unstaged changes; whitespace check passed.

The first full run passed 5,169 tests and failed 19 dashboard cases because the navigation mock lacked `useSearchParams`, now consumed by the upstream project hook. The fixture now returns actual `URLSearchParams(window.location.search)`, matching the upstream redirect fixture. No assertions were removed. Dashboard and redirect focused verification passed 30/30; a separate read-only check confirmed the correction.

This checks preservation, not full behavioral correctness. Existing repair regressions supply behavior evidence; no duplicate tests were added for mechanical integration.

| Check | Result |
|---|---|
| Full candidate Vitest run | Passed: 364 files / 5,188 tests, zero failures/skips, 219.85 seconds |
| Types | Passed: installed TypeScript, `--noEmit --incremental false` |
| Lint | Passed: `npm run lint`, zero errors / 19 existing warnings |
| Next production build | Passed inside the Docker image on Node 22. Local Node 24 attempt failed on dependency symlink; retry with copied dependencies was stopped after stalling during compilation and is not counted as a pass |
| Docker image | Credential-free optional-auth build passed on daemon 29.5.3; image `ontokit/d01-web:verification`, digest `sha256:f5dbd38bf0a4aa3bfd7c82a20e348e24459a1f580702f860a6280a630f331512`. Required-auth build failed as described below |
| Whitespace / integration preservation | Passed |
| Full API CI and live OIDC/browser/host checks | Not run; cannot be inferred from web results |

Verification uses no private `.env` files. Vitest uses a temporary copy of repository config with `envDir: false`, `CI=1`, two thread workers, and a JSON reporter. Local build used credential-free optional auth and synthetic public HTTPS/WSS endpoints. The successful Docker build used the existing CI arguments (`AUTH_MODE=optional`, no provider), so it proves the generic image rather than DEV endpoint configuration. Temporary configuration and dependency copies do not enter the release diff. The final optional-auth image was rebuilt successfully after removing the temporary Vitest config, against committed candidate `3d45af5b`. Disposable version-script tests intentionally exercise invalid-input failures; their stderr is retained.

The configured-provider reproduction supplied only synthetic public issuer/client ID and public HTTPS/WSS URLs with `AUTH_MODE=required`. The Docker build failed while collecting `/api/auth/[...nextauth]` page data: issuer, client ID, client secret and session secret were all undefined in build-time server validation. This is an observed build failure, not a live OIDC test. No provider/client/session secret was supplied or copied.

## B14 dispositions

API paths in this table refer to provisional revision `24242ea0…`, read with Git rather than from its stale working checkout. Findings are source evidence, not executed API or live incident reproductions.

| Seam | Disposition and evidence | Owner / return condition |
|---|---|---|
| Configured-provider image | **Release blocker.** DEV Compose passes issuer/client ID build arguments, but web Dockerfile does not declare them. `next.config.ts` bakes the provider flag and issuer into browser assets. Optional/no-provider CI cannot prove authenticated image fidelity. | Next focused web build/auth deliverable; return after image inputs and runtime auth agree, without secrets in layers |
| Individual mint capability | **Blocker for entity-wide trust enforcement.** API `ontokit/services/suggestion_service.py` declaration set and `_assert_branch_content_can_mint` cover classes/properties, omit `OWL.NamedIndividual` and ordinary individual typing. Web locking does not protect direct API writes. | Focused API prerequisite: establish individual identity semantics, reproduce bypass, repair and verify save/resume paths |
| Submit budget/unavailability | **Submit contract blocker.** `ontokit/services/suggestion_service.py` calls duplicate checking without the 402/503 mappings found in `ontokit/api/routes/duplicate_check.py`; embedding exceptions fall to generic 500 handling. Web preserves recoverable session content but does not repair the API contract. | Focused API prerequisite: reproduce submit/resubmit failures, map errors, prove retry/state integrity |
| Auth-disabled routing | **Deferred policy reconciliation; not parity accepted.** API public-project capability allows suggestions; web permission hook uses role/token, while editor separately permits anonymous public proposals. | Maintainer policy decision and D02 persona/mode acceptance |
| Namespace ownership | **Deferred policy reconciliation.** Generation validates project namespace in `ontokit/services/validation_service.py`; submit path has different validation. Historical VALID-04 conflict remains. | Maintainer decides project/external-namespace policy before claiming universal ownership enforcement |
| Review/self-merge | **Partial source agreement; deferred policy.** Web and API interactive PR merge use owner/admin; suggestion reviewer also permits editor. Advertised editor annotation self-merge in `ontokit/services/llm/role_gates.py` is not enforced by PR merge path. | Preserve current access; settle editor promise and test D02 roles |
| PROD required secrets | **PROD-only blocker, outside DEV preparation.** Root `compose.prod.yaml` is legacy infrastructure with fallback secret values. No `deploy/compose.prod.yaml` exists at candidate revision. This does not establish which stack is live. | PROD operator identifies chosen stack and proves fail-closed configuration before B09 |
| Installed deploy script | **Activation evidence blocker.** Source and runbook require installed script parity and runtime image-revision checks; checkout identity is insufficient. | DEV operator supplies script hash/ownership/mode and nonsecret runtime API/worker/web revisions |
| Operational credentials | **Authenticated activation evidence blocker.** DEV initialization PAT expiry dates are 2026-09-15; existing runtime token validity is unknown. | DEV operator supplies validity/rotation receipt without credentials |
| Automatic PROD promotion | **Activation evidence blocker.** Source gates on exact `PROD_ENABLED=true`. Repository variable listing has no such variable; organization variable query returned 403, so effective inheritance is unverified. | Authorized operator confirms effective flag/production environment containment before manifest merge |

## Publication authority update

On 2026-09-20 Damien authorized pushes, merges, deployments and Claude repository-content disclosure for future sessions. `AGENTS.md` now governs. Earlier no-publication actions and the rejected external review remain historical facts, not current permission blockers. Technical release prerequisites remain in force.

## Later publication and activation proposal

1. Finish the focused image/auth prerequisite and any API release-blocking repairs, then refresh the proposed pair and rerun affected gates.
2. Publish the exact local candidate branch/diff under the standing authorization in `AGENTS.md`, with the required review and checks. Target ALEA web `dev`; CatholicOS upstream delivery remains B08.
3. After authorized publication/integration, verify the actual immutable web revision. If upstream squash/rebase changes its SHA, use the published revision and rerun affected checks. Verify the API counterpart is published and compatible.
4. Prepare a separate API manifest change using those full fetchable SHAs. Before merge, obtain effective promotion-gate, installed-script, credential-readiness and rollback receipts. The manifest path triggers deployment; it is not a documentation-only change.
5. Resolve the stale waiting run deliberately. [Run 34155698435](https://github.com/alea-institute/ontokit-api/actions/runs/34155698435) was still `waiting` on 2026-09-20, at workflow head `6464f74c68fa942c96e5aa411b250254102c11e4`. Do not approve it as delivery of the new candidate. An authorized operator must retire/replace it to prevent accidental old-pair deployment.
6. Merge the new manifest only with the required authority, inspect the newly created protected DEV run and its pinned pair, then obtain the designated reviewer's approval for that run.
7. D02 records running image digests/revisions, migration head, health, seeded project, authenticated write smoke, browser acceptance and rollback readiness. The existing script does not auto-rollback after failed health checks; an operator owns the explicit rollback action.

Rollback requires a verified known-good API/web pair, previous-pair record, recoverable database backup and migration compatibility. The old pre-reset `.deploy-previous` record alone is not a rollback proof. No reset, rewrap or token rotation is implied by this packet.

## Continuation

Next prerequisite D03: configured-provider image fidelity, linked to B14. D04 tracks individual mint enforcement; D05 tracks submit/resubmit error mapping. D02 remains runtime/persona acceptance after those prerequisites. API mint-gate and submit-error prerequisites follow before an authenticated release claim. B01/B02/B14 remain open. All remaining area IDs stay in the master roadmap; independent B10 test-foundation work remains available when only external activation is blocked.

Plan review: six in-session reviewers returned no findings. [Review receipt](d01-plan-review.json). The supplemental Anthropic review was not launched: automatic approval review rejected the disclosure. No external reviewer result is claimed.

## Evidence retention

The local candidate commit and this packet are durable evidence. Full temporary logs and JSON results are in `/tmp/d01-verification/` and may be removed by ordinary cleanup. Their relevant outcomes and reproduction configuration are retained here; neither the roadmap nor continuation depends on those temporary files. The candidate checkout may be recreated from its local branch.

The documentation commit is also carried onto the candidate branch so its `AGENTS.md` roadmap pointer resolves to the current next action. `3d45af5b` remains the verified code baseline; the later commit changes documentation only.
