---
phase: 10-anonymous-suggestions
plan: 02
subsystem: frontend
tags: [anonymous-suggestions, api-client, zustand, hooks, modal, honeypot, localStorage]

requires:
  - phase: 10-anonymous-suggestions
    plan: 01
    provides: Backend anonymous suggestion endpoints (X-Anonymous-Token, /anonymous/sessions/* routes)

provides:
  - anonymousSuggestionsApi with createSession/save/submit/discard/beacon using X-Anonymous-Token header
  - AnonymousSessionCreateResponse and AnonymousSubmitPayload types (including website honeypot)
  - useAnonymousTokenStore — persists anonymous session tokens per projectId in localStorage
  - useAnonymousCreditStore — persists optional submitter name/email for credit attribution
  - useAnonymousSuggestion hook — manages full anonymous session lifecycle with localStorage restoration on mount
  - CreditModal — post-submit dialog collecting optional credit info with honeypot field

affects: [10-anonymous-suggestions-ui]

tech-stack:
  added: []
  patterns:
    - "useAnonymousTokenStore keyed by projectId — allows concurrent anonymous sessions in different projects"
    - "Session restoration on mount via useEffect + restoredRef guard — prevents double-restore on re-render"
    - "CreditModal honeypot: name=website, tabIndex=-1, absolute-positioned off-screen — invisible to humans, filled by bots"
    - "export type { SuggestionStatus } re-export pattern — callers can import from useAnonymousSuggestion without depending on useSuggestionSession directly"

key-files:
  created:
    - lib/stores/anonymousCreditStore.ts
    - lib/hooks/useAnonymousSuggestion.ts
    - components/suggestions/CreditModal.tsx
  modified:
    - lib/api/suggestions.ts

key-decisions:
  - "Anonymous token store uses createJSONStorage(() => localStorage) — same pattern as draftStore, avoids SSR issues"
  - "useAnonymousSuggestion restores session on mount from tokenStore rather than requiring caller to pass stored token — reduces coupling"
  - "CreditModal title is 'Want credit for your suggestions?' — appears post-submit so it does not block the submission flow"
  - "Honeypot field in CreditModal sends value up to onSubmitCredit but useAnonymousSuggestion always overrides website to '' in the submit payload — defense in depth"

metrics:
  duration: 2min
  completed: 2026-04-03
  tasks: 2
  files: 4
---

# Phase 10 Plan 02: Anonymous Suggestion Frontend Infrastructure Summary

**Frontend API client, Zustand stores, session hook, and post-submit credit modal for anonymous (unauthenticated) suggestion sessions with X-Anonymous-Token header auth and localStorage persistence**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T22:50:27Z
- **Completed:** 2026-04-03T22:52:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Anonymous users can create, save, submit, and discard suggestion sessions via `anonymousSuggestionsApi` without any Bearer token — uses `X-Anonymous-Token` header matching the backend plan 01 endpoints
- Anonymous session tokens are persisted per-projectId in localStorage via `useAnonymousTokenStore` and automatically restored on page reload
- `useAnonymousSuggestion` hook mirrors `useSuggestionSession` shape so callers switching between authenticated and anonymous modes have minimal API differences
- `CreditModal` appears post-submission, pre-fills from cached credit info, and caches name/email in `useAnonymousCreditStore` for future proposals
- Honeypot protection at two layers: CreditModal field (invisible to humans) and `useAnonymousSuggestion.submitSession` always sending `website: ""`

## Task Commits

1. **Task 1: Anonymous API client + credit store + anonymous token persistence** - `5ea56a6` (feat)
2. **Task 2: Anonymous suggestion session hook + credit modal** - `89474de` (feat)

## Files Created/Modified

- `lib/api/suggestions.ts` — Added `anonymousSuggestionsApi` object (createSession, save, submit, discard, beacon), `AnonymousSessionCreateResponse`, `AnonymousSubmitPayload` types
- `lib/stores/anonymousCreditStore.ts` — Two persisted Zustand stores: `useAnonymousCreditStore` (name/email) and `useAnonymousTokenStore` (token/sessionId/branch per projectId)
- `lib/hooks/useAnonymousSuggestion.ts` — Full anonymous session lifecycle hook; restores from localStorage on mount; clears token store on submit/discard
- `components/suggestions/CreditModal.tsx` — Post-submit dialog with Name/Email fields, pre-fill from credit store, invisible honeypot, Skip/Save buttons

## Decisions Made

- **Two separate stores:** `useAnonymousCreditStore` (credit info, shared across projects) and `useAnonymousTokenStore` (session tokens, keyed by projectId) are in the same file but exported separately — avoids combining unrelated concerns into one store.
- **Mount restoration via restoredRef:** The `useEffect` in `useAnonymousSuggestion` uses a `restoredRef` guard (not a dep array trick) to ensure token restoration runs exactly once even in StrictMode double-invocation.
- **CreditModal does not block submit:** The modal is shown after `onSubmitted` fires — callers are responsible for rendering it conditionally on a `showCreditModal` state flag. This keeps the hook's `submitSession` clean and unaware of the modal.
- **Honeypot at submit boundary, not modal:** `submitSession` always sends `website: ""` regardless of what the modal passes — provides defense-in-depth if a bot somehow bypasses the modal.

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

- Frontend infrastructure is complete and ready for UI integration (plan 03)
- Callers need: `useAnonymousSuggestion({ projectId })` → `startSession()` on first edit → `saveToSession()` on each change → `submitSession()` → render `<CreditModal>` on success
- The `anonymousToken` value from the hook can also be passed to `anonymousSuggestionsApi.beacon()` directly for `useSuggestionBeacon`-style safety-net flushing

---
*Phase: 10-anonymous-suggestions*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: lib/api/suggestions.ts (anonymousSuggestionsApi exported)
- FOUND: lib/stores/anonymousCreditStore.ts
- FOUND: lib/hooks/useAnonymousSuggestion.ts
- FOUND: components/suggestions/CreditModal.tsx
- FOUND commit: 5ea56a6 (Task 1)
- FOUND commit: 89474de (Task 2)
- TypeScript: 0 errors in all new/modified files
