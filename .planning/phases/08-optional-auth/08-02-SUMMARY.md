---
phase: 08-optional-auth
plan: 02
subsystem: auth
tags: [nextauth, zitadel, oidc, anonymous, auth-mode]

# Dependency graph
requires:
  - phase: 08-optional-auth
    provides: Phase context — auth mode strategy established

provides:
  - AUTH_MODE=required|optional|disabled runtime flag with env-var gating
  - Conditional Zitadel provider in NextAuth (absent when unconfigured)
  - NEXT_PUBLIC_AUTH_MODE and NEXT_PUBLIC_ZITADEL_CONFIGURED browser flags
  - Sign-in-to-edit button in editor header and ClassDetailPanel for anonymous users
  - callbackUrl on all signIn() calls for post-auth redirect to originating page

affects: [09-deploy, components/layout/header, app/projects/editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AUTH_MODE env var gates all auth behavior (required/optional/disabled)
    - NEXT_PUBLIC_* build-time flags expose server auth mode to client components
    - Conditional Zitadel env validation — only required when AUTH_MODE=required
    - signIn() always passes callbackUrl for return-to-same-page auth flow

key-files:
  created:
    - lib/auth-mode.ts
  modified:
    - lib/env.ts
    - auth.ts
    - next.config.ts
    - components/layout/header.tsx
    - components/auth/user-menu.tsx
    - app/projects/[id]/editor/page.tsx
    - components/editor/ClassDetailPanel.tsx
    - components/editor/developer/DeveloperEditorLayout.tsx
    - components/editor/standard/StandardEditorLayout.tsx

key-decisions:
  - "AUTH_MODE is read server-side; NEXT_PUBLIC_AUTH_MODE and NEXT_PUBLIC_ZITADEL_CONFIGURED expose it to the client via next.config.ts"
  - "Sign-in button is completely hidden (not just disabled) when Zitadel is not configured — graceful degradation for FOLIO without auth"
  - "All signIn() calls now pass callbackUrl: window.location.href for seamless post-auth return"
  - "NotificationBell and UserMenu both hidden when showAuthUI=false — clean anonymous experience"

patterns-established:
  - "AUTH_MODE pattern: getAuthMode() for server, NEXT_PUBLIC_AUTH_MODE for client"
  - "Zitadel guard: isZitadelConfigured() server-side, NEXT_PUBLIC_ZITADEL_CONFIGURED client-side"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 8 Plan 02: Optional Auth Frontend Summary

**AUTH_MODE env var gates Zitadel OIDC — optional/disabled modes enable anonymous browsing with graceful sign-in affordances when configured**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-03T16:17:10Z
- **Completed:** 2026-04-03T16:21:54Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments

- Created `lib/auth-mode.ts` as centralized server-side auth mode helper (getAuthMode, isZitadelConfigured, isAuthRequired)
- Made Zitadel env vars optional in `lib/env.ts` when AUTH_MODE is not required
- Made NextAuth provider list, token refresh, and custom pages all conditional on auth mode and Zitadel configuration
- Exposed auth mode and Zitadel configuration status as NEXT_PUBLIC_ flags in `next.config.ts`
- Header and UserMenu now hide all auth UI when auth is disabled or Zitadel is unconfigured
- Editor header and ClassDetailPanel both show "Sign in to edit" button for anonymous users only when Zitadel is configured
- All signIn() calls now pass `callbackUrl: window.location.href` for post-auth page return

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth-mode helper and update env validation** - `600725e` (feat)
2. **Task 2: Configure auth.ts for conditional Zitadel provider** - `235ee8f` (feat)
3. **Task 3: Conditionally show Sign In button based on Zitadel availability** - `8e57aa5` (feat)
4. **Task 4: Sign-in-to-edit affordances for anonymous users** - `9e29651` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/auth-mode.ts` — New helper: getAuthMode(), isZitadelConfigured(), isAuthRequired()
- `lib/env.ts` — Conditional Zitadel env validation (optional when AUTH_MODE != required)
- `auth.ts` — Conditional provider list, token refresh guard, optional pages config
- `next.config.ts` — Exposes NEXT_PUBLIC_AUTH_MODE and NEXT_PUBLIC_ZITADEL_CONFIGURED
- `components/layout/header.tsx` — showAuthUI gate hides NotificationBell + UserMenu
- `components/auth/user-menu.tsx` — Returns null when showAuthUI=false and no session
- `app/projects/[id]/editor/page.tsx` — zitadelConfigured flag, callbackUrl on all signIn() calls, new props passed to layouts
- `components/editor/ClassDetailPanel.tsx` — showSignInToEdit/onSignInToEdit props, LogIn icon, "Sign in to edit" button
- `components/editor/developer/DeveloperEditorLayout.tsx` — Thread showSignInToEdit/onSignInToEdit
- `components/editor/standard/StandardEditorLayout.tsx` — Thread showSignInToEdit/onSignInToEdit

## Decisions Made

- Used `next.config.ts` `env:` block to expose NEXT_PUBLIC_ flags at build time rather than runtime — consistent with how Next.js recommends exposing server config to the browser
- Hidden auth UI entirely (not disabled) when Zitadel is unconfigured — avoids confusing "Sign in" button that leads nowhere
- ClassDetailPanel receives `showSignInToEdit`/`onSignInToEdit` as explicit props (not reading env directly) — keeps component portable and testable
- `NotificationBell` also hidden alongside `UserMenu` in no-auth mode — notifications require auth to function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] UserMenu sign-in button also needs showAuthUI guard**
- **Found during:** Task 3
- **Issue:** The plan specified adding showAuthUI to header.tsx, but the actual sign-in button lives in `components/auth/user-menu.tsx`. Both needed the guard for proper behavior.
- **Fix:** Added authMode/zitadelConfigured/showAuthUI constants to both `header.tsx` AND `user-menu.tsx`, with `return null` in UserMenu when showAuthUI=false and no session.
- **Files modified:** components/auth/user-menu.tsx
- **Verification:** No TS errors, no test failures
- **Committed in:** 8e57aa5 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary fix — sign-in button was in user-menu.tsx not directly in header.tsx. Both components now correctly implement the showAuthUI gate.

## Issues Encountered

- Pre-existing TS errors in lib/env.ts (z.url() and z.treeifyError() Zod v3 type mismatch) — present before this plan, not introduced by our changes
- Pre-existing test failures in __tests__/lib/env.test.ts (5 failures, same as baseline) — not affected by our changes

## Next Phase Readiness

- Frontend auth mode implementation complete — ready for Phase 9 (deploy/server setup)
- Backend API middleware still needs similar AUTH_MODE handling (ontokit-api)
- FOLIO can now deploy with AUTH_MODE=optional and no Zitadel vars → anonymous browsing works out of the box

## Self-Check: PASSED

- lib/auth-mode.ts: FOUND
- lib/env.ts: FOUND
- auth.ts: FOUND
- next.config.ts: FOUND
- components/layout/header.tsx: FOUND
- components/editor/ClassDetailPanel.tsx: FOUND
- Commit 600725e: FOUND
- Commit 235ee8f: FOUND
- Commit 8e57aa5: FOUND
- Commit 9e29651: FOUND

---
*Phase: 08-optional-auth*
*Completed: 2026-04-03*
