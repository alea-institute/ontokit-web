---
phase: 08-optional-auth
plan: 01
subsystem: auth
tags: [fastapi, pydantic, auth, jwt, zitadel, pytest]

# Dependency graph
requires: []
provides:
  - AUTH_MODE env var config (required/optional/disabled) in ontokit-api Settings
  - ANONYMOUS_USER constant for no-auth and disabled modes
  - Three-mode auth support in get_current_user, get_current_user_optional, get_current_user_with_token
affects: [09-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-mode auth guard: disabled returns ANONYMOUS_USER, optional uses existing None behavior, required enforces 401"
    - "Early-return pattern in FastAPI dependencies for auth mode dispatch"

key-files:
  created:
    - /home/damienriehl/Coding Projects/ontokit-api/tests/unit/test_auth_disabled.py
  modified:
    - /home/damienriehl/Coding Projects/ontokit-api/ontokit/core/config.py
    - /home/damienriehl/Coding Projects/ontokit-api/ontokit/core/auth.py

key-decisions:
  - "AUTH_MODE=optional leaves RequiredUser (write endpoints) returning 401 — no change needed, only OptionalUser routes work anonymously"
  - "ANONYMOUS_USER has roles=['viewer'] — consistent with least-privilege for unauthenticated access"
  - "No Zitadel config needed for AUTH_MODE=disabled — JWKS is only fetched lazily when a token is present"

patterns-established:
  - "Auth mode dispatch: check settings.auth_mode at top of each auth dependency, early return for disabled"

requirements-completed: [AUTH-01, AUTH-04, AUTH-05]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 8 Plan 01: Optional Auth Backend Summary

**AUTH_MODE env var (required/optional/disabled) added to ontokit-api with ANONYMOUS_USER for no-credential modes, leaving optional-mode browse-only access working without code changes to OptionalUser routes**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-03T16:17:00Z
- **Completed:** 2026-04-03T16:20:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `auth_mode` field to Settings class in config.py with default "required" (backward compatible)
- Added `ANONYMOUS_USER` constant to auth.py (id="anonymous", roles=["viewer"])
- Added three early-return guards in get_current_user, get_current_user_optional, get_current_user_with_token for disabled mode
- Optional mode requires zero changes: OptionalUser already returns None for no credentials; RequiredUser already 401s
- 11 unit tests covering all three modes and all three auth dependency functions — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AUTH_MODE config and update auth module for three modes** - `0bd679b` (feat)
2. **Task 2: Add tests for all three auth modes** - `f98f3e0` (test)

**Plan metadata:** (committed after state update)

## Files Created/Modified

- `ontokit/core/config.py` - Added `auth_mode: str = "required"` field to Settings class
- `ontokit/core/auth.py` - Added ANONYMOUS_USER constant + early returns in three auth functions for disabled mode
- `tests/unit/test_auth_disabled.py` - 11 tests covering ANONYMOUS_USER, disabled/required/optional modes

## Decisions Made

- `AUTH_MODE=optional` does NOT change OptionalUser behavior — it already returns None when no credentials, which is exactly the right behavior for browse-without-login. No code path changes needed.
- `AUTH_MODE=optional` does NOT change RequiredUser behavior — write endpoints still 401 without credentials. This is intentional write protection.
- `ANONYMOUS_USER.roles = ["viewer"]` follows least-privilege: unauthenticated users can only view.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `python` command not found; used `uv run python` instead. Project uses `uv` for dependency management and no global Python alias.

## User Setup Required

None — no external service configuration required. The `AUTH_MODE` env var defaults to `"required"` so existing deployments are unaffected.

## Next Phase Readiness

- Backend auth mode support complete; FOLIO can deploy with `AUTH_MODE=optional`
- Phase 9 (deploy) can proceed: set `AUTH_MODE=optional` in FOLIO's env, `AUTH_MODE=required` for CatholicOS
- No blockers

## Self-Check: PASSED

- config.py: FOUND
- auth.py: FOUND
- test_auth_disabled.py: FOUND
- SUMMARY.md: FOUND
- commit 0bd679b (Task 1): FOUND
- commit f98f3e0 (Task 2): FOUND

---
*Phase: 08-optional-auth*
*Completed: 2026-04-03*
