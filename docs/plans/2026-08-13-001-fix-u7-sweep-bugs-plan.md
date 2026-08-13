---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
title: "fix: U7 sweep bugs — federated logout and the silently-dropped suggester save"
date: 2026-08-13
type: fix
branch: fix/u7-sweep-bugs
base: origin/feat/pr-party
---

# fix: U7 sweep bugs — federated logout and the silently-dropped suggester save

## Goal Capsule

Two bugs found during the U7 auth-on persona sweep block DEV from being sound enough
for Damien to UAT before any PROD work. Both are **silent-failure** bugs: each reports
success while doing the wrong thing, or nothing at all. Fix both, prove both with
red-then-green regression tests, deploy to DEV, and verify against running containers.

---

## Problem Frame

DEV now runs the current integration branch (`api 6bec76ae` / `web 59747361`) with
`AUTH_MODE=optional`. Anonymous browsing, sign-in affordances, and the OIDC provider
wiring are all correct. What remains broken is the pair of defects the terminal sweep
found on 2026-08-10, both re-confirmed today against the fresh build.

They share a shape worth naming, because it is the third instance this repo has hit:
**an operation that fails or no-ops still reports success.** The fixes must remove the
false success, not merely make the happy path work.

---

## Requirements

- **R1** — Federated logout must reach the real Zitadel end-session endpoint in every
  deployment, never `localhost`. (CatholicOS/ontokit-web#344)
- **R2** — A misconfigured issuer must fail loudly rather than silently redirecting the
  user to a dead URL.
- **R3** — A suggester's save must actually write content to the suggestion session —
  the PUT must be issued and the branch must gain a commit. (CatholicOS/ontokit-web#345)
- **R4** — A save that does not write must not be able to report success. No success
  toast on a dropped write.
- **R5** — R3's fix must cover class, property, **and** individual suggestion handlers;
  all three carry the same defect.
- **R6** — Each fix carries a regression test that fails before the fix and passes after.

---

## Key Technical Decisions

### KTD1 — Bake the issuer via `next.config.ts`, following the merged #347 pattern

`ZITADEL_ISSUER` and `ZITADEL_CLIENT_ID` are already available at build time
(`Dockerfile` ARGs, passed by the deploy script's `--build-arg`). `next.config.ts`
already derives `NEXT_PUBLIC_ZITADEL_CONFIGURED` from exactly those two variables.
Deriving `NEXT_PUBLIC_ZITADEL_ISSUER` in the same `env:` block is the established,
already-reviewed pattern — no new build plumbing, no new Docker arg.

Rejected: moving the end-session redirect server-side. It is the more robust design and
worth doing eventually, but it is a larger change touching the auth route surface, and
this plan's job is to make DEV sound. Record it as a follow-up, not scope creep.

### KTD2 — Fix the stale closure by threading the id, not by adding a ref alone

`startSession()` should **return** the new session id, and `saveToSession` should accept
an optional explicit id that takes precedence over the closed-over state. A `sessionIdRef`
kept in sync is a reasonable belt-and-braces addition, but the return value is what makes
the call site correct by construction rather than by timing.

### KTD3 — The guard must throw, not return

`saveToSession`'s `if (!sessionId ...) return;` is the actual defect that let the bug ship
silently. Missing session id or missing token is a programming/config error, not a normal
no-op — it must throw so the caller's `await` rejects, the toast never fires, and the user
sees a real error. Keep `savingRef.current` as a genuine no-op (concurrent-save guard),
since that one *is* a legitimate skip.

This is the same lesson as `docs/solutions/conventions/validate-before-mutate-or-your-failure-reports-success.md`
and the two earlier "silence is not success" learnings.

---

## Implementation Units

### U1. Derive `NEXT_PUBLIC_ZITADEL_ISSUER` at build time

**Goal:** The real issuer reaches the client bundle in every deployment.
**Requirements:** R1
**Files:**
- `next.config.ts`
- `__tests__/config/next-config-env.test.ts` (new)

**Approach:**
1. In the `env:` block, add `NEXT_PUBLIC_ZITADEL_ISSUER: process.env.ZITADEL_ISSUER`.
2. Keep it adjacent to `NEXT_PUBLIC_ZITADEL_CONFIGURED` so the shared-predicate comment
   covers both.

**Patterns to follow:** the existing `NEXT_PUBLIC_ZITADEL_CONFIGURED` derivation.

**Test scenarios:**
- With `ZITADEL_ISSUER` set, the exported config's `env.NEXT_PUBLIC_ZITADEL_ISSUER` equals it.
- With `ZITADEL_ISSUER` unset, the value is undefined (does not silently become a localhost string).

**Verification:** a production build with `ZITADEL_ISSUER` set contains the issuer host in the client chunks.

### U2. Make a missing issuer fail loudly in the logout path

**Goal:** No user is ever redirected to `http://localhost:8080` from a deployed build.
**Requirements:** R1, R2
**Dependencies:** U1
**Files:**
- `components/auth/user-menu.tsx`
- `__tests__/components/auth/user-menu.test.tsx` (new or extended)

**Approach:**
1. Remove the `|| "http://localhost:8080"` fallback at module scope.
2. In `handleSignOut`, after clearing the NextAuth session, branch: if no issuer is
   configured, surface an error (toast/console) and leave the user on the app rather than
   navigating to a dead URL. The local session is already cleared, so the user is signed
   out locally either way — the Zitadel-side session simply survives, which is the honest
   outcome to report.
3. Do not regress the existing behavior when the issuer *is* present.

**Execution note:** write the failing test first — assert that with no issuer configured,
`window.location.href` is never set to a localhost URL.

**Test scenarios:**
- Issuer configured → sign-out navigates to `<issuer>/oidc/v1/end_session` with the client id and post-logout redirect.
- Issuer absent → `window.location.href` is not assigned a localhost URL; an error surfaces; NextAuth sign-out still ran.
- The post-logout redirect URI is URL-encoded.

**Verification:** on DEV, the user menu's sign-out reaches the real Zitadel end-session URL.

### U3. Return the session id from `startSession` and honor an explicit id in `saveToSession`

**Goal:** The save call issued immediately after session creation uses the real id.
**Requirements:** R3, R5
**Files:**
- `lib/hooks/useSuggestionSession.ts`
- `__tests__/lib/hooks/useSuggestionSession.test.ts` (new or extended)

**Approach:**
1. `startSession` returns the created session id (and keeps setting state).
2. Add a `sessionIdRef` kept in sync with the `sessionId` state.
3. `saveToSession` accepts an optional explicit session id; resolution order is
   explicit argument → ref → state.
4. Preserve existing behavior for every other consumer of the hook.

**Execution note:** test-first. The red test is "create then immediately save issues the PUT".

**Test scenarios:**
- `startSession()` resolves to the new session id.
- Calling `saveToSession` immediately after `startSession` within one render issues the PUT with the correct id (this is the bug — must be red first).
- An explicit id argument overrides stale state.
- Concurrent `saveToSession` calls still no-op via `savingRef` (unchanged).
- `resumeSession` continues to populate the id so later saves work.

### U4. Make the dropped-save guard throw instead of returning silently

**Goal:** A save that cannot write can never be reported as success.
**Requirements:** R4
**Dependencies:** U3
**Files:**
- `lib/hooks/useSuggestionSession.ts`
- `__tests__/lib/hooks/useSuggestionSession.test.ts`

**Approach:**
1. Missing session id (after the U3 resolution order) or missing access token → throw a
   descriptive error rather than `return`.
2. Keep the `savingRef.current` in-flight check as a real no-op.
3. Confirm callers surface the rejection rather than swallowing it.

**Test scenarios:**
- No session id and no explicit id → rejects with a descriptive error.
- No access token → rejects.
- In-flight save → still a silent no-op, does not throw.

### U5. Fix all three suggestion handlers at the call site

**Goal:** Class, property, and individual suggestion saves all write content, and the
toast only fires after a real write.
**Requirements:** R3, R4, R5
**Dependencies:** U3, U4
**Files:**
- `app/projects/[id]/editor/page.tsx`
- `__tests__/app/projects/editor/suggest-handlers.test.tsx` (new)

**Approach:**
1. In each of `handleSuggestClassUpdate`, `handleSuggestPropertyUpdate`, and
   `handleSuggestIndividualUpdate`: capture the id returned by `startSession()` and pass it
   explicitly to `saveToSession`.
2. Ensure `toast.success(...)` runs only after `saveToSession` resolves — it already
   follows the `await`, but with U4 in place a failure now rejects and correctly skips it.
3. Do not change the anonymous-proposal path.

**Test scenarios:**
- Each of the three handlers, starting with no session: creates a session and then issues the save with the new id.
- Each handler with an existing session: does not re-create, saves with the existing id.
- When the save rejects, no success toast fires and the error surfaces.

### U6. Tail — audit-trail review residuals (only if cheap)

**Goal:** Close CatholicOS/ontokit-web#348's non-blocking nits.
**Requirements:** none (tail)
**Dependencies:** U1–U5 complete and green
**Files:** as identified by the issue (e.g. the duplicated `formatTimeAgo` in
`components/projects/AuditLogSection.tsx`).

**Approach:** consolidate the duplicated helper into a shared util and re-point callers.
Skip entirely if it turns out to be more than a small mechanical change — it is explicitly
non-blocking, and DEV soundness is the goal.

**Test scenarios:** existing tests continue to pass; add a direct unit test for the
consolidated helper if one does not exist.

---

## Scope Boundaries

**In scope:** #344, #345, and #348's cheap nits; regression tests; DEV deploy and verification.

### Deferred to Follow-Up Work
- Moving the end-session redirect server-side (KTD1's rejected alternative) — better design, larger change.
- A broader audit for other `useCallback`-closed-over-state call sites with the same stale-closure shape. Worth doing; not this plan.

**Out of scope:** anything PROD-side. PROD access is still blocked and its payload decision is unsettled.

---

## Risks & Dependencies

- **Throwing where callers previously saw a silent return (U4)** could surface errors in
  paths that relied on the no-op. Mitigation: U5 audits every `saveToSession` caller.
- **`next.config.ts` `env:` values bake at build time** — a deploy that does not pass
  `ZITADEL_ISSUER` as a build arg still produces a broken bundle. The deploy script does
  pass it; U1's verification checks the built artifact, not just the source.

---

## Verification Contract

1. `npm run lint`, `npm run type-check`, `npm run test` all green. `auth.ts:93`'s
   User-vs-AdapterUser TS error is **pre-existing** — not a regression.
2. Every new test demonstrated red before the fix and green after.
3. After deploy to DEV: the issuer host appears in the client bundle and
   `localhost:8080` does not.
4. Deploy verified by **container uptime and image build time**, never by the
   `ontokit-deploy status` verb (it reads git HEAD, not running images — CatholicOS/ontokit-api#211).

## Definition of Done

- #344 and #345 fixed, with regression tests proving each.
- All three suggestion handlers corrected.
- Deployed to DEV and verified against running containers.
- Issues updated; PR opened on the ALEA fork.
