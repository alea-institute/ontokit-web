---
phase: 12-toolchain-integration-duplicate-detection
plan: "00"
subsystem: testing
tags: [folio-python, pytest, wave-0-stubs, duplicate-detection, structural-similarity, embeddings, reasoner]

# Dependency graph
requires: []
provides:
  - folio-python dependency installed in ontokit-api venv (TOOL-05)
  - 18 Wave 0 pytest skip stubs across 4 test files (all Phase 12 plans)
  - test_structural_similarity.py — 4 stubs for Plans 01/02 (TOOL-01, TOOL-02)
  - test_duplicate_check.py — 7 stubs for Plan 04 (DEDUP-04 through DEDUP-08)
  - test_embedding_rebuild.py — 4 stubs for Plans 01/03 (DEDUP-01, DEDUP-02, DEDUP-03)
  - test_reasoner_validation.py — 3 stubs for Plan 02 (TOOL-03, TOOL-04)
affects: [12-01, 12-02, 12-03, 12-04]

# Tech tracking
tech-stack:
  added: [folio-python==0.3.3, lxml==6.0.2]
  patterns:
    - Wave 0 stubs use @pytest.mark.skip(reason="Wave 0 stub — implementation in Plan XX") pattern
    - Stub files are named after the service area (structural_similarity, duplicate_check, embedding_rebuild, reasoner_validation)

key-files:
  created:
    - tests/unit/test_structural_similarity.py
    - tests/unit/test_duplicate_check.py
    - tests/unit/test_embedding_rebuild.py
    - tests/unit/test_reasoner_validation.py
  modified:
    - pyproject.toml
    - uv.lock

key-decisions:
  - "Wave 0 stubs created before implementation so downstream plans can run pytest --co without discovery failures (Nyquist compliance pattern)"
  - "folio-python 0.3.3 installed via uv add — lxml pulled as transitive dependency"

patterns-established:
  - "Wave 0 stub pattern: @pytest.mark.skip(reason='Wave 0 stub — implementation in Plan XX') with descriptive docstring"

requirements-completed: [TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04, DEDUP-05, DEDUP-06, DEDUP-07, DEDUP-08]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 12 Plan 00: Wave 0 — folio-python install and test stubs Summary

**folio-python 0.3.3 installed in ontokit-api venv and 18 pytest skip stubs created across 4 test files covering all Phase 12 requirements**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T21:30:15Z
- **Completed:** 2026-04-06T21:31:35Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- folio-python>=0.3.3 added to pyproject.toml and installed via `uv add` (TOOL-05 — `from folio.graph import FOLIO` succeeds)
- 18 skip-marked Wave 0 test stubs created across 4 files, all discoverable by pytest
- Stub counts match plan exactly: 4 + 7 + 4 + 3 = 18 tests collected

## Task Commits

Each task was committed atomically:

1. **Task 1: Install folio-python and create test stubs** - `66978da` (chore)

**Plan metadata:** (pending this commit)

## Files Created/Modified

- `tests/unit/test_structural_similarity.py` - 4 skip stubs for TOOL-01 (Jaccard structural similarity) and TOOL-02 (OpenGloss extraction), implemented in Plan 02
- `tests/unit/test_duplicate_check.py` - 7 skip stubs for DEDUP-04 through DEDUP-08 composite scoring (weights, thresholds, all-branch scope, rejection history, response schema), implemented in Plan 04
- `tests/unit/test_embedding_rebuild.py` - 4 skip stubs for DEDUP-01/02/03 (HNSW index migration, all-branch search, webhook rebuild trigger, startup freshness check), implemented in Plans 01/03
- `tests/unit/test_reasoner_validation.py` - 3 skip stubs for TOOL-03 (owlready2 load + cycle detection) and TOOL-04 (pre-commit validation endpoint), implemented in Plan 02
- `pyproject.toml` - Added `folio-python>=0.3.3` to project dependencies
- `uv.lock` - Updated lockfile with folio-python==0.3.3 + lxml==6.0.2 (transitive)

## Decisions Made

- folio-python installed with `uv add` (not pinned, floor version used) — consistent with other dependencies in pyproject.toml
- lxml 6.0.2 pulled as a transitive dependency of folio-python — no conflicts with existing deps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

All files in this plan ARE intentional stubs — this is Wave 0's explicit purpose. Each stub is marked `@pytest.mark.skip` and will be implemented by the plan referenced in the skip reason. These stubs exist to ensure downstream plans have test files ready before they implement code (Nyquist compliance).

## Next Phase Readiness

- All 4 test stub files exist and are discoverable by pytest
- folio-python is importable from the ontokit-api venv
- Plans 01-04 can run `pytest tests/unit/test_*.py --co -q` without discovery failures
- Plan 01 (embeddings + HNSW migration) is unblocked

---
*Phase: 12-toolchain-integration-duplicate-detection*
*Completed: 2026-04-06*
