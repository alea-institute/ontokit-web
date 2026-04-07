---
phase: 15
slug: session-clustering-batch-submit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-00-01 | 00 | 0 | CLUSTER-01..05,08 | — | N/A | unit stub | `npm run test -- --run __tests__/lib/stores/shardPreviewStore.test.ts` | ❌ W0 | ⬜ pending |
| 15-00-02 | 00 | 0 | CLUSTER-07 | — | N/A | unit stub | `npm run test -- --run __tests__/lib/api/clusterApi.test.ts` | ❌ W0 | ⬜ pending |
| 15-00-03 | 00 | 0 | CLUSTER-06 | — | N/A | unit stub | `npm run test -- --run __tests__/lib/hooks/useShardDragDrop.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/stores/shardPreviewStore.test.ts` — stubs for CLUSTER-01 through CLUSTER-05, CLUSTER-08
- [ ] `__tests__/lib/api/clusterApi.test.ts` — stubs for CLUSTER-07
- [ ] `__tests__/lib/hooks/useShardDragDrop.test.ts` — stubs for drag interaction unit tests

*Existing Vitest infrastructure covers all framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shard preview modal renders correctly with nested tree | CLUSTER-06 | Visual layout verification | Open editor, accept 6+ suggestions, click Submit, verify nested tree with PR groups and shards |
| Drag-and-drop entities between shards | CLUSTER-06 | DnD interaction requires browser | In shard preview, drag an entity from one shard to another, verify it moves |
| GitHub commit tab serves as shard navigator | CLUSTER-09 | Requires live GitHub PR | After batch submit, open the created PR on GitHub, verify commit tab shows one commit per shard |
| Step-by-step progress bar during PR creation | CLUSTER-07 | Visual/timing verification | Click Submit in preview, verify progress bar updates step by step |

---

## Coverage Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| No E2E test for full submit → PR creation flow | Medium | Manual UAT covers this; backend endpoint not yet built |
| CLUSTER-09 untestable without live GitHub | Low | Verified manually post-deployment |
