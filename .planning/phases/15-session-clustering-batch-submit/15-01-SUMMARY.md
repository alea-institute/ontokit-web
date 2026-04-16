---
phase: 15-session-clustering-batch-submit
plan: 1
subsystem: data-layer
tags: [zustand, store, api-client, clustering, tdd]
dependency_graph:
  requires: [15-00]
  provides: [shardPreviewStore, suggestionsApi-cluster-batchSubmit]
  affects: [15-02, 15-03, 15-04]
tech_stack:
  added: []
  patterns: [non-persisted-zustand-store, single-set-atomicity, tdd-red-green]
key_files:
  created:
    - lib/stores/shardPreviewStore.ts
    - __tests__/lib/stores/shardPreviewStore.test.ts
    - __tests__/lib/api/clusterApi.test.ts
  modified:
    - lib/api/suggestions.ts
decisions:
  - shardPreviewStore has no persist middleware — plan is session-ephemeral, computed fresh from each cluster API response
  - All mutations use single set() call for atomic CLUSTER-05 entity-uniqueness enforcement
  - ClusterResponse type defined in suggestions.ts (not shardPreviewStore.ts) so the API layer owns the wire format; store imports from there
  - computeSuggestionCount helper keeps PR group suggestionCount in sync without a derived selector
  - Expand/collapse defaults: collapsed when totalShards > 3 to avoid overwhelming the UI on large sessions
metrics:
  duration_minutes: 8
  completed_date: "2026-04-07T23:38:23Z"
  tasks_completed: 2
  files_changed: 4
requirements:
  - CLUSTER-01
  - CLUSTER-02
  - CLUSTER-03
  - CLUSTER-04
  - CLUSTER-05
  - CLUSTER-07
  - CLUSTER-08
---

# Phase 15 Plan 01: Data Layer — ShardPreviewStore + Cluster API

**One-liner:** Ephemeral Zustand shard plan store with atomic mutations and suggestionsApi extended with cluster/batchSubmit endpoints and typed request/response contracts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create shardPreviewStore with atomic mutations | 8beadc3 | lib/stores/shardPreviewStore.ts, __tests__/lib/stores/shardPreviewStore.test.ts |
| 2 | Extend suggestionsApi with cluster() and batchSubmit() | 0efb0f8 | lib/api/suggestions.ts, __tests__/lib/api/clusterApi.test.ts |

## What Was Built

### lib/stores/shardPreviewStore.ts

Non-persisted Zustand store (matching `suggestionStore.ts` pattern — `create<State>()((set, get) => ({...}))`).

Exports:
- `ShardDefinition` — shard record with id, label, ancestorPath, entityIris, isMisc, isCrossCutting
- `PRGroupDefinition` — PR group record with id, shardIds, suggestionCount (cached sum)
- `useShardPreviewStore` — the Zustand hook

Mutations (all single `set()` call for CLUSTER-05 atomicity):
- `setFromClusterResponse(response)` — hydrates from `ClusterResponse`; PR groups and shards start collapsed if totalShards > 3
- `moveEntity(iri, fromId, toId)` — removes from source, adds to target, recomputes PR group counts
- `mergeShards(sourceId, targetId)` — combines entityIris into target, deletes source shard, updates PR group
- `splitShard(shardId, iris, label)` — creates new shard via `crypto.randomUUID()`, removes IRIs from original, adds to same PR group
- `moveShard(shardId, fromPrId, toPrId)` — transfers shard between PR groups, recomputes both counts

### lib/api/suggestions.ts (extended)

New types added above `suggestionsApi`:
- `ClusterSuggestionItem`, `ClusterRequest` — cluster endpoint request
- `ClusterShard`, `ClusterPRGroup`, `ClusterResponse` — cluster endpoint response
- `BatchSubmitShard`, `BatchSubmitPRGroup`, `BatchSubmitRequest` — batch submit request
- `BatchSubmitPRResult`, `BatchSubmitResponse` — batch submit response

New methods on `suggestionsApi`:
- `cluster(projectId, sessionId, data, token)` — POST `/suggestions/sessions/{id}/cluster`
- `batchSubmit(projectId, sessionId, data, token)` — POST `/suggestions/sessions/{id}/batch-submit`

Both follow the existing `Authorization: Bearer {token}` pattern of all other suggestionsApi methods.

## Test Results

```
Test Files  12 passed (12)
Tests      118 passed (118)
```

- shardPreviewStore.test.ts: 11 tests — covers CLUSTER-01 through CLUSTER-08, entity uniqueness post-move, total count invariant
- clusterApi.test.ts: 4 tests — verifies URL pattern, Authorization header, typed response shapes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All methods are fully implemented. The `ClusterResponse` wire format matches exactly what the backend clustering endpoint will return (per 15-RESEARCH.md).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-15-02 mitigated | lib/api/suggestions.ts | Both cluster() and batchSubmit() require `token` param passed as `Authorization: Bearer {token}` — same pattern as all existing suggestionsApi methods |

T-15-01 (backend validates entity IRIs belong to session) is a backend concern; frontend only forwards IRIs received from the cluster response.

## Self-Check: PASSED

- lib/stores/shardPreviewStore.ts: FOUND
- lib/api/suggestions.ts (with cluster + batchSubmit): FOUND
- __tests__/lib/stores/shardPreviewStore.test.ts (0 it.skip): FOUND
- __tests__/lib/api/clusterApi.test.ts (0 it.skip): FOUND
- Commit 8beadc3: FOUND (feat(15-01): create shardPreviewStore)
- Commit 0efb0f8: FOUND (feat(15-01): extend suggestionsApi)
- All 118 tests pass: CONFIRMED
- npm run type-check: PASSES
