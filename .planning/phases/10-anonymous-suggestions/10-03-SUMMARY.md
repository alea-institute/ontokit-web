---
phase: 10-anonymous-suggestions
plan: 03
subsystem: ui
tags: [anonymous-suggestions, react, nextjs, zustand, classdetailpanel, editor]

requires:
  - phase: 10-anonymous-suggestions
    plan: 02
    provides: useAnonymousSuggestion hook, CreditModal, anonymousSuggestionsApi, token stores
  - phase: 10-anonymous-suggestions
    plan: 01
    provides: Backend anonymous suggestion endpoints, is_anonymous on SuggestionSessionSummary

provides:
  - "Propose Edit" button (emerald) on ClassDetailPanel for anonymous users when AUTH_MODE != required
  - Anonymous proposal mode wired end-to-end in editor page orchestrator
  - CreditModal pre-submit flow: opens before submitSession(), passes name/email
  - is_anonymous badge in suggestion review page list and detail views
  - isAnonymousProposalMode flag gates: canEdit=true, isSuggestionMode=true for form editing
  - "Sign in for full editing" alongside "Propose Edit" when Zitadel is configured

affects: [suggestion-review-ui, anonymous-suggestion-e2e, ontokit-api-integration]

tech-stack:
  added: []
  patterns:
    - "canPropose = authMode !== required && !canEdit && !isSuggester — anonymous proposal is a third edit tier below suggester"
    - "isAnonymousProposalMode = canPropose && anonymousSuggestion.isActive — mode only active after session started"
    - "CreditModal opens pre-submit (not post-submit) — credit info is passed with submitSession() in one call"
    - "Anonymous mode overrides canEdit/isSuggestionMode to true in layout props — reuses existing form editing infrastructure"

key-files:
  created: []
  modified:
    - components/editor/ClassDetailPanel.tsx
    - components/editor/developer/DeveloperEditorLayout.tsx
    - components/editor/standard/StandardEditorLayout.tsx
    - app/projects/[id]/editor/page.tsx
    - app/projects/[id]/suggestions/review/page.tsx
    - lib/api/suggestions.ts

key-decisions:
  - "canPropose evaluated AFTER canEdit and isSuggester to ensure signed-in editors always see their existing buttons (ANON-06 preserved)"
  - "CreditModal opens BEFORE submitSession() — credit info is included in the API call, not stored after the fact"
  - "isAnonymousProposalMode overrides layout canEdit=true and isSuggestionMode=true — reuses existing form-based editing infrastructure without new code paths"
  - "showSignInToEdit suppressed when canPropose is true — avoids showing both 'Propose Edit' and 'Sign in to edit' unless Zitadel is configured (ANON-07)"

patterns-established:
  - "Three-tier edit access: canEdit (direct commit) > isSuggestionMode (branch suggestion) > canPropose (anonymous proposal)"

requirements-completed: [ANON-01, ANON-06, ANON-07]

duration: 9min
completed: 2026-04-03
---

# Phase 10 Plan 03: Anonymous Suggestion UI Wiring Summary

**"Propose Edit" emerald button + anonymous proposal mode in editor orchestrator with pre-submit CreditModal and Anonymous badge in review queue**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-03T22:52:31Z
- **Completed:** 2026-04-03T23:01:32Z
- **Tasks:** 2 (+ 1 checkpoint pending human verification)
- **Files modified:** 6

## Accomplishments

- Anonymous visitors see a distinct emerald "Propose Edit" button on ClassDetailPanel when AUTH_MODE is optional or disabled
- Clicking "Propose Edit" starts an anonymous session and enables form-based editing (same infrastructure as suggester mode)
- "Sign in for full editing" appears alongside "Propose Edit" when Zitadel is configured, honoring ANON-07
- Submitting opens a CreditModal pre-submit so name/email is included in the API call (not retrofitted)
- Review page shows "Anonymous" badge and falls back to "Anonymous" for sessions without submitter info

## Task Commits

1. **Task 1: Add "Propose Edit" button + anonymous mode props to ClassDetailPanel and layouts** - `1a280ce` (feat)
2. **Task 2: Wire anonymous suggestion mode in editor page + update review page** - `11a1f75` (feat)

## Files Created/Modified

- `components/editor/ClassDetailPanel.tsx` — Added canPropose, onProposeEdit, isAnonymousProposalMode props; emerald "Propose Edit" button; "Sign in for full editing" alongside it
- `components/editor/developer/DeveloperEditorLayout.tsx` — Added canPropose/onProposeEdit/isAnonymousProposalMode to props interface and ClassDetailPanel pass-through
- `components/editor/standard/StandardEditorLayout.tsx` — Same props threading as DeveloperEditorLayout
- `app/projects/[id]/editor/page.tsx` — Added useAnonymousSuggestion hook, canPropose/isAnonymousProposalMode logic, handleProposeEdit/handleAnonymousClassUpdate/handleAnonymousSubmit, CreditModal integration, "Proposing" indicator + Submit Proposal/Discard buttons in header
- `app/projects/[id]/suggestions/review/page.tsx` — is_anonymous badge in session list and detail "Submitted by" section; fallback text "Anonymous"
- `lib/api/suggestions.ts` — Added is_anonymous?: boolean to SuggestionSessionSummary type

## Decisions Made

- **Pre-submit credit flow:** CreditModal opens when user clicks "Submit Proposal" (not after). This ensures name/email is passed directly to `submitSession()` in a single API call, rather than trying to update a session post-submit.
- **isAnonymousProposalMode overrides canEdit/isSuggestionMode:** Rather than building new form-editing code paths, anonymous proposal mode passes `canEdit=true, isSuggestionMode=true` to layout components — this reuses all existing suggestion-mode form infrastructure (AnnotationRow blur saves, AutoSaveAffordanceBar, etc.).
- **showSignInToEdit suppressed when canPropose:** Avoids showing redundant "Sign in to edit" button when "Propose Edit" is already shown. The "Sign in for full editing" variant only renders inline alongside "Propose Edit" when Zitadel is configured.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new environment variables or external services required. Behavior is gated on existing NEXT_PUBLIC_AUTH_MODE env var.

## Next Phase Readiness

- E2E anonymous suggestion flow is code-complete and awaiting human verification (Task 3 checkpoint)
- The human verifier needs AUTH_MODE=optional configured on both ontokit-api and ontokit-web
- After checkpoint approval, Phase 10 is complete

---
*Phase: 10-anonymous-suggestions*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: components/editor/ClassDetailPanel.tsx
- FOUND: app/projects/[id]/editor/page.tsx
- FOUND: app/projects/[id]/suggestions/review/page.tsx
- FOUND: .planning/phases/10-anonymous-suggestions/10-03-SUMMARY.md
- FOUND commit: 1a280ce (Task 1)
- FOUND commit: 11a1f75 (Task 2)
- TypeScript: 0 errors in all modified files
- ESLint: 0 errors
