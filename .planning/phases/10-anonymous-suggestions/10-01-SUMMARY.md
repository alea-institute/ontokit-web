---
phase: 10-anonymous-suggestions
plan: 01
subsystem: api
tags: [fastapi, anonymous-auth, hmac, rate-limiting, honeypot, suggestion-sessions]

requires:
  - phase: 08-optional-auth
    provides: AUTH_MODE config, ANONYMOUS_USER, optional/disabled auth modes
  - phase: suggestions
    provides: SuggestionSession model, SuggestionService, beacon token pattern

provides:
  - Anonymous suggestion session create/save/submit/discard/beacon endpoints
  - HMAC-signed anonymous session tokens (24h TTL, anon: prefix for type safety)
  - SuggestionSession model extended with is_anonymous, submitter_name, submitter_email, client_ip
  - Rate limiting: 5 anonymous sessions per IP per hour
  - Honeypot spam protection on submit endpoint
  - is_anonymous field on SuggestionSessionSummary for review UI badges

affects: [10-anonymous-suggestions-frontend, suggestion-review-ui]

tech-stack:
  added: []
  patterns:
    - "HMAC anonymous token with anon: prefix prevents beacon/anonymous token type confusion"
    - "Honeypot field aliased as 'website' in Pydantic — bots fill it, humans don't"
    - "All anonymous endpoints gate on settings.auth_mode != 'required' (return 403)"
    - "X-Anonymous-Token header for session-scoped auth (no Bearer token required)"

key-files:
  created:
    - ontokit/core/anonymous_token.py
    - ontokit/schemas/anonymous_suggestion.py
    - ontokit/api/routes/anonymous_suggestions.py
  modified:
    - ontokit/models/suggestion_session.py
    - ontokit/services/suggestion_service.py
    - ontokit/schemas/suggestion.py
    - ontokit/api/routes/__init__.py

key-decisions:
  - "Anonymous token uses anon: HMAC prefix to prevent type confusion with beacon tokens sharing the same SECRET_KEY"
  - "Honeypot field aliased as 'website' in Pydantic — silent fake success prevents bots from learning they were blocked"
  - "Anonymous sessions use client IP from request.client.host for rate limiting (5/IP/hour)"
  - "submitter_name/email stored as separate columns (not overwriting user_name) — allows credit display post-submit while preserving audit trail"
  - "beacon endpoint for anonymous sessions delegates to existing beacon_save() with anonymous token verification as the gate"

patterns-established:
  - "Endpoint auth gate: _require_anonymous_mode() helper raises 403 when AUTH_MODE=required"
  - "Token auth gate: _verify_anon_token() helper raises 401 for invalid/expired tokens"

requirements-completed: [ANON-04, ANON-05]

duration: 21min
completed: 2026-04-03
---

# Phase 10 Plan 01: Anonymous Suggestion Backend Summary

**HMAC-signed anonymous session tokens with rate limiting and honeypot spam protection enabling unauthenticated suggestion sessions on the ontokit-api backend**

## Performance

- **Duration:** 21 min
- **Started:** 2026-04-03T22:26:47Z
- **Completed:** 2026-04-03T22:47:58Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Anonymous users can create, save, submit, and discard suggestion sessions without a Bearer token when AUTH_MODE is "optional" or "disabled"
- HMAC-signed anonymous tokens (24h TTL, `anon:` prefix) provide session continuity without requiring login
- Rate limiting (5 sessions/IP/hour) and honeypot spam protection prevent abuse
- Review summaries now carry `is_anonymous: bool` and show credit name/email when provided at submit time

## Task Commits

1. **Task 1: Anonymous token module, extended model, schemas** - `45a93d9` (feat)
2. **Task 2: Anonymous endpoints, service methods, rate limiting** - `5a0542d` (feat)
3. **Task 3: Update review summaries for anonymous submitter info** - `0f6202e` (feat)

## Files Created/Modified

- `ontokit/core/anonymous_token.py` - HMAC-signed anonymous token create/verify (24h TTL, anon: prefix)
- `ontokit/schemas/anonymous_suggestion.py` - AnonymousSessionCreateResponse, AnonymousSubmitRequest (honeypot), AnonymousSubmitResponse
- `ontokit/api/routes/anonymous_suggestions.py` - 5 endpoints: create, save, submit, discard, beacon
- `ontokit/models/suggestion_session.py` - Added is_anonymous, submitter_name, submitter_email, client_ip columns
- `ontokit/services/suggestion_service.py` - Added create_anonymous_session, save_anonymous, submit_anonymous, discard_anonymous methods; updated _build_summary and _create_pr_for_session for anonymous attribution
- `ontokit/schemas/suggestion.py` - Added is_anonymous: bool = False to SuggestionSessionSummary
- `ontokit/api/routes/__init__.py` - Registered anonymous_suggestions router under /projects prefix

## Decisions Made

- **HMAC prefix:** `anon:` prepended to payload before signing prevents beacon tokens and anonymous tokens (both using `settings.secret_key`) from being interchangeable — type safety without a separate secret.
- **Honeypot silent success:** When bots fill the `website` field, the endpoint returns a fake 200 success without creating anything. Returning an error would teach bots that the field is a trap.
- **Credit fields are separate columns:** `submitter_name`/`submitter_email` are new columns rather than overwriting `user_name`/`user_email` — this preserves the audit trail while allowing the review UI to display credit info.
- **beacon endpoint delegates to existing service:** Anonymous beacon uses `verify_anonymous_token()` as the gate then calls the existing `beacon_save()` — no duplication of the git commit logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added client_ip column to SuggestionSession in Task 1 (not Task 2)**
- **Found during:** Task 1 (model extension)
- **Issue:** Plan specified adding client_ip in Task 2, but the model file was being modified in Task 1 anyway — adding it in Task 1 avoids a second migration and keeps the model complete.
- **Fix:** Added `client_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)` alongside the other new columns in Task 1.
- **Files modified:** ontokit/models/suggestion_session.py
- **Verification:** Verified presence of all 4 new columns in Task 1 verification check.
- **Committed in:** 45a93d9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (timing consolidation — no scope change)
**Impact on plan:** Negligible — client_ip added one task earlier than specified, which is strictly better than splitting model changes across two commits.

## Issues Encountered

- The default `SECRET_KEY="change-me-in-production"` caused `_check_secret_key()` to raise during local verification. Resolved by passing `SECRET_KEY="test-secret-key-for-testing-only"` as an environment variable to the verification commands. This is expected behavior — the guard is working correctly.

## User Setup Required

None — no new external service configuration required. The anonymous suggestion feature is gated on existing `AUTH_MODE` environment variable. A database migration will be needed to add the four new columns (`is_anonymous`, `submitter_name`, `submitter_email`, `client_ip`) to the `suggestion_sessions` table.

## Next Phase Readiness

- Backend anonymous suggestion API is complete and ready for frontend integration
- Frontend will need: `anonymous_token` storage in localStorage, `X-Anonymous-Token` header injection, and a submit form with `submitter_name`/`submitter_email` credit fields
- Review UI can use `is_anonymous: true` on `SuggestionSessionSummary` to show an "Anonymous" badge

---
*Phase: 10-anonymous-suggestions*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: ontokit/core/anonymous_token.py
- FOUND: ontokit/schemas/anonymous_suggestion.py
- FOUND: ontokit/api/routes/anonymous_suggestions.py
- FOUND: .planning/phases/10-anonymous-suggestions/10-01-SUMMARY.md
- FOUND commit: 45a93d9 (Task 1)
- FOUND commit: 5a0542d (Task 2)
- FOUND commit: 0f6202e (Task 3)
