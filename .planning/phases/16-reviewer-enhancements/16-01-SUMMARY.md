---
phase: 16-reviewer-enhancements
plan: "01"
subsystem: api-client
tags: [api, types, suggestions, review, tdd]
dependency_graph:
  requires: []
  provides:
    - lib/api/suggestions.ts::EntityReviewMetadata
    - lib/api/suggestions.ts::ShardReviewInfo
    - lib/api/suggestions.ts::SessionDetailResponse
    - lib/api/suggestions.ts::ShardReviewMark
    - lib/api/suggestions.ts::ShardReviewsRequest
    - lib/api/suggestions.ts::CleanPRRequest
    - lib/api/suggestions.ts::CleanPRResponse
    - lib/api/suggestions.ts::suggestionsApi.getSessionDetail
    - lib/api/suggestions.ts::suggestionsApi.postShardReviews
    - lib/api/suggestions.ts::suggestionsApi.createCleanPR
  affects:
    - plans 16-02 and 16-03 (UI components consume these types and API methods)
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN) with vi.mock for api client
    - Type import pattern: import type { Provenance, DuplicateCandidate } from "./generation"
key_files:
  created:
    - __tests__/lib/api/suggestionReviewApi.test.ts
  modified:
    - lib/api/suggestions.ts
decisions:
  - Imported Provenance and DuplicateCandidate from ./generation (not redefined) to keep types DRY
  - postShardReviews returns api.post<void> — backend stores metadata, no response body needed
  - CleanPRResponse mirrors BatchSubmitPRResult shape (pr_number, pr_url, github_pr_url) for consistency
metrics:
  duration_minutes: 1
  completed_date: "2026-04-08"
  tasks_completed: 1
  files_modified: 2
---

# Phase 16 Plan 01: API Types and Methods for Enriched Review Summary

**One-liner:** 7 new exported types + 3 new `suggestionsApi` methods for enriched session detail, per-shard review marking, and clean PR creation — the data contract for all Phase 16 UI components.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add enriched review types and API methods to suggestions.ts (TDD) | 1e17916 | lib/api/suggestions.ts, __tests__/lib/api/suggestionReviewApi.test.ts |

## What Was Built

Extended `lib/api/suggestions.ts` with the data contract that Plans 02 and 03 depend on:

**New types (all exported):**
- `EntityReviewMetadata` — per-entity provenance, confidence, shard membership, duplicate candidates
- `ShardReviewInfo` — shard id, label, and entity IRI list for tab navigator
- `SessionDetailResponse` — top-level enriched session response (entities + shards)
- `ShardReviewMark` — single shard review decision (approved/rejected + optional feedback)
- `ShardReviewsRequest` — request body wrapping an array of `ShardReviewMark`
- `CleanPRRequest` — approved shard IDs for clean PR creation
- `CleanPRResponse` — pr_number, pr_url, github_pr_url

**New API methods (inside `suggestionsApi`):**
- `getSessionDetail(projectId, sessionId, token)` — GET `.../suggestions/sessions/{id}/detail`
- `postShardReviews(projectId, sessionId, data, token)` — POST `.../suggestions/sessions/{id}/shard-reviews`
- `createCleanPR(projectId, sessionId, data, token)` — POST `.../suggestions/sessions/{id}/clean-pr`

All three methods pass `Authorization: Bearer {token}` headers (T-16-01, T-16-02 mitigations).

## Test Results

- 8 new tests, all passing
- Full suite: 17 passed, 2 skipped (no regressions)
- TypeScript type-check: 0 errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan defines types and API calls only; no UI rendering, no hardcoded data.

## Threat Surface Scan

No new network endpoints introduced on the frontend. All three methods call existing backend endpoints via the established `api.get`/`api.post` pattern with Authorization headers. Threat mitigations T-16-01 through T-16-04 are satisfied: all methods include `Authorization: Bearer` headers, backend enforces role checks.

## Self-Check

Files exist:
- `lib/api/suggestions.ts` — modified (contains all 7 new types and 3 new methods)
- `__tests__/lib/api/suggestionReviewApi.test.ts` — created (8 tests, all green)

Commit exists: `1e17916`
