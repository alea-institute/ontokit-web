---
phase: 14-inline-suggestion-ux-property-support
plan: 01
subsystem: api, state
tags: [zustand, typescript, llm, suggestions, api-client, hooks]

requires:
  - phase: 14-00
    provides: Wave 0 test stubs for generation API, suggestion store, and hook
  - phase: 13-validation-guardrails-suggestion-generation
    provides: Backend generate-suggestions endpoint contract
  - phase: 11-roles-llm-abstraction-cost-controls
    provides: BYO key pattern (X-BYO-API-Key header), useLLMGate hook, api.post pattern
provides:
  - generationApi typed client for POST /projects/{id}/llm/generate-suggestions
  - useSuggestionStore Zustand store for ephemeral suggestion review state (pending/accepted/rejected)
  - useSuggestions hook wiring API -> store with abort and error handling
  - TypeScript types: GeneratedSuggestion, SuggestionType, Provenance, ValidationError, DuplicateCandidate
affects: [14-02, 14-03, 14-04]

tech-stack:
  added: []
  patterns: [ephemeral-zustand-store, abort-on-entity-change, store-key-format]

key-files:
  created:
    - lib/api/generation.ts
    - lib/stores/suggestionStore.ts
    - lib/hooks/useSuggestions.ts
  modified:
    - __tests__/lib/api/generation.test.ts
    - __tests__/lib/stores/suggestionStore.test.ts
    - __tests__/lib/hooks/useSuggestions.test.ts

key-decisions:
  - "Non-persisted Zustand store (no localStorage) since suggestions are session-ephemeral per D-13"
  - "Store key format entityIri::suggestionType enables per-section suggestion tracking"
  - "AbortController cleanup on entityIri change prevents stale suggestion responses from overwriting current entity"

patterns-established:
  - "Ephemeral store: create() without persist() for session-only data"
  - "Store key format: entityIri::suggestionType for composite keying"
  - "Abort-on-change: useEffect cleanup with AbortController ref for entity-scoped requests"

requirements-completed: [UX-04, UX-05, UX-06]

duration: 3min
completed: 2026-04-07
---

# Phase 14 Plan 01: Data Layer Summary

**Typed generation API client, ephemeral Zustand suggestion store, and useSuggestions hook with abort-on-entity-change lifecycle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-07T17:59:52Z
- **Completed:** 2026-04-07T18:02:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Generation API client with all TypeScript types matching backend schema (SuggestionType, Provenance, ValidationError, DuplicateCandidate, DuplicateVerdict)
- Ephemeral Zustand store tracking suggestion review state (pending/accepted/rejected) with entityIri::suggestionType composite keys
- useSuggestions hook encapsulating request-accept-reject-edit lifecycle with AbortController cleanup on entity change
- 17 passing tests (4 API + 9 store + 4 hook) replacing Wave 0 stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generation API client with TypeScript types** - `a90ec39` (feat)
2. **Task 2: Create suggestion Zustand store and useSuggestions hook** - `8924a0b` (feat)

## Files Created/Modified
- `lib/api/generation.ts` - Typed API client for POST /projects/{id}/llm/generate-suggestions with conditional BYO key header
- `lib/stores/suggestionStore.ts` - Non-persisted Zustand store for suggestion review state (setSuggestions, accept, reject, edit, clear, getPendingCount, getFirstPendingRef)
- `lib/hooks/useSuggestions.ts` - Hook wiring generationApi -> suggestionStore with AbortController, loading/error state, onAccepted callback
- `__tests__/lib/api/generation.test.ts` - 4 tests verifying request path, body shape, BYO key header, response shape
- `__tests__/lib/stores/suggestionStore.test.ts` - 9 tests for all store operations including pending count and clear semantics
- `__tests__/lib/hooks/useSuggestions.test.ts` - 4 tests for API integration, error handling, accept/reject flows

## Decisions Made
- Non-persisted Zustand store (no localStorage) since suggestions are session-ephemeral per D-13
- Store key format `entityIri::suggestionType` enables per-section suggestion tracking without key collisions
- AbortController cleanup on entityIri change prevents stale suggestion responses from overwriting current entity state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three data layer modules ready for downstream UI consumption in Plans 02-04
- Plan 02 (SuggestionCard + SuggestionPanel) can import useSuggestions and render StoredSuggestion items
- Plan 03/04 can use generationApi types and store selectors for inline suggestion UX

## Self-Check: PASSED

---
*Phase: 14-inline-suggestion-ux-property-support*
*Completed: 2026-04-07*
