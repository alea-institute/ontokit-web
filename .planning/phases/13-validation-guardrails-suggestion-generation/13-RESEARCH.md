# Phase 13: Validation Guardrails & Suggestion Generation - Research

**Researched:** 2026-04-06
**Domain:** LLM suggestion generation + pre-submit validation pipeline (Python/FastAPI backend, ontokit-api)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rich local context — include current class + its parents + existing siblings + existing annotations + a few ancestor-level annotations. ~2-4K tokens of structured context per call.
- **D-02:** Hybrid template approach — start with generative-folio prompt templates as a base, customize per suggestion type (children, siblings, annotations, parents, edges). Researcher must check alea-institute/generative-folio for existing templates.
- **D-03:** Every generated suggestion includes ontology context in the prompt (GEN-06). The context assembler is a shared utility across all suggestion types.
- **D-04:** Independent generation — LLM suggestions are returned as ephemeral proposals. Frontend displays them, user accepts/rejects. Accepted suggestions enter the existing draft/session flow. Generation and persistence are decoupled.
- **D-05:** Configurable batch size (1-10) per request. Default to 3-5. User or project setting controls batch size.
- **D-06:** Normalized 0-1 confidence scores. Parse LLM output, normalize to 0-1 scale. Consistent across providers. Fall back to null if LLM doesn't provide one.
- **D-07:** Each generated suggestion tagged with provenance: `llm-proposed` (fresh from LLM), `user-written` (manual), `user-edited-from-llm` (accepted with edits). Provenance travels through the entire pipeline (GEN-09).
- **D-08:** Server-side gate — all validation runs on the backend. Frontend calls validation endpoint and displays returned errors inline. Single source of truth, can't be bypassed.
- **D-09:** Auto-validate in pipeline — suggest endpoint runs duplicate check + validation on each generated suggestion before returning. Caller gets pre-filtered results with validation status per suggestion.
- **D-10:** Validation rules: parent required (VALID-01), English label required (VALID-02), cycle detection (VALID-03), namespace ownership (VALID-04), inline error messages (VALID-05).
- **D-11:** Project namespace + UUID v4 local name for IRI minting. Zero collision risk. Example: `http://example.org/ontology#a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **D-12:** Namespace detection: auto-detect from ontology (owl:Ontology IRI or most common namespace prefix), allow override in project settings. Auto-detect first, project setting overrides.

### Claude's Discretion

- API shape: unified endpoint vs separate endpoints per suggestion type (leaning unified with type-discriminated Pydantic schemas)
- Validation endpoint: extend existing POST /validate or new entity-specific endpoint
- Prompt template file format and organization
- Exact context assembly algorithm (which ancestors, how many siblings to include)
- Default batch size per suggestion type
- Error message wording for validation failures

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | User can request LLM suggestions for child classes | Context assembler + children prompt template + generation endpoint |
| GEN-02 | User can request LLM suggestions for sibling classes | Same pipeline with sibling-focused prompt |
| GEN-03 | User can request LLM suggestions for annotations (altLabel, examples, notes, translations) | Annotation prompt template; shares context assembler |
| GEN-04 | User can request LLM suggestions for additional parent classes | Parent suggestion prompt; cycle-detection validation mandatory |
| GEN-05 | User can request LLM suggestions for seeAlso/isDefinedBy edges | Edge prompt; URI-valued output |
| GEN-06 | LLM prompts include existing ontology context | OntologyIndexService.get_class_detail() + get_class_children() assemble context before every call |
| GEN-07 | Generative FOLIO prompt templates used | folio-enrich prompts directory inspected; concept_identification pattern is the canonical model; no ready-made children/sibling templates exist — must author them following the same JSON-output + calibrated-confidence pattern |
| GEN-08 | Each generated suggestion includes LLM confidence score when available | Parse JSON output; normalize to 0-1; fall back to null |
| GEN-09 | Each generated suggestion tagged with provenance | Provenance Literal type in Pydantic schema; travels from generation through acceptance |
| VALID-01 | Every new class/property must have at least one existing parent | ValidationService.validate_entity() rule: parent_iris non-empty check |
| VALID-02 | Every new class/property must have an English rdfs:label | Check labels list for lang="en" or lang="" |
| VALID-03 | System detects and blocks cycles | ReasonerService.detect_cycles() — already implemented via RDFLib DFS; must be integrated into ValidationService |
| VALID-04 | System blocks IRIs in namespaces user doesn't own | Namespace ownership check: extract IRI prefix, compare against project's owned namespaces |
| VALID-05 | Validation failures show inline error messages | ValidationService returns structured error list; endpoint returns per-field errors |
| VALID-06 | New IRIs minted with UUID-based local names under project namespace | IRI minting utility: auto-detect namespace, uuid.uuid4(), return full IRI |

</phase_requirements>

---

## Summary

Phase 13 builds two interlocking capabilities entirely in `ontokit-api`: a **suggestion generation pipeline** (five suggestion types driven by LLM calls with ontology context) and a **validation guardrails service** (six rules that gate what can enter the draft pipeline). Both capabilities build on Phase 11 and Phase 12 infrastructure that is already proven in production.

The LLM infrastructure from Phase 11 is the cleanest possible starting point: `LLMProvider.chat()` returns `(text, input_tokens, output_tokens)`, the registry handles all 13 providers uniformly, and `log_llm_call()` + `check_budget()` + `check_rate_limit()` are ready to drop into a new route. The validation layer already has `ReasonerService.detect_cycles()` (RDFLib DFS) and `DuplicateCheckService.check()` implemented in Phase 12. Phase 13's job is to compose these components into a coherent suggestion generation service and a reusable validation service, expose them through new API endpoints, and author the five prompt templates.

No "generative-folio" package exists in PyPI or as an alea-institute repo. The canonical reference is the `folio-enrich` prompt patterns (`concept_identification.py`, `property_extraction.py`) — these use a **JSON-output + calibrated 0-1 confidence** pattern that is exactly what Phase 13 needs. All five prompt templates must be authored from scratch following that pattern.

**Primary recommendation:** Implement a single `SuggestionGenerationService` that assembles ontology context via `OntologyIndexService`, calls `LLMProvider.chat()` with a type-dispatched prompt, parses structured JSON output, runs `ValidationService.validate_entity()` and `DuplicateCheckService.check()` per suggestion, and returns a typed list of `GeneratedSuggestion` objects. Expose this through one unified endpoint `POST /projects/{id}/llm/generate-suggestions`. Implement `ValidationService` as a new standalone service file that the generation pipeline reuses, and also expose it independently via `POST /projects/{id}/llm/validate-entity` for Phase 14 inline UX.

---

## Standard Stack

### Core (already in pyproject.toml — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `rdflib` | >=7.1.0 | Namespace parsing, cycle detection | Already used by ReasonerService |
| `pydantic` | >=2.10.0 | Schema validation for all I/O | Project-wide standard |
| `sqlalchemy` | >=2.0.0 (async) | OntologyIndexService context queries | All services use AsyncSession |
| `openai` (compat) | >=1.0.0 | OpenAI-compatible provider | Handles ~9 of 13 providers |
| `anthropic` | >=0.18.0 | Anthropic provider | Already in registry |
| `redis` | >=5.2.0 | Rate limit counter | Used by existing rate_limiter.py |
| `uuid` (stdlib) | — | IRI minting (uuid4) | Zero-collision local names |

### No New Dependencies Required

All required capabilities are already installed. Phase 13 adds **no new pip packages**.

**Verification (current):**
```
folio-python: 0.3.3  (installed, used by StructuralSimilarityService)
openai: >=1.0.0      (installed, OpenAICompatProvider)
anthropic: >=0.18.0  (installed, AnthropicProvider)
rdflib: >=7.1.0      (installed, ReasonerService)
pydantic: >=2.10.0   (installed, all schemas)
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unified endpoint (one route) | Per-type routes (5 routes) | Unified is simpler — D-01 through D-09 apply identically to all types; discriminated union handles the schema difference |
| New validation service file | Extending existing validation.py route | New service file separates logic from transport; route just delegates; enables reuse in generation pipeline |
| RDFLib DFS cycle detection (existing) | owlready2 cycle detection | RDFLib is the proven choice — already decided in Phase 12 (owlready2/HermiT normalizes cycles before Python can observe them) |

---

## Architecture Patterns

### New Files to Create

```
ontokit-api/
├── ontokit/
│   ├── services/
│   │   ├── suggestion_generation_service.py   # orchestrates: context → LLM → validate → dedup
│   │   ├── validation_service.py               # ValidationService with all VALID-01..06 rules
│   │   └── llm/
│   │       └── prompts/
│   │           ├── __init__.py
│   │           ├── children.py                 # prompt template for child class suggestions
│   │           ├── siblings.py                 # prompt template for sibling class suggestions
│   │           ├── annotations.py              # prompt template for annotation suggestions
│   │           ├── parents.py                  # prompt template for parent class suggestions
│   │           └── edges.py                    # prompt template for edge (seeAlso/isDefinedBy) suggestions
│   ├── schemas/
│   │   └── generation.py                       # GenerateSuggestionsRequest/Response, GeneratedSuggestion
│   └── api/
│       └── routes/
│           └── generation.py                   # POST /projects/{id}/llm/generate-suggestions
│                                               # POST /projects/{id}/llm/validate-entity
```

### Pattern 1: Context Assembly

**What:** A shared `ContextAssembler` class (or module-level function) gathers all ontology context needed for any prompt type. Called once before dispatching to the type-specific prompt template.

**When to use:** Every LLM call in Phase 13 — all five suggestion types share the same context structure per D-03.

**Example:**
```python
# Source: based on OntologyIndexService.get_class_detail() pattern (ontology_index.py)
async def assemble_context(
    index_svc: OntologyIndexService,
    project_id: UUID,
    branch: str,
    class_iri: str,
    max_siblings: int = 10,
    max_ancestor_annotations: int = 3,
) -> dict:
    """Assemble ~2-4K token ontology context for any suggestion type."""
    detail = await index_svc.get_class_detail(project_id, branch, class_iri)
    if detail is None:
        raise ValueError(f"Entity not found: {class_iri}")

    # Parents with their labels
    parents = []
    for iri in detail["parent_iris"]:
        parent_detail = await index_svc.get_class_detail(project_id, branch, iri)
        parents.append({
            "iri": iri,
            "label": detail["parent_labels"].get(iri, iri),
            "annotations": (parent_detail or {}).get("annotations", [])[:2],
        })

    # Siblings (children of first parent)
    siblings = []
    if detail["parent_iris"]:
        sibling_list = await index_svc.get_class_children(
            project_id, branch, detail["parent_iris"][0]
        )
        siblings = [s for s in sibling_list if s["iri"] != class_iri][:max_siblings]

    return {
        "current_class": {
            "iri": class_iri,
            "labels": detail["labels"],
            "annotations": detail["annotations"],
        },
        "parents": parents,
        "siblings": siblings,
        "existing_children": await index_svc.get_class_children(project_id, branch, class_iri),
    }
```

### Pattern 2: Prompt Template Structure

**What:** Each prompt module exposes a single `build_messages(context: dict, batch_size: int) -> list[dict]` function that returns the `messages` list for `LLMProvider.chat()`.

**When to use:** Type-dispatched inside `SuggestionGenerationService`.

**Example (children prompt — following folio-enrich concept_identification.py pattern):**
```python
# Source: folio-enrich/backend/app/services/llm/prompts/concept_identification.py pattern
SYSTEM = """You are an ontology expert specializing in legal knowledge representation.
Your task is to suggest child classes for the given ontology class.
Output JSON only. No markdown. No explanation outside the JSON structure."""

def build_messages(context: dict, batch_size: int = 5) -> list[dict]:
    current = context["current_class"]
    parent_labels = [p["label"] for p in context["parents"]]
    sibling_labels = [s["label"] for s in context["siblings"]]
    existing_child_labels = [c["label"] for c in context["existing_children"]]

    user = f"""Ontology context:
Current class: {current["labels"][0]["value"] if current["labels"] else current["iri"]}
IRI: {current["iri"]}
Parents: {", ".join(parent_labels) or "none"}
Existing siblings: {", ".join(sibling_labels[:10]) or "none"}
Existing children: {", ".join(existing_child_labels[:10]) or "none"}

Suggest {batch_size} child classes that would logically belong under this class.
Each suggestion must be a specific, non-redundant concept not already listed.

Output JSON:
{{
  "suggestions": [
    {{
      "label": "string — the English preferred label",
      "definition": "string — one-sentence definition",
      "confidence": 0.0-1.0
    }}
  ]
}}"""
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user},
    ]
```

### Pattern 3: Generation Pipeline (Per Suggestion)

**What:** `SuggestionGenerationService.generate()` runs the full pipeline: context assembly → LLM call → JSON parse → per-suggestion validation + dedup → return typed list.

**When to use:** The single endpoint `POST /projects/{id}/llm/generate-suggestions` delegates entirely to this service.

**Example:**
```python
# Source: composite of LLMProvider pattern (llm/base.py) + DuplicateCheckService pattern
async def generate(
    self,
    project_id: UUID,
    branch: str,
    class_iri: str,
    suggestion_type: SuggestionType,
    batch_size: int = 5,
    byo_key: str | None = None,
) -> GenerateSuggestionsResponse:
    # 1. Assemble context (shared across all types)
    context = await self._assembler.assemble(project_id, branch, class_iri)

    # 2. Build messages for this suggestion type
    messages = PROMPT_BUILDERS[suggestion_type](context, batch_size)

    # 3. Call LLM (with audit + rate check already done at route layer)
    text, input_tok, output_tok = await self._provider.chat(messages)

    # 4. Parse JSON output
    raw_suggestions = _parse_llm_json(text, suggestion_type)

    # 5. Per-suggestion: validate + dedup
    results: list[GeneratedSuggestion] = []
    for raw in raw_suggestions:
        minted_iri = self._mint_iri(project_id)
        validation_errors = await self._validator.validate_entity(
            project_id, branch, raw, suggestion_type, class_iri
        )
        dedup = await self._dedup_svc.check(
            project_id, raw.get("label", ""), parent_iri=class_iri
        )
        results.append(GeneratedSuggestion(
            iri=minted_iri,
            label=raw.get("label", ""),
            definition=raw.get("definition"),
            confidence=_normalize_confidence(raw.get("confidence")),
            provenance="llm-proposed",
            validation_errors=validation_errors,
            duplicate_verdict=dedup.verdict,
            duplicate_candidates=dedup.candidates[:3],
        ))

    # 6. Audit log
    await log_llm_call(db=self._db, ..., endpoint="llm/generate-suggestions")
    return GenerateSuggestionsResponse(suggestions=results, input_tokens=input_tok, ...)
```

### Pattern 4: ValidationService Rule Structure

**What:** A new `ValidationService` class with one method per VALID-* rule, orchestrated by `validate_entity()`.

**When to use:** Both in the generation pipeline (D-09) and as a standalone endpoint for Phase 14 inline UX.

**Example:**
```python
class ValidationService:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._index = OntologyIndexService(db)
        self._reasoner = ReasonerService()

    async def validate_entity(
        self,
        project_id: UUID,
        branch: str,
        entity: dict,        # {"label": ..., "parent_iris": [...], "iri": ...}
        context_iri: str,    # the class the user is working on
    ) -> list[ValidationError]:
        errors = []
        errors.extend(self._check_parent_required(entity))         # VALID-01
        errors.extend(self._check_english_label(entity))           # VALID-02
        errors.extend(await self._check_namespace(entity, project_id))  # VALID-04
        cycle_errors = await self._check_cycles(entity, project_id, branch)  # VALID-03
        errors.extend(cycle_errors)
        return errors
```

### Pattern 5: IRI Minting

**What:** Deterministic, zero-collision IRI generation per D-11/D-12.

**Example:**
```python
import uuid as _uuid

def mint_iri(namespace: str) -> str:
    """Mint a new IRI: namespace + UUID v4 local name.
    
    namespace must end with '#' or '/'. Example:
      namespace = "http://example.org/ontology#"
      result    = "http://example.org/ontology#a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    """
    local = str(_uuid.uuid4())
    sep = "" if namespace.endswith(("#", "/")) else "#"
    return f"{namespace}{sep}{local}"

async def detect_project_namespace(project: Project, graph: Graph) -> str:
    """Auto-detect from owl:Ontology IRI or most common prefix.
    Falls back to f'http://example.org/ontology/{project.id}#' if none found.
    """
    from rdflib.namespace import OWL
    from rdflib import URIRef
    for s in graph.subjects(RDF.type, OWL.Ontology):
        if isinstance(s, URIRef):
            iri = str(s)
            return iri + ("#" if not iri.endswith(("#", "/")) else "")
    # fallback: most common namespace prefix by entity count
    ...
```

### Pattern 6: Namespace Ownership Check (VALID-04)

**What:** Extract the namespace prefix from a proposed IRI and compare against the project's declared namespace(s). Block if the IRI is in a foreign namespace.

**Key insight:** The "owned" namespace is the one used in IRI minting (D-12). Any proposed IRI whose prefix does not match is foreign and must be blocked.

```python
def _check_namespace(self, entity: dict, project_namespace: str) -> list[ValidationError]:
    iri = entity.get("iri", "")
    if not iri:
        return []  # no IRI yet — skip (minting happens at generation time)
    prefix = _extract_namespace(iri)  # split at last # or /
    if prefix != project_namespace:
        return [ValidationError(
            field="iri",
            code="VALID-04",
            message=f"IRI namespace '{prefix}' is not owned by this project. "
                    f"Expected namespace: '{project_namespace}'.",
        )]
    return []
```

### Pattern 7: Pydantic Schema — GeneratedSuggestion

**What:** The core response type that carries every generated suggestion through the pipeline.

```python
from typing import Literal
from pydantic import BaseModel

SuggestionType = Literal["children", "siblings", "annotations", "parents", "edges"]
Provenance = Literal["llm-proposed", "user-written", "user-edited-from-llm"]

class ValidationError(BaseModel):
    field: str
    code: str           # e.g. "VALID-01"
    message: str        # Human-readable inline message (VALID-05)

class GeneratedSuggestion(BaseModel):
    iri: str                            # minted at generation time (VALID-06)
    suggestion_type: SuggestionType
    label: str
    definition: str | None = None
    confidence: float | None = None     # 0-1 normalized, null if LLM didn't provide (GEN-08)
    provenance: Provenance = "llm-proposed"  # GEN-09
    validation_errors: list[ValidationError] = []   # empty = passed all rules
    duplicate_verdict: str = "pass"     # "block" | "warn" | "pass"
    duplicate_candidates: list[dict] = []

class GenerateSuggestionsRequest(BaseModel):
    class_iri: str
    branch: str = "main"
    suggestion_type: SuggestionType
    batch_size: int = Field(default=5, ge=1, le=10)   # D-05

class GenerateSuggestionsResponse(BaseModel):
    suggestions: list[GeneratedSuggestion]
    input_tokens: int
    output_tokens: int
    context_tokens_estimate: int | None = None
```

### Pattern 8: Standalone Validate-Entity Endpoint

**What:** An entity-level validation endpoint distinct from the existing OWL reasoner endpoint (`POST /validate`). The existing endpoint validates a full OWL content blob; this new endpoint validates a single proposed entity's metadata against business rules.

**Decision (Claude's Discretion):** Add a new endpoint `POST /projects/{id}/llm/validate-entity` rather than overloading the existing `/validate`. The existing endpoint targets whole-ontology OWL consistency (reasoner). The new endpoint targets per-entity business rules (parent required, English label, namespace, cycle detection against the existing hierarchy). Different purpose, different caller, different response shape.

### Anti-Patterns to Avoid

- **Blocking on LLM JSON parse failure:** LLMs sometimes return malformed JSON. Always wrap `json.loads()` in try/except; return a partial result rather than 500ing the whole request.
- **Running cycle detection on a full OWL blob for every suggestion:** Cycle detection only needs to check whether the proposed parent_iri would introduce a cycle by querying the existing `IndexedHierarchy`, not by re-parsing the entire ontology. Use a lighter SQL/graph check rather than loading the full OWL.
- **Awaiting the duplicate check before returning all suggestions:** Run `DuplicateCheckService.check()` per suggestion but do not parallelize across suggestions (shared `db` session is not safe for concurrent queries in a single AsyncSession). Run sequentially in the loop.
- **Storing prompt content in audit logs:** `log_llm_call()` stores metadata only (tokens, cost, model). Never pass prompt text to the audit log (privacy-safe per D-08).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM provider dispatch | Custom HTTP client per provider | `get_provider()` from `ontokit.services.llm.registry` | Handles 13 providers, key resolution, defaults |
| Rate limiting | Redis INCR logic | `check_rate_limit(redis, ...)` from `ontokit.services.llm.rate_limiter` | Already implemented, fail-open pattern |
| Budget enforcement | Monthly spend SQL | `check_budget(db, project_id, config)` from `ontokit.services.llm.budget` | Already implemented, daily+monthly caps |
| Audit logging | Custom audit table writes | `log_llm_call(db, ...)` from `ontokit.services.llm.audit` | LLM-07 compliant, already wired |
| Duplicate detection | Custom embedding search | `DuplicateCheckService.check()` | 40/40/20 composite, Phase 12 proven |
| Cycle detection | Custom graph traversal | `ReasonerService.detect_cycles()` | RDFLib DFS already working (Phase 12 decision) |
| Ontology context queries | Raw SQL joins | `OntologyIndexService.get_class_detail()`, `get_class_children()`, `get_ancestor_path()` | Bulk label resolution, child counts, all indexed |
| Cost estimation | Manual token × price math | `get_model_pricing(model)` from `ontokit.services.llm.pricing` | LiteLLM pricing cache, 7-day TTL |
| Role/access gating | Manual role string checks | `check_llm_access(role, is_anonymous)` from `ontokit.services.llm.role_gates` | ROLE-01..05 compliant |

**Key insight:** Phase 11 and 12 composed all the hard infrastructure. Phase 13 is primarily orchestration and prompt authoring. Resist the temptation to reimplement services that are already proven.

---

## Runtime State Inventory

> SKIPPED — this is a greenfield phase adding new services and endpoints. No rename/refactor/migration involved.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | All backend code | Yes | 3.11+ (Linux) | — |
| PostgreSQL (pgvector) | Embedding search, index queries | Yes | Confirmed Phase 12 | — |
| Redis | Rate limiting | Yes | Confirmed Phase 11 | Fail-open (rate_limiter.py design) |
| folio-python | StructuralSimilarityService | Yes | 0.3.3 | Structural score degrades to 0.0 |
| openai SDK | OpenAI-compat providers | Yes | >=1.0.0 | — |
| anthropic SDK | Anthropic provider | Yes | >=0.18.0 | — |
| rdflib | Cycle detection, namespace parsing | Yes | >=7.1.0 | — |
| `uuid` stdlib | IRI minting | Yes | stdlib | — |
| generative-folio | D-02 prompt templates | NO | Not published | Author templates from scratch following folio-enrich concept_identification.py pattern |

**Missing dependencies with no fallback:**
- None that block execution. `generative-folio` does not exist as an installable package. D-02 is satisfied by authoring templates from scratch using folio-enrich's pattern.

**Missing dependencies with fallback:**
- `folio-python` structural similarity: if unavailable, score degrades to 0.0 (already handled in StructuralSimilarityService).

---

## Common Pitfalls

### Pitfall 1: generative-folio Does Not Exist as a Package

**What goes wrong:** CONTEXT.md says "check alea-institute/generative-folio for existing templates." No such repository or package exists on GitHub or PyPI.

**Why it happens:** The name appears in planning docs as a forward-looking reference, not an existing artifact.

**How to avoid:** Author all five prompt templates from scratch following the `folio-enrich` `concept_identification.py` pattern (system message + user message with structured context + JSON output schema + 0-1 calibrated confidence). Do NOT add a `generative-folio` dependency. TOOL-05 in REQUIREMENTS.md says "generative FOLIO is installable as a Python dependency" — this requirement will be satisfied by the locally authored prompt templates module, not an external package.

**Warning signs:** Any `pip install generative-folio` will fail with "package not found."

### Pitfall 2: Cycle Detection Requires the Proposed Edge, Not Just Existing State

**What goes wrong:** Checking cycle detection against the existing ontology alone will always pass — the cycle only appears when the proposed parent assignment is temporarily added. For parent suggestions, the cycle check must simulate adding the edge and then run DFS.

**Why it happens:** `ReasonerService.detect_cycles()` takes OWL content as input. To detect whether assigning `proposed_parent` to `entity_iri` creates a cycle, the caller must construct a minimal graph with the proposed edge added and pass it to the DFS.

**How to avoid:** The lighter approach for per-suggestion validation is a direct SQL-based ancestor walk: query `IndexedHierarchy` for all ancestors of `proposed_parent_iri`. If `entity_iri` appears in that ancestor set, assigning it as a parent would create a cycle. This avoids loading the full OWL blob per suggestion.

**Warning signs:** Cycle validation always returns clean but users can commit cyclic hierarchies through the suggestion flow.

### Pitfall 3: LLM JSON Output Is Not Guaranteed

**What goes wrong:** Even with explicit JSON-only instructions, LLMs may wrap output in markdown fences (` ```json `) or include preamble text. Calling `json.loads()` directly raises `JSONDecodeError`.

**Why it happens:** Provider behavior differs. Some models reliably output bare JSON; others prefix with "Here is the JSON:".

**How to avoid:** Strip markdown fences and leading/trailing whitespace before parsing. Use a fallback regex to extract the first JSON object/array. If still unparseable, return an empty suggestions list rather than 500.

```python
import json, re

def _parse_json_safe(text: str) -> list[dict]:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
        return data.get("suggestions", []) if isinstance(data, dict) else []
    except json.JSONDecodeError:
        # Last-resort: extract first {...} block
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group())
                return data.get("suggestions", []) if isinstance(data, dict) else []
            except json.JSONDecodeError:
                pass
    return []
```

### Pitfall 4: Confidence Score Normalization Edge Cases

**What goes wrong:** LLMs express confidence in different scales — 0-1, 0-100, "high/medium/low" strings, or as a percentage. Returning the raw value breaks downstream consumers that expect 0-1 float or null.

**Why it happens:** Different models have different conventions; local models often omit confidence entirely.

**How to avoid:** Always normalize in the parse step. Clamp to [0.0, 1.0] after normalization. Return `None` (not 0.0) when confidence is absent — callers can distinguish "not provided" from "zero confidence."

```python
def _normalize_confidence(raw: object) -> float | None:
    if raw is None:
        return None
    try:
        val = float(raw)
        if val > 1.0:
            val = val / 100.0   # likely 0-100 scale
        return max(0.0, min(1.0, val))
    except (TypeError, ValueError):
        return None   # "high", "medium", etc. → null
```

### Pitfall 5: Sequential DuplicateCheckService Calls in a Single Request

**What goes wrong:** Running `DuplicateCheckService.check()` concurrently (e.g., `asyncio.gather`) with a shared `AsyncSession` raises SQLAlchemy errors about concurrent operations on the same session.

**Why it happens:** SQLAlchemy's `AsyncSession` is not safe for concurrent use within a single request. Phase 12 test decisions documented the `async def side_effect` pattern for this reason.

**How to avoid:** Run duplicate checks sequentially in the generation loop. For a batch of 5 suggestions, 5 sequential calls is acceptable latency since the LLM call itself dominates. If this becomes a bottleneck, create separate session instances per check.

### Pitfall 6: Namespace Detection Without owl:Ontology Triple

**What goes wrong:** Some ontologies lack an explicit `owl:Ontology` declaration. The namespace auto-detect falls back to "most common prefix" heuristics which can return an unexpected namespace.

**Why it happens:** Many real-world OWL files are incomplete or use non-standard patterns.

**How to avoid:** Detect namespace in this order:
1. `owl:Ontology` IRI from project metadata (`project.ontology_iri` column — already in the Project model)
2. Most common IRI prefix in `IndexedEntity` for this project/branch (SQL GROUP BY prefix)
3. Hardcoded fallback: `http://example.org/ontology/{project_id}#`

The `project.ontology_iri` column is already populated on project import and is the most reliable source.

### Pitfall 7: BYO Key Routing at the Route Layer

**What goes wrong:** The generation endpoint must check for an `X-BYO-API-Key` header (per Phase 11 D-05) and construct the provider with that key instead of the stored project key. Missing this makes BYO-key users hit budget limits they shouldn't face.

**Why it happens:** Phase 11 established the pattern: BYO key is passed per-request via header, never stored. The generation route must follow the same pattern as the existing LLM config routes.

**How to avoid:** Check `x_byo_api_key: str | None = Header(default=None, alias="X-BYO-API-Key")` in the route signature. If present, pass it to `get_provider()`. Set `is_byo_key=True` in `log_llm_call()`.

---

## Code Examples

### Verified: LLMProvider.chat() call pattern

```python
# Source: ontokit/services/llm/base.py
provider = get_provider(config.provider, api_key=api_key, model=config.model)
text, input_tokens, output_tokens = await provider.chat(messages)
```

### Verified: Audit log call pattern

```python
# Source: ontokit/services/llm/audit.py
from ontokit.services.llm.audit import log_llm_call
from ontokit.services.llm.pricing import get_model_pricing

input_cost, output_cost = await get_model_pricing(model)
cost = input_tokens * input_cost + output_tokens * output_cost
await log_llm_call(
    db=db,
    project_id=str(project_id),
    user_id=current_user.id,
    model=model,
    provider=config.provider.value,
    endpoint="llm/generate-suggestions",
    input_tokens=input_tokens,
    output_tokens=output_tokens,
    cost_estimate_usd=cost,
    is_byo_key=byo_key is not None,
)
```

### Verified: Budget + Rate check pattern

```python
# Source: ontokit/api/routes/llm.py (existing pattern)
from ontokit.services.llm import check_budget, check_rate_limit

within_budget, reason = await check_budget(db, str(project_id), config)
if not within_budget:
    raise HTTPException(status_code=402, detail=reason)

within_limit = await check_rate_limit(redis, str(project_id), current_user.id, role)
if not within_limit:
    raise HTTPException(status_code=429, detail="daily_rate_limit_exceeded")
```

### Verified: OntologyIndexService context query pattern

```python
# Source: ontokit/services/ontology_index.py
from ontokit.services.ontology_index import OntologyIndexService

svc = OntologyIndexService(db)
detail = await svc.get_class_detail(project_id, branch, class_iri)
# Returns: {"iri", "labels", "comments", "parent_iris", "parent_labels",
#           "annotations", "child_count", "deprecated", ...}

children = await svc.get_class_children(project_id, branch, class_iri)
# Returns: [{"iri", "label", "child_count", "deprecated"}, ...]

ancestors = await svc.get_ancestor_path(project_id, branch, class_iri)
# Returns: ordered list from root to parent of class_iri
```

### Verified: ReasonerService cycle detection pattern

```python
# Source: ontokit/services/reasoner_service.py
from ontokit.services.reasoner_service import ReasonerService

reasoner = ReasonerService()
# Full consistency check (used by existing /validate endpoint):
result = reasoner.check_consistency(owl_content)
# Cycles only (lighter):
cycle_issues = reasoner.detect_cycles(owl_content)
# Each issue: ReasonerIssue(rule_id="hierarchy_cycle", severity="error", entity_iri=..., message=...)
```

### Verified: Duplicate check pattern

```python
# Source: ontokit/services/duplicate_check_service.py
from ontokit.services.duplicate_check_service import DuplicateCheckService

svc = DuplicateCheckService(db)
result = await svc.check(
    project_id=project_id,
    label="Proposed Label",
    entity_type="class",
    parent_iri="http://example.org/ontology#ParentClass",
)
# result.verdict: "block" | "warn" | "pass"
# result.candidates: list of DuplicateCandidate with iri, label, score, source
```

### Verified: Project namespace from Project model

```python
# Source: ontokit/models/project.py — ontology_iri column
# project.ontology_iri is populated at import time (may be None for older projects)
namespace = project.ontology_iri
if namespace:
    if not namespace.endswith(("#", "/")):
        namespace += "#"
else:
    namespace = f"http://ontology.example.org/{project.id}#"
```

### Lightweight cycle check via SQL (preferred over full OWL parse)

```python
# Query ancestors of proposed_parent; if class_iri appears, it's a cycle
# Source: ontology_index.py get_ancestor_path() recursive CTE pattern
async def would_create_cycle(
    db: AsyncSession,
    project_id: UUID,
    branch: str,
    class_iri: str,         # entity being assigned a new parent
    proposed_parent_iri: str,
) -> bool:
    """True if assigning proposed_parent to class_iri would create a cycle."""
    # class_iri is already an ancestor of proposed_parent → cycle
    from sqlalchemy import text
    cte = text("""
        WITH RECURSIVE ancestors AS (
            SELECT parent_iri FROM indexed_hierarchy
            WHERE project_id = :pid AND branch = :branch
              AND child_iri = :start AND parent_iri != :owl_thing
            UNION ALL
            SELECT h.parent_iri FROM indexed_hierarchy h
            JOIN ancestors a ON h.child_iri = a.parent_iri
            WHERE h.project_id = :pid AND h.branch = :branch
              AND h.parent_iri != :owl_thing AND (
                  SELECT COUNT(*) FROM ancestors
              ) < 100
        )
        SELECT 1 FROM ancestors WHERE parent_iri = :target LIMIT 1
    """)
    result = await db.execute(cte, {
        "pid": str(project_id),
        "branch": branch,
        "start": proposed_parent_iri,
        "owl_thing": "http://www.w3.org/2002/07/owl#Thing",
        "target": class_iri,
    })
    return result.first() is not None
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| generative-folio (planned external dep) | Author templates in-repo following folio-enrich pattern | Phase 13 discovery | No pip install needed; maintain in-repo |
| Per-type LLM endpoints (5 routes) | Unified endpoint with discriminated type field | Claude's Discretion | Simpler route registration; all rules apply uniformly |
| owlready2 cycle detection | RDFLib DFS | Phase 12 decision | owlready2 normalizes cycles; RDFLib is reliable |
| LLM JSON as free text | Structured JSON output schema in prompt | folio-enrich pattern | Parseable output, extractable confidence scores |

---

## Open Questions

1. **Lightweight cycle check vs. full OWL parse for VALID-03**
   - What we know: `ReasonerService.detect_cycles()` takes a full OWL content string; running this per suggestion in a batch of 5-10 is expensive
   - What's unclear: Should Phase 13 use the SQL ancestor CTE approach (fast, no OWL parse) or the existing reasoner (slower, consistent with /validate endpoint)?
   - Recommendation: Use SQL CTE ancestor walk for the generation pipeline (fast, ~1ms per check); reserve `ReasonerService` for the standalone `/validate-entity` endpoint where full consistency matters more

2. **Namespace ownership: how to determine "owned" namespaces**
   - What we know: `project.ontology_iri` is the most reliable source; fallback to most-common prefix
   - What's unclear: Some projects may own multiple namespaces (e.g., they import and extend another ontology)
   - Recommendation: For Phase 13, treat the single project namespace (from `ontology_iri`) as the only owned namespace. Multi-namespace support is a v0.5.0 concern.

3. **Edge suggestion type (GEN-05) output format**
   - What we know: seeAlso and isDefinedBy edges are URI-valued, not literal-valued
   - What's unclear: Should the LLM be asked to suggest URI targets, or to suggest what kind of resource to link to (and the user provides the actual URI)?
   - Recommendation: Ask the LLM for a resource description (e.g., "a Wikipedia article on X") plus a suggested search query; do not ask the LLM to generate URIs directly. The frontend (Phase 14) will let users confirm and select the actual URI.

4. **Default batch sizes per suggestion type**
   - What we know: D-05 says 1-10 configurable, default 3-5
   - Recommendation: Default 5 for all types. Edge suggestions default 3 (fewer credible external references exist). This is a constant in the service; override via request field.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to `false` in config.json — validation is enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `pyproject.toml` (pytest section) or `pytest.ini` in ontokit-api |
| Quick run command | `pytest tests/unit/test_generation_service.py -x` |
| Full suite command | `pytest tests/unit/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01..05 | Generation endpoint returns suggestions per type | unit | `pytest tests/unit/test_generation_service.py::test_generate_{type} -x` | No — Wave 0 |
| GEN-06 | Ontology context appears in prompt messages | unit | `pytest tests/unit/test_context_assembler.py -x` | No — Wave 0 |
| GEN-07 | Prompt template produces valid messages format | unit | `pytest tests/unit/test_prompt_templates.py -x` | No — Wave 0 |
| GEN-08 | Confidence score normalized 0-1 or null | unit | `pytest tests/unit/test_generation_service.py::test_confidence_normalization -x` | No — Wave 0 |
| GEN-09 | Provenance field is "llm-proposed" on generated suggestions | unit | `pytest tests/unit/test_generation_service.py::test_provenance -x` | No — Wave 0 |
| VALID-01 | Missing parent returns VALID-01 error | unit | `pytest tests/unit/test_validation_service.py::test_parent_required -x` | No — Wave 0 |
| VALID-02 | Missing English label returns VALID-02 error | unit | `pytest tests/unit/test_validation_service.py::test_english_label -x` | No — Wave 0 |
| VALID-03 | Cycle introduces VALID-03 error | unit | `pytest tests/unit/test_validation_service.py::test_cycle_detection -x` | No — Wave 0 |
| VALID-04 | Foreign namespace IRI returns VALID-04 error | unit | `pytest tests/unit/test_validation_service.py::test_namespace_check -x` | No — Wave 0 |
| VALID-05 | All errors include human-readable message field | unit | `pytest tests/unit/test_validation_service.py::test_error_messages -x` | No — Wave 0 |
| VALID-06 | IRI minting produces project-namespace + UUID v4 local name | unit | `pytest tests/unit/test_iri_minting.py -x` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/unit/ -x -q`
- **Per wave merge:** `pytest tests/unit/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/test_generation_service.py` — covers GEN-01..09
- [ ] `tests/unit/test_context_assembler.py` — covers GEN-06
- [ ] `tests/unit/test_prompt_templates.py` — covers GEN-07
- [ ] `tests/unit/test_validation_service.py` — covers VALID-01..05
- [ ] `tests/unit/test_iri_minting.py` — covers VALID-06
- [ ] `tests/unit/conftest.py` update — shared fixtures for generation tests (mock LLMProvider, mock OntologyIndexService)

---

## Sources

### Primary (HIGH confidence)

- Directly read: `ontokit-api/ontokit/services/llm/base.py` — LLMProvider.chat() signature
- Directly read: `ontokit-api/ontokit/services/llm/registry.py` — get_provider() factory, 13 providers
- Directly read: `ontokit-api/ontokit/services/llm/audit.py` — log_llm_call() signature and contract
- Directly read: `ontokit-api/ontokit/services/llm/budget.py` — check_budget() signature
- Directly read: `ontokit-api/ontokit/services/llm/rate_limiter.py` — check_rate_limit(), RATE_LIMITS
- Directly read: `ontokit-api/ontokit/services/llm/role_gates.py` — check_llm_access(), LLM_ACCESS_ROLES
- Directly read: `ontokit-api/ontokit/services/llm/pricing.py` — get_model_pricing() pattern
- Directly read: `ontokit-api/ontokit/services/duplicate_check_service.py` — DuplicateCheckService.check()
- Directly read: `ontokit-api/ontokit/schemas/duplicate_check.py` — DuplicateCheckResponse schema
- Directly read: `ontokit-api/ontokit/services/reasoner_service.py` — detect_cycles(), _detect_cycles_rdflib()
- Directly read: `ontokit-api/ontokit/services/ontology_index.py` — get_class_detail(), get_class_children(), get_ancestor_path(), CTE patterns
- Directly read: `ontokit-api/ontokit/services/structural_similarity_service.py` — folio-python usage pattern
- Directly read: `ontokit-api/ontokit/api/routes/validation.py` — existing /validate endpoint
- Directly read: `ontokit-api/ontokit/api/routes/duplicate_check.py` — existing duplicate-check endpoint
- Directly read: `ontokit-api/ontokit/api/routes/__init__.py` — route registration pattern
- Directly read: `ontokit-api/ontokit/models/project.py` — ontology_iri column
- Directly read: `ontokit-api/ontokit/models/llm_config.py` — ProjectLLMConfig schema
- Directly read: `ontokit-api/ontokit/schemas/suggestion.py` — existing suggestion session schemas
- Directly read: `ontokit-api/pyproject.toml` — all installed dependencies confirmed
- Directly read: `.planning/phases/13-validation-guardrails-suggestion-generation/13-CONTEXT.md` — locked decisions
- WebFetch: `github.com/alea-institute/folio-enrich` LLM services structure — confirmed prompts directory pattern
- WebFetch: `folio-enrich/prompts/concept_identification.py` — JSON output + calibrated confidence pattern

### Secondary (MEDIUM confidence)

- WebFetch: `github.com/alea-institute` org page — confirmed no "generative-folio" repo exists (10 of 42 repos visible; folio-enrich is the relevant analog)
- WebSearch: alea-institute repositories — confirmed folio-python, folio-enrich are the relevant packages; generative-folio not found

### Tertiary (LOW confidence)

- None — all critical claims verified against source code or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from pyproject.toml and source code
- Architecture: HIGH — confirmed from existing Phase 11/12 service patterns
- Prompt templates: MEDIUM — folio-enrich pattern verified via WebFetch; exact template content must be authored; LLM JSON output quality is empirically validated at runtime
- Pitfalls: HIGH — derived from Phase 12 decisions documented in STATE.md and direct code inspection
- generative-folio gap: HIGH — confirmed absent from PyPI and GitHub as of 2026-04-06

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack; LLM provider APIs are fast-moving but abstracted away by Phase 11 registry)
