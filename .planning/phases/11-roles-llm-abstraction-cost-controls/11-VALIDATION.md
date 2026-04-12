---
phase: 11
slug: roles-llm-abstraction-cost-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend Framework** | Vitest (jsdom), config at `vitest.config.ts` |
| **Backend Framework** | pytest + pytest-asyncio, config in `pyproject.toml` |
| **Frontend quick run** | `npm run test` |
| **Frontend full suite** | `npm run test:coverage` |
| **Backend quick run** | `cd ../ontokit-api && uv run pytest tests/unit/test_llm_*.py -x -q` |
| **Backend full suite** | `cd ../ontokit-api && uv run pytest --cov=ontokit` |
| **Estimated runtime** | ~15 seconds (frontend) + ~10 seconds (backend unit) |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest tests/unit/test_llm_*.py -x -q` (backend) + `npm run test` (frontend)
- **After every plan wave:** Run `uv run pytest --cov=ontokit` + `npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | LLM-01 | unit | `pytest tests/unit/test_llm_config.py::test_config_round_trip -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | LLM-02 | unit | `pytest tests/unit/test_llm_config.py::test_api_key_encrypted -x` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | LLM-03 | unit | `pytest tests/unit/test_llm_config.py::test_byo_key_not_stored -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | COST-03 | unit | `pytest tests/unit/test_llm_rate_limit.py::test_editor_rate_limit -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | COST-04 | unit | `pytest tests/unit/test_llm_rate_limit.py::test_suggester_rate_limit -x` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 1 | COST-07 | unit | `pytest tests/unit/test_llm_budget.py::test_byo_excluded_from_budget -x` | ❌ W0 | ⬜ pending |
| 11-02-04 | 02 | 1 | COST-02 | unit | `pytest tests/unit/test_llm_budget.py::test_budget_exhaustion_402 -x` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 1 | ROLE-05 | unit | `pytest tests/unit/test_llm_role_gates.py::test_anonymous_blocked -x` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 1 | LLM-07 | unit | `pytest tests/unit/test_llm_audit.py::test_audit_log_written -x` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | LLM-01 | unit | `npm run test -- byoKeyStore` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 2 | ROLE-05 | unit | `npm run test -- useLLMGate` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ontokit-api/tests/unit/test_llm_config.py` — stubs for LLM-01, LLM-02, LLM-03
- [ ] `ontokit-api/tests/unit/test_llm_rate_limit.py` — stubs for COST-03, COST-04
- [ ] `ontokit-api/tests/unit/test_llm_budget.py` — stubs for COST-01, COST-02, COST-07
- [ ] `ontokit-api/tests/unit/test_llm_role_gates.py` — stubs for ROLE-01 through ROLE-05
- [ ] `ontokit-api/tests/unit/test_llm_audit.py` — stubs for LLM-07
- [ ] `ontokit-web/__tests__/lib/stores/byoKeyStore.test.ts` — BYO key store
- [ ] `ontokit-web/__tests__/lib/hooks/useLLMGate.test.ts` — LLM gate hook

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider dropdown shows logos | D-11 | Visual | Open project settings > AI/LLM section, verify dropdown shows provider names with logos |
| Budget exhaustion banner | D-16, COST-02 | Visual + state | Exhaust budget, verify disabled buttons + banner in editor header |
| BYO key popover on first action | D-13 | Interaction | Clear BYO key, trigger LLM action, verify popover appears |
| Usage dashboard summary bar | D-15, COST-05 | Visual | Open usage tab, verify summary bar + per-user table |
| Self-merge confirmation dialog | D-20 | Interaction | As admin, click merge, verify confirmation dialog appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
