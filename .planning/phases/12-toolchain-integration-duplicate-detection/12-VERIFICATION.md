---
phase: 12-toolchain-integration-duplicate-detection
verified: 2026-04-06T22:30:00Z
status: passed
score: 13/13 must-haves verified
gaps: []
human_verification:
  - test: "ANN index query latency under load"
    expected: "HNSW queries on entity_embeddings return in <200ms at 18K+ entities"
    why_human: "Requires production-scale data volume; cannot measure with unit tests"
  - test: "GitHub webhook delivers merge event in production"
    expected: "Merging a PR triggers embedding rebuild job via webhook; ARQ job appears in Redis queue"
    why_human: "Requires live GitHub webhook delivery and Redis inspection; cannot test offline"
---

# Phase 12: Toolchain Integration & Duplicate Detection Verification Report

**Phase Goal:** The backend can query the FOLIO graph, extract definitions from reference texts, check logical consistency, and tell any caller whether a proposed class/property is a duplicate of something already in the ontology.
**Verified:** 2026-04-06T22:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | folio-python is importable from the ontokit-api virtualenv (TOOL-05) | VERIFIED | `from folio.graph import FOLIO` succeeds in .venv; folio-python>=0.3.3 in pyproject.toml |
| 2 | A caller can compute parent/sibling Jaccard structural similarity via folio-python (TOOL-01) | VERIFIED | `StructuralSimilarityService.compute_similarity()` in structural_similarity_service.py; 4/4 unit tests pass |
| 3 | OpenGloss is stubbed with NotImplementedError pending package availability (TOOL-02) | VERIFIED | `GlossExtractionService.extract_glosses()` raises `NotImplementedError`; test confirms message contains "OpenGloss" |
| 4 | The OWL reasoner detects cycles and inconsistencies (TOOL-03) | VERIFIED | `ReasonerService.check_consistency()` uses RDFLib DFS for cycles + owlready2 HermiT for unsatisfiable classes; 4/4 tests pass |
| 5 | Pre-commit validation endpoint accepts optional OWL content for validating uncommitted state (TOOL-04) | VERIFIED | `POST /projects/{id}/validate` with optional `owl_content` body field; falls back to graph serialization when absent |
| 6 | HNSW ANN index exists on entity_embeddings for O(log n) similarity search (DEDUP-02) | VERIFIED | Alembic migration v9w0x1y2z3a4 creates `ix_entity_embeddings_hnsw` with vector_cosine_ops, m=16, ef_construction=64 |
| 7 | duplicate_rejections table stores rejection links with lookup index (DEDUP-05..07 data layer) | VERIFIED | `DuplicateRejection` model + migration; ix_duplicate_rejections_lookup index on (project_id, rejected_iri) |
| 8 | Embeddings are pre-computed for all existing classes/properties (DEDUP-01) | VERIFIED | `startup_checks.py` triggers first-time full embed for any project with EmbeddingConfig and zero embeddings |
| 9 | ANN index rebuilds automatically after each merge (DEDUP-03) | VERIFIED | `PullRequestService.handle_github_pr_webhook()` enqueues `run_embedding_generation_task` on PR merge with dedup guard |
| 10 | Duplicate check spans ALL branches, not just current (DEDUP-08) | VERIFIED | `EmbeddingService.semantic_search_all_branches()` has no branch filter in SQL; DuplicateCheckService calls it; test_all_branch_scope passes |
| 11 | Composite score >0.95 returns block, >0.80 returns warn, <=0.80 returns pass (DEDUP-04,05,06,07) | VERIFIED | `BLOCK_THRESHOLD=0.95`, `WARN_THRESHOLD=0.80`; 40/40/20 weights; 7/7 duplicate check tests pass covering all three verdict paths |
| 12 | Response includes verdict, composite_score, score_breakdown, and candidates with source/rejection history (DEDUP-04,06,07) | VERIFIED | `DuplicateCheckResponse` Pydantic schema; `ScoreBreakdown`, `DuplicateCandidate` with source/rejection_reason/canonical_iri |
| 13 | Rejecting a suggestion as duplicate creates a DuplicateRejection record with actual entity IRI | VERIFIED | `SuggestionService.reject()` creates `DuplicateRejection` with `data.entity_iri`; `SuggestionRejectRequest` has entity_iri + canonical_iri fields |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ontokit/services/structural_similarity_service.py` | StructuralSimilarityService with compute_similarity() and get_structural_context() | VERIFIED | 79 lines; `_folio_cache` dict for caching; Jaccard over parent sets; graceful 0.0 on failure |
| `ontokit/services/gloss_extraction_service.py` | GlossExtractionService stub with NotImplementedError | VERIFIED | 23 lines; raises NotImplementedError with "OpenGloss" in message |
| `ontokit/services/reasoner_service.py` | ReasonerService with check_consistency() and detect_cycles() | VERIFIED | 209 lines; RDFLib DFS for cycles + owlready2 HermiT for unsatisfiable classes; OWL/XML format auto-detection |
| `ontokit/api/routes/validation.py` | POST /projects/{id}/validate with optional owl_content body (TOOL-04) | VERIFIED | 73 lines; ValidateRequest.owl_content optional; pre-commit and post-commit paths both implemented |
| `ontokit/models/duplicate_rejection.py` | DuplicateRejection SQLAlchemy model | VERIFIED | 41 lines; all D-10 columns: id, project_id, rejected_iri, canonical_iri, rejection_reason, rejected_by, rejected_at, suggestion_session_id |
| `ontokit/schemas/duplicate_check.py` | DuplicateCheckRequest, DuplicateCheckResponse, ScoreBreakdown, DuplicateCandidate | VERIFIED | 80 lines; DuplicateVerdict Literal["block","warn","pass"]; CandidateSource Literal["main","pending","rejected"] |
| `alembic/versions/v9w0x1y2z3a4_add_hnsw_index_and_duplicate_rejections.py` | HNSW index migration + duplicate_rejections table | VERIFIED | hnsw + vector_cosine_ops + EXCEPTION WHEN graceful fallback; chains from u9v0w1x2y3a4 |
| `ontokit/services/embedding_service.py` (extended) | semantic_search_all_branches() + cleanup_merged_branch_embeddings() | VERIFIED | Both methods present at lines 541 and 605; no branch filter in all-branches SQL |
| `ontokit/schemas/embeddings.py` (extended) | SemanticSearchResultWithBranch schema | VERIFIED | Lines 77-85; extends base result with `branch: str` |
| `ontokit/services/startup_checks.py` | check_and_trigger_embedding_rebuilds() with stale and first-time checks | VERIFIED | 46 lines; STALE_THRESHOLD=24h; handles both zero-embeddings and stale-index cases |
| `ontokit/services/duplicate_check_service.py` | DuplicateCheckService with check(), _classify_source(), _get_rejection_info() | VERIFIED | 199 lines; EXACT_WEIGHT=0.40, SEMANTIC_WEIGHT=0.40, STRUCTURAL_WEIGHT=0.20; BLOCK=0.95, WARN=0.80 |
| `ontokit/api/routes/duplicate_check.py` | POST /projects/{id}/duplicate-check endpoint | VERIFIED | 41 lines; returns DuplicateCheckResponse; registered in routes/__init__.py |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `structural_similarity_service.py` | `folio.graph.FOLIO` | lazy import + module-level cache | WIRED | `from folio.graph import FOLIO` inside `_get_folio_instance()`; `python -c "from folio.graph import FOLIO"` succeeds |
| `reasoner_service.py` | `owlready2` | lazy import in check_consistency() | WIRED | `import owlready2` inside try block; ImportError falls back to rdflib_fallback |
| `validation.py` | `reasoner_service.py` | dependency injection via `Depends(get_reasoner_service)` | WIRED | `ReasonerService` injected; endpoint calls `reasoner.check_consistency(source_content)` |
| `duplicate_check_service.py` | `embedding_service.py` | `semantic_search_all_branches()` call | WIRED | Line 61: `await self._embedding_svc.semantic_search_all_branches(project_id, label, limit=limit)` |
| `duplicate_check_service.py` | `structural_similarity_service.py` | `compute_similarity()` call | WIRED | Line 88: `self._structural_svc.compute_similarity(sem_result.iri, parent_iri, max_depth=3)` |
| `duplicate_check_service.py` | `models/duplicate_rejection.py` | rejection history lookup | WIRED | Line 9: `from ontokit.models.duplicate_rejection import DuplicateRejection`; _get_rejection_info() queries by entity IRI |
| `routes/duplicate_check.py` | `duplicate_check_service.py` | direct instantiation | WIRED | Line 33: `service = DuplicateCheckService(db)` |
| `routes/__init__.py` | `validation.router` | include_router at line 57 | WIRED | `router.include_router(validation.router, tags=["Validation"])` |
| `routes/__init__.py` | `duplicate_check.router` | include_router at line 59 | WIRED | `router.include_router(duplicate_check.router, tags=["duplicate-check"])` |
| `pull_request_service.py` | `embedding_service.py` | lazy import on merge | WIRED | Lines 1532, 1570: `cleanup_merged_branch_embeddings` called then `run_embedding_generation_task` enqueued |
| `main.py` | `startup_checks.py` | lifespan startup call | WIRED | Lines 78-80: `from ontokit.services.startup_checks import check_and_trigger_embedding_rebuilds; await check_and_trigger_embedding_rebuilds()` |
| `models/__init__.py` | `duplicate_rejection.py` | import + __all__ | WIRED | Line 6: `from ontokit.models.duplicate_rejection import DuplicateRejection`; line 43 in __all__ |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `duplicate_check_service.py` | `semantic_candidates` | `EmbeddingService.semantic_search_all_branches()` — raw SQL against entity_embeddings | Yes — cosine distance over pgvector; no static returns | FLOWING |
| `duplicate_check_service.py` | `structural_score` | `StructuralSimilarityService.compute_similarity()` — folio-python FOLIO.get_parents() | Yes — Jaccard over FOLIO graph; returns 0.0 on unavailability (documented behavior) | FLOWING |
| `validation.py` | `source_content` | `request.owl_content` (pre-commit) or `load_project_graph() + serialize()` (fallback) | Yes — either caller-provided content or graph from git/storage | FLOWING |
| `startup_checks.py` | `embedding_count` | SQL `COUNT(*)` against entity_embeddings | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| folio-python importable | `python -c "from folio.graph import FOLIO; print('folio import OK')"` | folio import OK | PASS |
| All constants correct | Import DuplicateCheckService; assert EXACT_WEIGHT==0.40, SEMANTIC_WEIGHT==0.40, STRUCTURAL_WEIGHT==0.20, BLOCK_THRESHOLD==0.95, WARN_THRESHOLD==0.80 | ALL IMPORTS AND CONSTANTS OK | PASS |
| All 20 phase tests pass | `pytest test_duplicate_check.py test_structural_similarity.py test_reasoner_validation.py test_embedding_rebuild.py` | 20 passed | PASS |
| Full unit suite green | `pytest tests/unit/ -q --tb=short` | 162 passed, 14 skipped (pre-existing LLM skips) | PASS |
| Route registration | grep routes/__init__.py for validation and duplicate_check | Both routers present at lines 57 and 59 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOOL-01 | 12-02 | Backend calls folio-python for graph queries | SATISFIED | StructuralSimilarityService uses `folio.graph.FOLIO`; 3 tests verify Jaccard similarity |
| TOOL-02 | 12-02 | Backend integrates OpenGloss for definition extraction | SATISFIED (stub) | GlossExtractionService raises NotImplementedError with OpenGloss reference; requirement acknowledges package not yet available |
| TOOL-03 | 12-02 | Backend loads FOLIO OWL into reasoner for consistency checks | SATISFIED | ReasonerService uses RDFLib DFS + owlready2 HermiT; cycle detection and unsatisfiable class detection confirmed by tests |
| TOOL-04 | 12-02 | Reasoner validation runs after user accepts suggestions but before commit | SATISFIED | POST /projects/{id}/validate accepts owl_content for pre-commit validation; falls back to graph serialization when absent |
| TOOL-05 | 12-00 | Generative FOLIO installable as Python dependency | SATISFIED | folio-python>=0.3.3 in pyproject.toml; `from folio.graph import FOLIO` succeeds |
| DEDUP-01 | 12-03 | System pre-computes embeddings for all existing classes and properties | SATISFIED | startup_checks.py triggers first-time full embed for projects with EmbeddingConfig and zero embeddings |
| DEDUP-02 | 12-01/12-03 | Embeddings stored in ANN index for O(log n) similarity search | SATISFIED | Alembic migration creates HNSW index with vector_cosine_ops; graceful fallback for pgvector<0.5.0 |
| DEDUP-03 | 12-03 | ANN index rebuilt automatically after each merge to main branch | SATISFIED | PullRequestService enqueues run_embedding_generation_task on merged PR with active-job dedup guard |
| DEDUP-04 | 12-04 | Every LLM suggestion scored against ontology for exact + semantic + structural similarity | SATISFIED | DuplicateCheckService.check() computes all three scores; test_composite_score_weights verifies 40/40/20 weights |
| DEDUP-05 | 12-04 | Composite score >0.95 blocks submission | SATISFIED | BLOCK_THRESHOLD=0.95; test_exact_label_match_returns_block_verdict passes |
| DEDUP-06 | 12-04 | Composite score >0.80 shows warning with candidates | SATISFIED | WARN_THRESHOLD=0.80; test_semantic_similarity_warn_range passes |
| DEDUP-07 | 12-04 | Composite score <=0.80 passes silently | SATISFIED | test_below_threshold_passes_silently passes (composite=0.26 returns "pass") |
| DEDUP-08 | 12-03/12-04 | Duplicate check runs across the whole ontology, not just local neighborhood | SATISFIED | semantic_search_all_branches() has no branch filter; test_all_branch_scope verifies candidates from multiple branches |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `gloss_extraction_service.py` | 19 | `raise NotImplementedError` | Info | Intentional TOOL-02 stub per plan; OpenGloss package does not exist yet; flagged in research doc; not a regression risk |

No other anti-patterns found. No TODO/FIXME/placeholder comments in phase-12 code. No hardcoded empty returns feeding user-visible output. All stub patterns are intentional (Wave 0 test stubs were all unskipped and replaced with real tests by plan completion).

### Human Verification Required

#### 1. ANN Index Performance Under Load

**Test:** With a production-scale entity_embeddings table (18K+ entities), run several `semantic_search_all_branches()` queries and measure latency with EXPLAIN ANALYZE.
**Expected:** HNSW index scan used (not seqscan); query time under 200ms
**Why human:** Requires production data volume; HNSW index exists in migration but performance depends on actual row count and pgvector version

#### 2. GitHub Webhook Merge Trigger

**Test:** Merge a real test PR on a project with EmbeddingConfig; inspect Redis queue within 30 seconds.
**Expected:** `run_embedding_generation_task` job appears in ARQ queue with correct project_id and branch
**Why human:** Requires live GitHub webhook delivery to a running server with Redis; cannot replicate offline

### Gaps Summary

No gaps found. All 13 observable truths are verified, all 12 required artifacts exist with substantive implementation, all key links are wired and data flows through them. The 162-test suite passes with no regressions. The only outstanding items are the two behavioral checks that require live infrastructure (ANN performance and webhook delivery), which are correctly classified as human verification.

**TOOL-02 (OpenGloss)** is classified as SATISFIED with a stub because the requirement explicitly acknowledges the dependency does not yet exist as a Python package, and the stub correctly raises NotImplementedError with a message pointing to the research document. This is not a gap — it is the specified behavior per 12-02-PLAN.md.

---

_Verified: 2026-04-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
