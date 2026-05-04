# Phase 13: Validation Guardrails & Suggestion Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 13-validation-guardrails-suggestion-generation
**Areas discussed:** Prompt strategy, Suggestion shape, Validation pipeline, IRI minting

---

## Prompt Strategy

### Ontology Context Assembly

| Option | Description | Selected |
|--------|-------------|----------|
| Rich local context | Current class + parents + siblings + annotations + ancestor annotations. ~2-4K tokens. | ✓ |
| Minimal context | Just label, parent, immediate siblings. Cheaper but generic results. | |
| Full branch context | Serialize entire branch root-to-current. Expensive, may exceed token limits. | |

**User's choice:** Rich local context
**Notes:** Balances quality with cost. ~2-4K tokens of structured context per call.

### Template Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Custom prompts | Build ontology-specific templates in ontokit-api. Full control, no dependency. | |
| Generative FOLIO templates | Port/adapt from alea-institute/generative-folio. Reuses existing work. | |
| Hybrid | Start with generative-folio as base, customize per suggestion type. | ✓ |

**User's choice:** Hybrid
**Notes:** Researcher must check generative-folio repo for existing templates.

### API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| One unified endpoint | POST /projects/{id}/suggest with type field. Simpler surface. | |
| Separate endpoints per type | Individual routes per suggestion type. More RESTful. | |
| You decide | Claude picks based on codebase patterns. | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion. Leaning unified with type-discriminated Pydantic schemas.

---

## Suggestion Shape

### Session Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Independent generation | Ephemeral proposals returned to caller. Accepted ones enter existing session flow. | ✓ |
| Auto-session creation | Suggest endpoint auto-creates/appends to suggestion session. | |

**User's choice:** Independent generation
**Notes:** Generation and persistence decoupled.

### Batch Size

| Option | Description | Selected |
|--------|-------------|----------|
| 3-5 per request | Sweet spot for review. | |
| 1 per request | Simpler, lower cost. | |
| Configurable (1-10) | User/project setting controls batch size. | ✓ |

**User's choice:** Configurable (1-10)
**Notes:** Default to 3-5, user can adjust.

### Confidence Scores

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized 0-1 | Parse and normalize. Consistent across providers. Null fallback. | ✓ |
| Raw LLM output | Pass through whatever LLM returns. Inconsistent. | |

**User's choice:** Normalized 0-1
**Notes:** Fall back to null if LLM doesn't provide confidence.

---

## Validation Pipeline

### Where Validation Runs

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side gate | All validation on backend. Can't be bypassed. | ✓ |
| Client + server | Quick client checks + server gate. Better UX, duplicated logic. | |

**User's choice:** Server-side gate
**Notes:** Single source of truth.

### Endpoint Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing | Add entity rules to existing POST /validate. | |
| New endpoint | Separate POST /validate-entity. | |
| You decide | Claude picks based on codebase fit. | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion on endpoint structure.

### Auto-Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-validate in pipeline | Suggest endpoint runs duplicate check + validation before returning. | ✓ |
| Separate validate call | Raw LLM output returned, frontend calls validate separately. | |

**User's choice:** Auto-validate in pipeline
**Notes:** Caller gets pre-filtered results with validation status per suggestion.

---

## IRI Minting

### IRI Format

| Option | Description | Selected |
|--------|-------------|----------|
| Project namespace + UUID | WebProtege-style. Zero collision risk. | ✓ |
| Project namespace + slug | Readable but collision risk. | |

**User's choice:** Project namespace + UUID
**Notes:** Matches VALID-06 requirement.

### Namespace Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Infer from ontology | Auto-detect owl:Ontology IRI or most common namespace. | |
| Project setting | Manual config in project settings. | |
| Both with fallback | Auto-detect first, project setting overrides. | ✓ |

**User's choice:** Both with fallback
**Notes:** Auto-detect from ontology, allow override in project settings.

---

## Claude's Discretion

- API shape (unified vs separate endpoints)
- Validation endpoint structure (extend vs new)
- Prompt template file format and organization
- Context assembly algorithm details
- Default batch sizes per suggestion type
- Error message wording

## Deferred Ideas

None — discussion stayed within phase scope
