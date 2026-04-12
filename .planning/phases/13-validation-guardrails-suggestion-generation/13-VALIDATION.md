---
phase: 13
slug: validation-guardrails-suggestion-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x |
| **Config file** | `../ontokit-api/pyproject.toml` (pytest section) |
| **Quick run command** | `cd ../ontokit-api && source .venv/bin/activate && python -m pytest tests/unit/ -q --tb=short` |
| **Full suite command** | `cd ../ontokit-api && source .venv/bin/activate && python -m pytest tests/unit/ -v --tb=short` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/unit/ -q --tb=short`
- **After every plan wave:** Run `python -m pytest tests/unit/ -v --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-00-01 | 00 | 0 | GEN-*, VALID-* | unit stubs | `pytest tests/unit/test_suggestion_generation.py --co -q` | ❌ W0 | ⬜ pending |
| 13-01-01 | 01 | 1 | VALID-01..06 | unit | `pytest tests/unit/test_entity_validation.py -v` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | GEN-01..05 | unit | `pytest tests/unit/test_suggestion_generation.py -v` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | GEN-06..09 | unit | `pytest tests/unit/test_suggestion_generation.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_entity_validation.py` — stubs for VALID-01 through VALID-06
- [ ] `tests/unit/test_suggestion_generation.py` — stubs for GEN-01 through GEN-09
- [ ] Shared fixtures for LLM mock, ontology index mock, duplicate check mock

*Existing infrastructure (pytest, asyncio, ontokit-api test fixtures) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM output quality | GEN-01..05 | Requires subjective evaluation of LLM suggestion relevance | Review 5 generated suggestions for a known class, check they are domain-appropriate |
| Inline error UX | VALID-05 | Frontend rendering of validation errors | Phase 14 will test frontend display |

*All other behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
