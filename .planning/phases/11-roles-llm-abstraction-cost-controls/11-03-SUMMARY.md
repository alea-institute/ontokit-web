---
phase: 11-roles-llm-abstraction-cost-controls
plan: "03"
subsystem: api
tags: [llm, zustand, react-query, typescript, byo-key, cost-controls]

# Dependency graph
requires:
  - phase: 11-roles-llm-abstraction-cost-controls
    provides: test stubs scaffolded in plan 00 that prevent test-discovery failures downstream
provides:
  - LLM API client (llmApi) with 7 endpoint methods and full TypeScript type definitions
  - BYO key Zustand persist store (useByoKeyStore) with localStorage keyed by projectId
  - useLLMConfig hook: React Query config management + test connection mutation
  - useLLMUsage hook: usage dashboard data with 60s auto-refresh
  - useLLMGate hook: combines role + session + status into canUseLLM access decision
affects:
  - 11-04 (LLM settings UI consumes llmApi, useLLMConfig, useByoKeyStore directly)
  - 11-05 (cost controls UI consumes useLLMUsage, useLLMGate)
  - any plan that needs to gate LLM feature availability

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LLM API client follows embeddings.ts pattern: typed exports + named api object with method functions"
    - "BYO key store uses Zustand persist with createJSONStorage(() => localStorage) — consistent with draftStore"
    - "useLLMGate is advisory: canUseLLM drives UI; actual enforcement at backend dispatch endpoint"
    - "402 response consumers should call invalidateStatus() to refresh gate state"

key-files:
  created:
    - lib/api/llm.ts
    - lib/stores/byoKeyStore.ts
    - lib/hooks/useLLMConfig.ts
    - lib/hooks/useLLMUsage.ts
    - lib/hooks/useLLMGate.ts
  modified:
    - lib/api/client.ts

key-decisions:
  - "BYO key never sent to backend for storage — only forwarded as X-BYO-API-Key header per-request (D-05)"
  - "useLLMGate is advisory frontend only; canUseLLM false for anonymous users always regardless of status"
  - "getRoleLimitLabel returns role-specific daily limit strings for LLMRoleBadge UI component"

patterns-established:
  - "LLM gate pattern: combine !isAnonymous + role check + status.configured + !budget_exhausted"
  - "BYO key store: entries keyed by projectId, validatedAt tracks last successful connection test"

requirements-completed: [LLM-03, LLM-04]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 11 Plan 03: LLM Frontend Data Layer Summary

**Full LLM frontend data layer: 13-provider type union, 7-endpoint API client, BYO-key localStorage store, and three React Query hooks (config, usage, gate) driving all LLM UI enable/disable decisions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T15:43:56Z
- **Completed:** 2026-04-06T15:45:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `lib/api/llm.ts` with LLMProviderType union (13 providers), 7 response/request interfaces, and `llmApi` with 7 endpoint methods including X-BYO-API-Key header forwarding
- Created `lib/stores/byoKeyStore.ts` with Zustand persist store keyed by projectId; stores provider + key + validatedAt; persisted as `"ontokit-byo-keys"` in localStorage
- Created three React Query hooks: `useLLMConfig` (config + update + test mutations), `useLLMUsage` (dashboard data + auto-refresh), `useLLMGate` (combined access gate with roleLimitLabel and invalidateStatus)
- Re-exported `llmApi` from `lib/api/client.ts` alongside existing API re-exports

## Task Commits

1. **Task 1: LLM API client and BYO key store** - `898812b` (feat)
2. **Task 2: useLLMConfig, useLLMUsage, useLLMGate hooks** - `48a9d4e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/api/llm.ts` - LLM API client with all types and 7 endpoint methods
- `lib/stores/byoKeyStore.ts` - Zustand persist store for BYO API keys
- `lib/hooks/useLLMConfig.ts` - React Query hook for LLM config management
- `lib/hooks/useLLMUsage.ts` - React Query hook for usage dashboard data
- `lib/hooks/useLLMGate.ts` - Access gate combining role + session + LLM status
- `lib/api/client.ts` - Added llmApi re-export

## Decisions Made

- BYO key is stored only in browser localStorage (`"ontokit-byo-keys"`), never persisted server-side — forwarded per-request as `X-BYO-API-Key` header only (per D-05/D-07)
- `useLLMGate` is advisory frontend-only — `canUseLLM` drives UI enable/disable but actual enforcement happens at backend dispatch endpoint; consumers should call `invalidateStatus()` on 402 response
- `canUseLLM` is `false` for anonymous users regardless of status response, consistent with project constraint "Anonymous users get no LLM access"

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — both type-checks passed on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete LLM frontend data layer ready for Plans 04 and 05 to consume
- Plan 04 (LLM settings UI) can import `llmApi`, `useLLMConfig`, `useByoKeyStore` directly
- Plan 05 (cost controls UI) can import `useLLMUsage`, `useLLMGate` directly
- No blockers

---
*Phase: 11-roles-llm-abstraction-cost-controls*
*Completed: 2026-04-06*
