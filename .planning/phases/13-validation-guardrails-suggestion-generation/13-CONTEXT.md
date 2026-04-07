# Phase 13: Validation Guardrails & Suggestion Generation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

LLM suggestions for child classes, sibling classes, annotations, parents, and relationship edges are available via API, filtered through duplicate detection, and blocked by pre-submit validation before they can enter a user's draft. This phase delivers: suggestion generation service with LLM prompt templates, per-type generation (children/siblings/annotations/parents/edges), ontology context assembly, pre-submit validation rules (parent required, English label, namespace check, cycle detection), IRI minting, and auto-validation in the generation pipeline. It does NOT deliver the frontend suggestion UX, flashcard mode, or session clustering (those are Phases 14-15).

</domain>

<decisions>
## Implementation Decisions

### Prompt Strategy
- **D-01:** Rich local context — include current class + its parents + existing siblings + existing annotations + a few ancestor-level annotations. ~2-4K tokens of structured context per call. Balances quality with cost.
- **D-02:** Hybrid template approach — start with generative-folio prompt templates as a base, customize per suggestion type (children, siblings, annotations, parents, edges). Researcher must check alea-institute/generative-folio for existing templates.
- **D-03:** Every generated suggestion includes ontology context in the prompt (GEN-06). The context assembler is a shared utility across all suggestion types.

### Suggestion Shape
- **D-04:** Independent generation — LLM suggestions are returned as ephemeral proposals. Frontend displays them, user accepts/rejects. Accepted suggestions enter the existing draft/session flow. Generation and persistence are decoupled.
- **D-05:** Configurable batch size (1-10) per request. Default to 3-5. User or project setting controls batch size.
- **D-06:** Normalized 0-1 confidence scores. Parse LLM output, normalize to 0-1 scale. Consistent across providers. Fall back to null if LLM doesn't provide one.
- **D-07:** Each generated suggestion tagged with provenance: `llm-proposed` (fresh from LLM), `user-written` (manual), `user-edited-from-llm` (accepted with edits). Provenance travels through the entire pipeline (GEN-09).

### Validation Pipeline
- **D-08:** Server-side gate — all validation runs on the backend. Frontend calls validation endpoint and displays returned errors inline. Single source of truth, can't be bypassed.
- **D-09:** Auto-validate in pipeline — suggest endpoint runs duplicate check + validation on each generated suggestion before returning. Caller gets pre-filtered results with validation status per suggestion. No separate validate call needed for generated suggestions.
- **D-10:** Validation rules (all from REQUIREMENTS):
  - Every new class/property must have at least one existing parent (VALID-01)
  - Every new class/property must have an rdfs:label in English (VALID-02)
  - System detects and blocks cycles in class hierarchy (VALID-03) — uses existing ReasonerService DFS
  - System blocks IRIs in namespaces the user doesn't own (VALID-04)
  - Validation failures show inline error messages (VALID-05)

### IRI Minting
- **D-11:** Project namespace + UUID v4 local name. Matches WebProtege conventions (VALID-06). Zero collision risk. Example: `http://example.org/ontology#a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **D-12:** Namespace detection: auto-detect from ontology (owl:Ontology IRI or most common namespace prefix), allow override in project settings. Both with fallback — auto-detect first, project setting overrides.

### Claude's Discretion
- API shape: unified endpoint vs separate endpoints per suggestion type (leaning unified with type-discriminated Pydantic schemas)
- Validation endpoint: extend existing POST /validate or new entity-specific endpoint
- Prompt template file format and organization
- Exact context assembly algorithm (which ancestors, how many siblings to include)
- Default batch size per suggestion type
- Error message wording for validation failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — GEN-01 through GEN-09, VALID-01 through VALID-06

### LLM Infrastructure (Phase 11)
- `../ontokit-api/ontokit/services/llm/base.py` — LLMProvider abstract base class with chat() returning (text, input_tokens, output_tokens)
- `../ontokit-api/ontokit/services/llm/registry.py` — Provider registry, get_provider_for_project()
- `../ontokit-api/ontokit/services/llm/audit.py` — Audit logging for LLM calls
- `../ontokit-api/ontokit/services/llm/budget.py` — Budget enforcement
- `../ontokit-api/ontokit/services/llm/rate_limiter.py` — Per-user rate limiting
- `../ontokit-api/ontokit/services/llm/role_gates.py` — Role-based LLM access gating
- `../ontokit-api/ontokit/api/routes/llm.py` — LLM config/status/usage endpoints

### Duplicate Detection (Phase 12)
- `../ontokit-api/ontokit/services/duplicate_check_service.py` — DuplicateCheckService.check() with 40/40/20 composite scoring
- `../ontokit-api/ontokit/schemas/duplicate_check.py` — DuplicateCheckRequest/Response, DuplicateVerdict, ScoreBreakdown
- `../ontokit-api/ontokit/services/structural_similarity_service.py` — folio-python Jaccard similarity
- `../ontokit-api/ontokit/services/reasoner_service.py` — Cycle detection (DFS) + unsatisfiable class detection (HermiT)
- `../ontokit-api/ontokit/api/routes/validation.py` — POST /projects/{id}/validate (pre-commit OWL validation)

### Existing Suggestion System
- `../ontokit-api/ontokit/services/suggestion_service.py` — Full suggestion session lifecycle (create/save/submit/review)
- `../ontokit-api/ontokit/schemas/suggestion.py` — Suggestion session Pydantic schemas

### Ontology Index & Context
- `../ontokit-api/ontokit/services/ontology_index.py` — SQL-backed entity queries, hierarchy, labels, annotations
- `../ontokit-api/ontokit/services/embedding_service.py` — Embedding generation and semantic search

### Generative FOLIO (Private — alea-institute/generative-folio)
- `../generative-folio/src/generative_folio/services/concept_generation.py` — `SYSTEM_INSTRUCTIONS` prompt for legal concept generation (GEN-07), `ConceptGenerationOutput` Pydantic model
- `../generative-folio/src/generative_folio/services/quality_filter.py` — Hybrid heuristic+LLM quality filter: 143 legal keywords, 13 citation regex patterns, 31 FOLIO areas, 4 weighted signals (0.35 area + 0.30 keyword + 0.20 source + 0.15 completeness). Auto-accept >0.40, auto-reject <0.15, LLM borderline.
- `../generative-folio/src/generative_folio/services/translation.py` — `TRANSLATION_SYSTEM_INSTRUCTIONS` for multilingual legal term translation (10 languages, BCP-47 tags)
- `../generative-folio/src/generative_folio/qa/prompts.py` — 8 QA agent system prompts (dedup merge, orphan reparent, IS-A validation, cycle repair, area mismatch, etc.)
- `../generative-folio/src/generative_folio/qa/detectors.py` — 9 deterministic zero-cost detectors (cycles, orphans, exact/fuzzy dupes, overloaded parents, area mismatches, suspicious IS-A)
- `../generative-folio/src/generative_folio/qa/schemas.py` — 8 Pydantic output models for QA agents
- `../generative-folio/src/generative_folio/models/concept.py` — `ConceptNode`, `RelationshipType` (14 controlled types), `AltLabel` with BCP-47 lang tags
- `../generative-folio/src/generative_folio/services/openai_responses.py` — `parse_response_async()` structured output pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LLMProvider.chat()` — returns (text, input_tokens, output_tokens), ready for suggestion generation
- `DuplicateCheckService.check()` — call per-suggestion for auto-validation in pipeline
- `ReasonerService.check_cycles()` — RDFLib DFS cycle detection, ready for VALID-03
- `ontology_index.py` — SQL queries for parents, siblings, annotations (context assembly)
- `embedding_service.semantic_search()` — for finding similar entities during validation
- **generative-folio prompt templates** — adapt `SYSTEM_INSTRUCTIONS` from concept_generation.py for each suggestion type (children, siblings, annotations, parents, edges)
- **generative-folio quality filter** — port the heuristic scoring (143 keywords, 13 citation patterns, 4 weighted signals) as a fast pre-filter before LLM quality checks
- **generative-folio relationship types** — reuse the 14 controlled `RelationshipType` literals for edge suggestions (GEN-05)

### Established Patterns
- FastAPI dependency injection for services (see existing routes)
- Pydantic schemas for all request/response types
- AsyncSession-based DB access
- Role gating via `role_gates.py` decorators

### Integration Points
- New suggestion generation service connects to LLM registry (Phase 11) and duplicate check (Phase 12)
- Validation rules extend or complement existing validation endpoint
- Generated suggestions feed into existing suggestion session flow when accepted by frontend (Phase 14)

</code_context>

<specifics>
## Specific Ideas

- Hybrid template approach: start with generative-folio templates, customize per suggestion type
- Auto-validation means the suggest endpoint is a pipeline: generate → validate → duplicate-check → return scored/filtered results
- Configurable batch size gives users control over cost vs variety trade-off

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-validation-guardrails-suggestion-generation*
*Context gathered: 2026-04-06*
