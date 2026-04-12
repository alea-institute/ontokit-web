---
phase: 12
slug: toolchain-integration-duplicate-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), vitest (frontend) |
| **Config file** | `../ontokit-api/pyproject.toml`, `vitest.config.ts` |
| **Quick run command** | `cd ../ontokit-api && python -m pytest tests/unit/ -q --tb=short` |
| **Full suite command** | `cd ../ontokit-api && python -m pytest tests/ -q --tb=short && cd ../ontokit-web && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick backend tests
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-00-01 | 00 | 1 | ALL | stub | `pytest tests/unit/test_duplicate_*.py --co -q` | ❌ W0 | ⬜ pending |
| 12-01-01 | 01 | 2 | TOOL-01 | unit | `pytest tests/unit/test_folio_integration.py -q` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | DEDUP-01,02 | unit | `pytest tests/unit/test_embedding_index.py -q` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | DEDUP-04-08 | unit | `pytest tests/unit/test_duplicate_scoring.py -q` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 3 | DEDUP-03 | unit | `pytest tests/unit/test_webhook_rebuild.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_folio_integration.py` — stubs for TOOL-01, TOOL-02
- [ ] `tests/unit/test_duplicate_scoring.py` — stubs for DEDUP-04 through DEDUP-08
- [ ] `tests/unit/test_embedding_index.py` — stubs for DEDUP-01, DEDUP-02
- [ ] `tests/unit/test_webhook_rebuild.py` — stubs for DEDUP-03
- [ ] `uv add folio-python` — install dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ANN index lookup <200ms | DEDUP-02 | Depends on production data volume | Run benchmark against 18K+ entity index |
| Webhook fires after merge | DEDUP-03 | Requires GitHub webhook delivery | Merge a test PR, verify rebuild job enqueued |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
