---
phase: "12"
plan: "03"
subsystem: ontokit-api
tags: [embeddings, duplicate-detection, webhook, startup, cross-branch, semantic-search]
dependency_graph:
  requires: ["12-01"]
  provides: ["semantic_search_all_branches", "check_and_trigger_embedding_rebuilds", "cleanup_merged_branch_embeddings"]
  affects: ["12-04"]
tech_stack:
  added: []
  patterns: ["lazy-import patching for unit tests", "ARQ job dedup guard", "async_session_maker context manager"]
key_files:
  created:
    - ../ontokit-api/ontokit/services/startup_checks.py
  modified:
    - ../ontokit-api/ontokit/services/embedding_service.py
    - ../ontokit-api/ontokit/schemas/embeddings.py
    - ../ontokit-api/ontokit/services/pull_request_service.py
    - ../ontokit-api/ontokit/main.py
    - ../ontokit-api/tests/unit/test_embedding_rebuild.py
decisions:
  - "EmbeddingService lazy imports (from ontokit.services.embedding_service import EmbeddingService inside function body) require patching at the source module level, not the call site"
  - "get_arq_pool patched at ontokit.api.utils.redis.get_arq_pool for both webhook and startup tests"
  - "Test mocks use plain async def functions rather than AsyncMock.side_effect to avoid coroutine-awaiting ambiguity"
metrics:
  duration: 30
  completed: "2026-04-06"
  tasks: 2
  files: 6
requirements: [DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-08]
---

# Phase 12 Plan 03: Cross-Branch Embedding Infrastructure Summary

Extended embedding infrastructure for all-branch duplicate detection: cross-branch semantic search, webhook-triggered ANN rebuild, startup freshness check, and stale branch cleanup.

## What Was Built

**Task 1 — EmbeddingService extensions:**
- `SemanticSearchResultWithBranch` schema added to `ontokit/schemas/embeddings.py` — extends `SemanticSearchResult` with a `branch` field for cross-branch results
- `semantic_search_all_branches()` method on `EmbeddingService` — queries across ALL branches for a project (no branch filter) to catch parallel work collisions (DEDUP-08)
- `cleanup_merged_branch_embeddings()` method — deletes embeddings for a merged/deleted branch to prevent stale entries from appearing in all-branch queries

**Task 2 — Webhook rebuild, startup check, tests:**
- `PullRequestService.handle_github_pr_webhook()` extended: on PR merge, (a) cleans up merged-branch embeddings and (b) enqueues a rebuild job for the default branch with an active-job dedup guard (DEDUP-03, D-04)
- `ontokit/services/startup_checks.py` created: `check_and_trigger_embedding_rebuilds()` handles two cases — first-time full embed (zero embeddings, DEDUP-01) and stale index rebuild (auto_embed_on_save=True + >24h threshold, D-05)
- `ontokit/main.py` lifespan updated to call startup check after MinIO init
- All 5 test stubs in `tests/unit/test_embedding_rebuild.py` implemented and passing

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Cross-branch search + cleanup | e4f8a71 | embedding_service.py, schemas/embeddings.py |
| Task 2: Webhook + startup + tests | bcaf00d | pull_request_service.py, main.py, startup_checks.py, test_embedding_rebuild.py |

## Deviations from Plan

None — plan executed exactly as written.

The plan noted potential ambiguity in `async_session` naming. Confirmed `ontokit.core.database` exports `async_session_maker` (not `async_session`), and implemented accordingly.

## Key Design Decisions

- **Test mocking pattern**: `AsyncMock.side_effect` with a plain `async def` function returns the value directly when awaited (unlike returning `AsyncMock(return_value=x)()` which creates a nested coroutine), avoiding `AttributeError: 'coroutine' object has no attribute 'scalar'`
- **Lazy import patching**: EmbeddingService and get_arq_pool are imported inside function bodies in the webhook handler. Tests patch at `ontokit.services.embedding_service.EmbeddingService` and `ontokit.api.utils.redis.get_arq_pool` — the source module attribute — not at the call-site module
- **First-time embed**: Triggers regardless of `auto_embed_on_save` — the field only governs the stale-rebuild check, not first-time initialization

## Self-Check

### Created files exist:
- `/home/damienriehl/Coding Projects/ontokit-api/ontokit/services/startup_checks.py` — FOUND

### Commits exist:
- `e4f8a71` — FOUND (feat(12-03): add cross-branch semantic search and branch cleanup to EmbeddingService)
- `bcaf00d` — FOUND (feat(12-03): wire webhook rebuild trigger, startup freshness check, implement tests)

## Self-Check: PASSED
