# D03 configured-provider image readiness — 2026-09-20

D03 implementation and local verification are complete. Independent review found one build/runtime authentication mismatch; the correction passed an independent source review and the expanded real-image checks. Publication remains pending. API trust/error prerequisites and D02 deployment/OIDC acceptance remain open.

Source verified: `30b8ecb2c128f82ff067b6f3e444edc5f7f04ed3`, branch `release/d01-repaired-dev-20260920`. [Plan](../plans/2026-09-20-0731-fix-configured-provider-image-plan.md), [plan review](d03-plan-review.json), [execution receipt](d03-execution-receipt.json).

## Results

- Full suite: **365 files / 5,222 tests passed**, zero failures/skips, 213.9 seconds. Configuration disabled automatic environment-file loading.
- TypeScript passes; ESLint reports zero errors and the 19 existing warnings.
- All three Docker production builds pass without provider/session secrets. Public configured inputs: issuer `https://identity.example.invalid`, client ID `d03-public-client`, API `https://api.example.invalid`, WebSocket `wss://api.example.invalid`.
- Required and configured optional images each exit unsuccessfully when either runtime secret is absent. Complete synthetic credentials expose Zitadel through `/api/auth/providers`; the generic optional image starts without provider credentials and returns no providers.
- Compiled public mode/issuer/provider flag/endpoints match the intended build. Served browser assets retain their public URLs; runtime canary secrets do not appear in scanned browser assets or responses.
- Containers run with network disabled, loopback requests inside the container, and no published host ports. The harness sets `AUTH_TRUST_HOST=true` only for this synthetic host; production policy is unchanged. Cleanup after both failure and success was verified.

| Image profile | Image digest |
|---|---|
| Required / configured | `sha256:a0f88dddfe7537380f49f689f94fa65263984d0dbcab0a9795132f194c04300d` |
| Optional / configured | `sha256:0eec01383e4d5217fea6045e849462be8b4e020397be38dca5208e8158f5a876` |
| Optional / anonymous | `sha256:0b8fa488ca979d0edce557bcbea34ddec9c36a3382c00a049f8be88d38df4e2f` |

Every image carries the full source revision above. BuildKit’s existing name-based `AUTH_MODE` secret warning concerns a nonsecret mode selector; no private credential build argument was introduced.

## Review and corrections

[Original review](d03-code-review.json) covers `a365aa8d`; [independent resolution](d03-review-resolution.json) covers the correction at `30b8ecb2`. Review reproduced an optional configured image returning no providers after runtime issuer/client ID were omitted. Runtime validation now compares the compiled browser mode, provider availability and issuer with server settings. Anonymous builds explicitly compile an empty issuer. Thirteen negative container cases prove rejection of missing secrets, omitted providers, issuer/mode changes and unexpected anonymous-image providers, including attempts to mask issuer drift with a runtime public variable. Three matching profiles pass. The original finding is resolved by the source correction and rebuilt-image evidence; live OIDC remains untested.

## Startup finding and correction

The first real negative smoke reproduced a gap that unit-level promise rejection could not prove: Next logged a rejected instrumentation hook but left the standalone process running. The final Node hook explicitly exits with code 1 after a fixed configuration diagnostic. A new regression failed before this correction and passed afterward; rebuilt containers now prove actual unsuccessful exit. Neither a “Ready” log nor lack of an HTTP response is accepted as startup-failure evidence.

The simplification pass found no reuse or quality changes. A suggested production auth-config cache was not adopted: no material cost was measured, and fresh request-time validation is part of this implementation’s authentication boundary.

## Reproduce

Build each mode with the public settings above, supplying no secret arguments. The generic optional build uses only `AUTH_MODE=optional`. Run the same harness used by CI:

```bash
bash scripts/verify-auth-image.sh ontokit/d03-web:required required configured
bash scripts/verify-auth-image.sh ontokit/d03-web:optional-configured optional configured
bash scripts/verify-auth-image.sh ontokit/d03-web:optional optional anonymous
```

The harness supplies only synthetic runtime credentials and removes its containers. Temporary local logs are expendable; this receipt preserves the outcomes and source/image identities.

## Remaining delivery obligations

D04: reproduce and repair API individual mint-capability enforcement. D05: preserve submit/resubmit state and map embedding budget/unavailability failures. D02: publish and pin the immutable matched pair, verify deployment prerequisites and rollback evidence, deploy, then prove real OIDC/persona workflows. D03 does not establish identity-provider reachability or real credential validity.
