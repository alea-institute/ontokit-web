---
title: D08 authentication lifecycle research boundary
date: 2026-09-21
status: researched; implementation pending
---

# D08 authentication lifecycle

Read-only code research against Web `83eaf9574315b71a165b80370dd964572d2ccac9`, branch `test/d08-auth-lifecycle-20260920`. Program state was read from the **root checkout's** `docs/plans/2026-09-20-0649-requirements-delivery-roadmap.md`, not this worktree's older copy. No tests or services were run. This receipt does not claim new acceptance.

The user's 2026-09-21 direction permits independent functionality work while prioritizing EU migration, confirms no competing DEV operator, and removes an assumed need to make the US deployment healthy before migration. It does not close B02/B03 or turn local regression evidence into hosted acceptance.

## Existing proof and exact remainder

| B11 behavior | Existing source evidence | Remaining proof |
|---|---|---|
| Genuine OIDC sign-in | `e2e/fixtures/auth.ts` signs fresh ordinary humans into real disposable Zitadel/Login; verifies session subject/email. `e2e/auth-foundation.spec.ts` uses issued bearer tokens for protected reads and rejects anonymous reads. | Retain this baseline; do not replace it with injected sessions. |
| Monaco/save/review/merge | `e2e/browser/ontology-workflow.spec.ts` imports, creates branch, changes Monaco label, saves, checks PR diff, merges and verifies persisted target after reload. | This is owner PR review/merge, not contributor suggestion submission or independent reviewer approval. Keep those B11 remainders open. |
| Logout | `components/auth/user-menu.tsx` clears BYO keys, signs out locally, redirects to issuer end-session; component tests cover calls and redirect construction. | Browser proof of app-session removal, provider logout and subsequent login without silent reuse of the old account. |
| Credential renewal | `auth.ts` uses refresh grant after access-token expiry. `__tests__/config/auth-session.integration.test.ts` exercises Auth.js cookie handling, rotation/nonrotation, error propagation and inactive modes. | Tests use synthetic cookies/mocked issuer responses; no real provider expiry/renewal proof. |
| Session expiry/re-authentication | `components/auth/SessionGuard.tsx` reauthenticates on `RefreshAccessTokenError` with current URL. Component tests cover invocation; `ByoKeySessionGuard.test.tsx` covers account boundary clearing. | Real expired/revoked refresh credential behavior, return URL and no false authenticated API success; distinguish access-token expiry from application-session expiry. |
| Auth modes | `lib/auth-mode.ts`, `__tests__/lib/auth-mode.test.ts`, `__tests__/config/auth-bootstrap.test.ts` cover required/optional/disabled and configured/unconfigured predicates. | `scripts/e2e/full-stack.mjs` and `e2e/compose.yaml` hardcode required. No real optional/disabled browser/API matrix. |

## Recommended bounded next implementation

**First implement required-mode lifecycle proof only.** Reuse D06 ownership, setup, secret confinement and cleanup. Extend `scripts/e2e/bootstrap-identity.mjs` only as needed to configure short-lived credentials on the disposable instance and a narrowly scoped test persona. Resolve the exact supported lifetime/revocation APIs against the pinned Zitadel version before coding. Existing bootstrap grants already include refresh tokens and register post-logout redirects.

Add `e2e/browser/auth-lifecycle.spec.ts` and focused helpers in `e2e/fixtures/auth.ts` / `e2e/fixtures/run.ts` for three independently isolated cases:

1. Fresh login, UI logout, empty application session, protected request without credentials denied, and new login requiring identity interaction. Do not assert that local logout immediately revokes an already-issued bearer token: that is a separate issuer contract.
2. Real short-lived access token expires, application session lookup triggers real renewal, subsequent protected API access succeeds with the same verified subject. Compare credentials only as booleans in memory; never emit token values. Observe expiration from actual issued claims, use bounded polling and retain the run abort signal. Browser clock mocking alone cannot expire server-side tokens.
3. Invalidate/expire the disposable persona's refresh credential through a supported provider operation, drive actual refresh failure, observe reauthentication and return to the original app URL. Prove a recovered identity and protected API success after fresh sign-in. Application session-cookie expiry needs its own separately identified assertion; a refresh failure is not equivalent evidence.

Do not mutate setup owner/unrelated sessions reused by other specs. Separate contexts and a dedicated lifecycle persona prevent revocation/short lifetimes from invalidating the existing 21-test workflow. `ownerApi` currently caches the access token loaded from disk; it cannot establish that the browser fetched and used a renewed token.

Update the exact mandatory inventory in `scripts/e2e/evidence.mjs` and its negative tests in `scripts/e2e/evidence.test.mjs`. Missing or skipped lifecycle cases must fail acceptance. Update `e2e/README.md` with the new acceptance boundary and sanitized receipt fields, retaining all existing required tests. New files must be tracked before harness snapshots: the launcher intentionally excludes untracked source.

## Separate bounded auth-mode matrix

Keep optional/disabled matrix work as the next B11 slice. Each mode needs matching **build-time and runtime** web configuration plus explicit API mode, rather than changing environment beneath one compiled image. Cover required+configured, optional+configured, optional+unconfigured, and disabled; verify sign-in affordances/provider availability, anonymous public reads, private-resource denial and permitted writes against the actual API contract. Bootstrap policy verification currently asserts required auth, and setup always signs in both personas: adapt these intentionally rather than disabling guards to get anonymous runs green.

Inspect API mode semantics before fixing expected results. `app/page.tsx` currently renders private/mine sign-in prompts without consulting the shared auth-UI predicate, a candidate disabled-mode defect requiring reproduction. No `middleware.ts` exists here; do not infer global required-mode redirects solely from the comment in `lib/auth-mode.ts`.

## Verification and decisions still needed

- Select the merged D07 API source explicitly (root roadmap records merge `13ad2f35d55196274c5fec313bfb254a7cc80226`); `e2e/README.md` still points at the older D06 API worktree. Record actual copied source fingerprints, not HEAD alone.
- Confirm pinned-provider support for bounded token lifetimes and targeted refresh invalidation. This is a local research prerequisite, not a hosted administrator dependency. Avoid long wall-clock tests or fabricated issuer behavior.
- Investigate a concrete auth edge before deciding production repair: `auth.ts` returns an expired token unchanged when it has no refresh token; existing integration tests explicitly preserve this behavior. Successful renewal spreads the previous token and does not explicitly clear an old `error`. Treat these as candidates requiring a reproduced reachable case, not confirmed defects.
- Run targeted auth/harness unit tests after implementation, then the full isolated suite twice with identical source fingerprints and neighbor-resource checks. Repeat lifecycle failure/cleanup probes if changes affect ownership/startup/teardown. Preserve zero skips and sanitized receipts; no raw session/log artifacts in Git.
- This research needs no hosted credentials and must not delay EU restore/capacity work. B02/B03, the suggestion submission/reviewer chain, B12 WebSockets and B13 broader browser CI remain separate.

Only this research document was created. Production code, roadmap, infrastructure and Git history were not changed by this research task.
