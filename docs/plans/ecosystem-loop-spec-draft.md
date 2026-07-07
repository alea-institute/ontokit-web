# The Ecosystem Loop — Shared Suggestion Schema + Ontokit Batch-Import API

**Status:** Draft spec (brainstorm-grade). Portfolio items **II.0.1** (cross-portfolio flagship) and **II.1.3** (ontokit batch suggestion-import API).
**Author:** Fable 5 (design pass), for Damien's PM review.
**Date:** 2026-07-07.
**Depends on:** Workstream B (Suggestion→OWL write-back, II.1.1). See [Sequencing](#8-sequencing--dependencies).

> This is a **design/spec deliverable**, not an implementation. It fixes the contract (schema + API) so the feeders and ontokit can be built against a stable target, and surfaces the PM-level decisions that must be made before code.

---

## 1. Problem & vision

### 1.1 The flywheel

Today the portfolio is **8 separate products** that each independently rub up against the same friction: the FOLIO ontology is incomplete for their input. Each hits the gap, works around it locally, and throws the signal away:

- **folio-enrich** annotates documents. When a text span has no adequate FOLIO concept (or only a low-confidence match), it currently either drops the span or stores a local record — the miss is lost.
- **alea-intake** analyzes consumer legal situations. When a situation can't be mapped, `handle_unmapped_concept()` mints a *local* IRI and records `nearest_concepts` — a perfectly-formed suggestion that never leaves the app.
- **folio-mapper** maps customer taxonomies to FOLIO. A taxonomy node with no candidate above threshold is an unmatched node — a documented gap in FOLIO's coverage, discarded after the session.
- **folio-insights** measures corpus coverage over the taxonomy. Its coverage heatmap *is* a concept-gap report, but it only informs acquisition, not the ontology.

Each of these is a **feeder**: a tool that, during normal operation, discovers exactly where FOLIO is weak. The Ecosystem Loop connects them:

```
  feeders (enrich, intake, mapper, insights, generative-folio, hydration)
        │  emit shared `suggestion` JSON during normal operation
        ▼
  ontokit batch-import API  ──►  dedupe cascade  ──►  suggestion queue
        │                                                    │
        │                                            human review (existing UI)
        ▼                                                    ▼
  Workstream B write-back  ◄────────────────────  approved changes
        │  (OWL diff → branch → PR to FOLIO repo, with provenance)
        ▼
  FOLIO release  ──►  every feeder re-pulls the ontology  ──►  every tool upgrades
        └──────────────────────── loop closes ────────────────────────┘
```

### 1.2 Why this is the strongest strategic asset

- **Compounding, not additive.** Each feeder makes FOLIO better; a better FOLIO makes *every* feeder better. Value grows super-linearly with the number of tools and the volume of documents they process.
- **Zero marginal acquisition cost.** The highest-value gold data — the concepts FOLIO is *missing* — is produced as a byproduct of paying work the tools already do. Competitors would have to run a parallel curation program; here it falls out of usage.
- **Moat.** No single competitor tool has the closed loop. An 8-product portfolio feeding one standard is a structural advantage a point-solution cannot replicate.
- **One review surface.** Every feeder routes through *one* queue and *one* write-back path (Workstream B). No per-tool curation UI to build or maintain.

### 1.3 Feeders and consumers

| Role | Tool | What it emits / consumes |
|---|---|---|
| Feeder | folio-enrich | Unmapped / low-confidence document spans → `new-concept`, `mapping` |
| Feeder | alea-intake | Unmappable consumer situations (local IRI + nearest concepts) → `new-concept`, `parent-placement` |
| Feeder | folio-mapper | Unmatched customer-taxonomy nodes; **confirmed** standards mappings → `new-concept`, `mapping` |
| Feeder | folio-insights | Coverage gaps over taxonomy branches → `new-concept` (aggregate) |
| Feeder | generative-folio | Batch-generated definitions / translations / examples → `definition`, `translation`, `example` |
| Feeder | Hydration program (Workstream B) | Bulk component fills for the ~18K-concept backlog → `definition`, `translation`, `example` |
| Consumer | All of the above | Re-pull FOLIO after each release; upgraded coverage |
| Consumer | ontokit reviewers | Triage the unified queue; approve → write-back |

**A feeder is not a new product.** It is a ~200-line client-lib call added to code paths that already detect the gap. The design principle: *the schema must fit what producers already have in hand at the moment of the miss* — see §3.4 for the field-by-field mapping to real producer types (`ConceptMatch`, `FolioCandidate`, `UnmappedConceptData`).

---

## 2. Design constraints from the existing codebase

Grounding the spec in what ontokit-api and the feeders already are (reconnaissance, not audit):

- **ontokit-api stack** — FastAPI (Python 3.11+), PostgreSQL 17 + SQLAlchemy 2.0 async, Redis, MinIO, **Zitadel OIDC** auth, **pgvector** embeddings, RDFLib/OWLReady2. All routes under `/api/v1`; project-scoped routes use `/projects/{project_id}/...`.
- **"Suggestion" is already an overloaded word here.** The existing `SuggestionSession` model is a *human, git-branch editing session* that a suggester saves Turtle into and submits as a **PR** (`suggestion_sessions` table → `pull_requests`). The Ecosystem Loop introduces a **different, complementary object**: a machine-emitted, structured, atomic `suggestion`. To avoid collision this spec names the new object an **ImportedSuggestion** (queue item) and its API surface **`/suggestions/import`**. Approved ImportedSuggestions *materialize into* the existing session→PR write-back — they do not replace it.
- **Dedupe primitives already exist and should be reused, not reinvented:**
  - `duplicate_detection_service.find_duplicates()` — deterministic `difflib` label similarity, clustered within entity type. This is the **normalized-label** stage.
  - `embedding_service` + pgvector — `RankSuggestionRequest`/`RankedCandidate`, `SemanticSearchResponse`, `SimilarEntity`. This is the **embedding-similarity** stage.
  - `embedding_text_builder.build_embedding_text()` — canonical "`{type}: {label}. {definition}. Parents: … . Also known as: …`" string. The import schema's `dedupe.embedding_text` field should be **produced in this exact shape** so feeder text and ontology text share an embedding space.
- **This is the gestalt rule in miniature** (portfolio II.0, Damien 2026-07-05): deterministic candidate generation (normalized-label match) → probabilistic ranking (embeddings) → deterministic validation / human gate. The dedupe cascade in §4.4 *is* that rule applied to inbound suggestions.
- **Web review surface exists:** `app/projects/[id]/suggestions` and `.../suggestions/review`. Imported suggestions get a source-tagged view within it (§7).

---

## 3. The shared suggestion schema (core deliverable)

One versioned JSON Schema, emitted by every feeder, consumed by the import API. **Versioned, source-tagged, provenance-first.**

### 3.1 Design decisions (brainstorm discipline)

| # | Decision | Options | Recommendation & rationale |
|---|---|---|---|
| D1 | Schema format | JSON Schema 2020-12 vs Pydantic-only vs Protobuf | **JSON Schema 2020-12** + generated Pydantic model. Language-neutral (feeders are Python *and* TS — mapper/intake frontends), self-documenting, validates at the API boundary, and OpenAPI-native for the endpoint. |
| D2 | Versioning | Single `schema_version` string vs per-field | **Single top-level `schema_version`** (semver, starts `1.0.0`) + a `$id` URL. Minor = additive/optional; major = breaking. Import API accepts a documented range and rejects unknown-major. |
| D3 | One envelope, typed payload vs many schemas | Union of full schemas per type vs one envelope + `payload` object keyed by `type` | **One envelope + discriminated `payload`.** Envelope carries the universal fields (id, source, provenance, target, dedupe); `payload` is validated by a sub-schema chosen from `suggestion_type`. Feeders share 90% of the code; new types don't fork the envelope. |
| D4 | ID ownership | Feeder-generated vs server-generated | **Feeder-generated `suggestion_id` (UUIDv4 or content hash)** used as the **idempotency key**; server assigns its own `queue_item_id`. Lets feeders retry safely and dedupe their own re-emissions (D3 idempotency). |
| D5 | Target of a suggestion | IRI-only vs IRI-or-"new" | **`target.iri` OR `target.kind:"new"`** with an optional feeder-minted `local_iri` (intake already mints these via folio-python `generate_iri()`). Preserves the feeder's provisional identity through review. |
| D6 | Confidence semantics | Single float vs typed | **`provenance.confidence` float 0–1 + `confidence_kind`** enum (`llm`, `embedding`, `string`, `human-confirmed`, `deterministic`). A 0.9 from an LLM guess ≠ 0.9 from a human confirmation; trust tiering (§7.3, QA-3) needs the distinction. |
| D7 | Evidence | Free-text vs structured | **Structured `evidence`**: span offsets + surrounding sentence (enrich already has `Span{start,end,text,sentence_text}`), or a source-doc reference, or nearest-concept list (intake `nearest_concepts`). Reviewers need to see *why*. |

### 3.2 JSON Schema (`suggestion.schema.json`, v1.0.0)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ontokit.openlegalstandard.org/schemas/suggestion/1.0.0.json",
  "title": "FOLIO Ecosystem Suggestion",
  "type": "object",
  "required": ["schema_version", "suggestion_id", "source", "suggestion_type", "target", "payload", "provenance"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "type": "string", "const": "1.0.0" },

    "suggestion_id": {
      "type": "string",
      "description": "Feeder-generated stable id (UUIDv4 or content hash). Idempotency key.",
      "minLength": 8
    },

    "source": {
      "type": "object",
      "required": ["tool", "tool_version"],
      "additionalProperties": false,
      "properties": {
        "tool": { "type": "string", "enum": ["folio-enrich", "alea-intake", "folio-mapper", "folio-insights", "generative-folio", "hydration", "ontokit-manual"] },
        "tool_version": { "type": "string", "description": "Semver or git sha of the emitting build." },
        "instance": { "type": "string", "description": "Optional deployment/tenant id." },
        "trust_tier": { "type": "string", "enum": ["human-confirmed", "deterministic", "assisted", "raw-llm"], "description": "Feeder's self-declared tier; server re-derives authoritatively (see §7.3)." }
      }
    },

    "suggestion_type": {
      "type": "string",
      "enum": ["new-concept", "definition", "translation", "example", "mapping", "parent-placement", "alt-label", "cross-reference", "deprecation"]
    },

    "target": {
      "type": "object",
      "required": ["kind"],
      "properties": {
        "kind": { "type": "string", "enum": ["existing", "new"] },
        "iri": { "type": "string", "format": "iri", "description": "Required when kind=existing." },
        "local_iri": { "type": "string", "description": "Feeder-minted provisional IRI when kind=new (e.g. folio-python generate_iri())." },
        "branch": { "type": "string", "description": "FOLIO branch hint, e.g. 'Area of Law', 'Document-Artifact'." }
      },
      "allOf": [
        { "if": { "properties": { "kind": { "const": "existing" } } }, "then": { "required": ["iri"] } }
      ]
    },

    "payload": {
      "type": "object",
      "description": "Type-specific. Validated by the sub-schema selected from suggestion_type. See §3.3.",
      "additionalProperties": true
    },

    "provenance": {
      "type": "object",
      "required": ["originating_tool", "created_at", "confidence", "confidence_kind"],
      "additionalProperties": false,
      "properties": {
        "originating_tool": { "type": "string" },
        "model": {
          "type": "object",
          "description": "Present when an LLM/embedding model produced or ranked the suggestion.",
          "properties": {
            "provider": { "type": "string", "examples": ["anthropic", "openai", "voyage", "local"] },
            "name": { "type": "string", "examples": ["claude-opus-4-8", "text-embedding-3-large"] },
            "role": { "type": "string", "enum": ["generator", "ranker", "judge"] }
          }
        },
        "actor": {
          "type": "object",
          "description": "Human in the loop, if any (confirmer/reviewer at the feeder).",
          "properties": {
            "user_id": { "type": "string" },
            "display_name": { "type": "string" },
            "action": { "type": "string", "enum": ["confirmed", "authored", "rejected-alternative"] }
          }
        },
        "created_at": { "type": "string", "format": "date-time" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "confidence_kind": { "type": "string", "enum": ["llm", "embedding", "string", "human-confirmed", "deterministic"] },
        "evidence": {
          "type": "object",
          "description": "Why this suggestion exists — shown to reviewers.",
          "properties": {
            "span": {
              "type": "object",
              "properties": {
                "text": { "type": "string" },
                "start": { "type": "integer" },
                "end": { "type": "integer" },
                "sentence": { "type": "string" }
              }
            },
            "source_document": {
              "type": "object",
              "properties": {
                "ref": { "type": "string", "description": "URI, doc id, or citation." },
                "title": { "type": "string" }
              }
            },
            "nearest_concepts": {
              "type": "array",
              "description": "Deterministic/embedding near-misses that fell below threshold.",
              "items": {
                "type": "object",
                "properties": {
                  "iri": { "type": "string" },
                  "label": { "type": "string" },
                  "score": { "type": "number" }
                }
              }
            }
          }
        }
      }
    },

    "dedupe": {
      "type": "object",
      "description": "Precomputed hints so the API can run the cascade cheaply.",
      "required": ["normalized_label"],
      "properties": {
        "normalized_label": { "type": "string", "description": "lower/trim/collapse-ws/strip-punct of the primary label." },
        "embedding_text": { "type": "string", "description": "Built in embedding_text_builder shape: '{type}: {label}. {definition}. Parents: … . Also known as: …'." },
        "embedding": {
          "type": "object",
          "description": "Optional precomputed vector; server re-embeds if absent or model-mismatched.",
          "properties": {
            "model": { "type": "string" },
            "dim": { "type": "integer" },
            "vector": { "type": "array", "items": { "type": "number" } }
          }
        }
      }
    }
  }
}
```

### 3.3 Payload sub-schemas (by `suggestion_type`)

Selected via discriminator; each validates `payload`:

- **`new-concept`** — `{ label, definition?, alt_labels?[], branch?, proposed_parents?[iri|label], examples?[], translations?{lang:str} }`
- **`definition`** — `{ text, language?="en" }` (target.kind=existing)
- **`translation`** — `{ language, label?, definition? }`
- **`example`** — `{ text, language?="en" }`
- **`mapping`** — `{ external_label, external_id?, external_scheme?, relation:"exactMatch|closeMatch|broadMatch|narrowMatch", standard_branch? }` (mapper's standards→FOLIO push; relation uses SKOS)
- **`parent-placement`** — `{ proposed_parent_iri | proposed_parent_label, relation:"subClassOf|subPropertyOf" }`
- **`alt-label`** — `{ label, language?="en" }`
- **`cross-reference`** — `{ related_iri, relation:"seeAlso|relatedMatch" }`
- **`deprecation`** — `{ reason, replaced_by_iri? }`

### 3.4 Field mapping to real producer types (fit-check)

The schema is designed *around* what feeders already hold at the miss:

| Envelope field | folio-enrich `ConceptMatch`/`Span` | alea-intake `UnmappedConceptData` | folio-mapper `FolioCandidate`/node |
|---|---|---|---|
| `suggestion_type` | `new-concept` (no iri) / `mapping` (low-conf iri) | `new-concept` | `mapping` (confirmed) / `new-concept` (unmatched) |
| `target.iri` / `local_iri` | `folio_iri` (if low-conf) / — | `local_iri` | `iri` / — |
| `target.branch` | `branches[0]` | `suggested_branch` | `branch` |
| `payload.label` | `concept_text` | `original_text` | source taxonomy node label |
| `provenance.confidence` | `confidence` (0–1) | `unmapped_confidence` | `score`/100 |
| `provenance.confidence_kind` | `source` → llm/string | `llm` | `human-confirmed` if user-confirmed, else `embedding` |
| `evidence.span` | `Span{start,end,text,sentence_text}` | — | — |
| `evidence.nearest_concepts` | backup matches | `nearest_concepts[{iri,label,confidence}]` | sub-threshold `branch_groups` |
| `evidence.source_document` | job/document ref | intake session ref | uploaded taxonomy file ref |

The mapping is near-lossless in every case — evidence the envelope fits reality rather than an idealized producer.

### 3.5 Example instances

**Example A — folio-enrich, unmapped span (`new-concept`):**

```json
{
  "schema_version": "1.0.0",
  "suggestion_id": "enr-8f1c2a9e-3b7d-4c11-9a02-6d5e1f0b3a44",
  "source": { "tool": "folio-enrich", "tool_version": "2.4.1", "trust_tier": "raw-llm" },
  "suggestion_type": "new-concept",
  "target": { "kind": "new", "branch": "Document-Artifact" },
  "payload": {
    "label": "Data Processing Addendum",
    "definition": "A contractual annex governing the processing of personal data between controller and processor.",
    "alt_labels": ["DPA"],
    "proposed_parents": ["Contract Annex"]
  },
  "provenance": {
    "originating_tool": "folio-enrich",
    "model": { "provider": "anthropic", "name": "claude-opus-4-8", "role": "generator" },
    "created_at": "2026-07-07T14:03:22Z",
    "confidence": 0.41,
    "confidence_kind": "llm",
    "evidence": {
      "span": { "text": "Data Processing Addendum", "start": 1187, "end": 1211,
                "sentence": "The parties shall execute a Data Processing Addendum prior to any transfer." },
      "source_document": { "ref": "job:9d2a/doc:3", "title": "MSA — Acme/Globex" },
      "nearest_concepts": [
        { "iri": "https://folio.openlegalstandard.org/R8x…", "label": "Addendum", "score": 0.58 }
      ]
    }
  },
  "dedupe": {
    "normalized_label": "data processing addendum",
    "embedding_text": "class: Data Processing Addendum. A contractual annex governing the processing of personal data between controller and processor. Parents: Contract Annex. Also known as: DPA"
  }
}
```

**Example B — alea-intake, unmappable consumer situation (`new-concept`, with local IRI):**

```json
{
  "schema_version": "1.0.0",
  "suggestion_id": "int-3c0b7d21-aa5e-4f88-b1c2-77e9a0d4e510",
  "source": { "tool": "alea-intake", "tool_version": "1.7.0", "trust_tier": "raw-llm" },
  "suggestion_type": "new-concept",
  "target": {
    "kind": "new",
    "local_iri": "https://folio.openlegalstandard.org/Rlocal-8823ff1a",
    "branch": "Area of Law"
  },
  "payload": {
    "label": "Buy-Now-Pay-Later Dispute",
    "definition": "A consumer dispute arising from a short-term point-of-sale installment credit arrangement.",
    "proposed_parents": ["Consumer Credit Dispute"]
  },
  "provenance": {
    "originating_tool": "alea-intake",
    "model": { "provider": "anthropic", "name": "claude-opus-4-8", "role": "generator" },
    "created_at": "2026-07-07T14:05:10Z",
    "confidence": 0.88,
    "confidence_kind": "llm",
    "evidence": {
      "source_document": { "ref": "intake-session:5521", "title": "Consumer intake narrative" },
      "nearest_concepts": [
        { "iri": "https://folio.openlegalstandard.org/R2p…", "label": "Consumer Credit Dispute", "score": 0.72 },
        { "iri": "https://folio.openlegalstandard.org/R9k…", "label": "Installment Loan Dispute", "score": 0.69 }
      ]
    }
  },
  "dedupe": {
    "normalized_label": "buy now pay later dispute",
    "embedding_text": "class: Buy-Now-Pay-Later Dispute. A consumer dispute arising from a short-term point-of-sale installment credit arrangement. Parents: Consumer Credit Dispute"
  }
}
```

**Example C — folio-mapper, confirmed standards mapping (`mapping`, high-trust):**

```json
{
  "schema_version": "1.0.0",
  "suggestion_id": "map-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "source": { "tool": "folio-mapper", "tool_version": "3.1.2", "trust_tier": "human-confirmed" },
  "suggestion_type": "mapping",
  "target": {
    "kind": "existing",
    "iri": "https://folio.openlegalstandard.org/R7tQ…",
    "branch": "Standards Compatibility"
  },
  "payload": {
    "external_label": "Records Management Policy",
    "external_id": "ISO-15489:5.2",
    "external_scheme": "ISO 15489-1:2016",
    "relation": "closeMatch",
    "standard_branch": "Standards Compatibility"
  },
  "provenance": {
    "originating_tool": "folio-mapper",
    "model": { "provider": "voyage", "name": "voyage-3", "role": "ranker" },
    "actor": { "user_id": "u-4471", "display_name": "K. Ober", "action": "confirmed" },
    "created_at": "2026-07-07T14:09:41Z",
    "confidence": 0.98,
    "confidence_kind": "human-confirmed",
    "evidence": {
      "source_document": { "ref": "mapper-run:882", "title": "ISO 15489 → FOLIO" },
      "nearest_concepts": [
        { "iri": "https://folio.openlegalstandard.org/R7tQ…", "label": "Records Management Policy", "score": 0.91 }
      ]
    }
  },
  "dedupe": {
    "normalized_label": "records management policy",
    "embedding_text": "mapping: Records Management Policy (ISO 15489-1:2016 §5.2) closeMatch"
  }
}
```

---

## 4. Ontokit batch-import API spec

### 4.1 Design decisions (brainstorm discipline)

| # | Decision | Options | Recommendation & rationale |
|---|---|---|---|
| A1 | Batch vs single | One endpoint accepting an array vs single-item only | **Batch POST** (`items[]`, up to N per request) + the same schema for one item. Feeders emit in bursts (a mapper run yields hundreds); batching cuts round-trips and lets dedupe run set-wise (dedupe *within* a batch too). |
| A2 | Sync vs async | Validate+dedupe inline vs enqueue+job | **Hybrid**: validate synchronously (fast, deterministic), return per-item accept/reject immediately; run **embedding dedupe asynchronously** via the existing worker (embeddings can be slow / call external providers). Response gives each item a status that may be `pending-dedupe`. |
| A3 | Auth for machine feeders | Reuse Zitadel user OIDC vs service tokens | **Zitadel service accounts (client-credentials) → scoped API keys**, one per feeder, carrying the feeder's **trust tier** as a claim. Keeps a single IdP; server derives trust from the credential, not the payload (payload `trust_tier` is advisory only). |
| A4 | Idempotency | None vs key | **`suggestion_id` is the idempotency key**, scoped per source tool. Re-POSTing the same id is a no-op returning the prior queue_item_id. Also accept an `Idempotency-Key` header for whole-batch replay. |
| A5 | Project scoping | Global queue vs per-project | **Per-project** (`/projects/{project_id}/suggestions/import`) to match existing route shape and the FOLIO-vs-Canon multi-ontology reality; a feeder targets the project whose ontology it pulled. |
| A6 | Dedupe placement | In feeder vs in server | **Server-authoritative** dedupe (feeders supply hints only). The server has the live ontology + pending queue; feeders have a possibly-stale snapshot. Hints make it cheap; authority stays central. |
| A7 | Rejection vs quarantine | Hard-reject invalid vs accept-and-flag | **Reject on schema/auth failure** (4xx, per-item); **accept-and-flag** on dedupe collisions (they become review signal, not errors). |

### 4.2 Primary endpoint — OpenAPI sketch

```yaml
openapi: 3.1.0
info: { title: Ontokit Suggestion Import API, version: 1.0.0 }
paths:
  /api/v1/projects/{project_id}/suggestions/import:
    post:
      summary: Batch-import feeder suggestions into the review queue
      operationId: importSuggestions
      security: [ { serviceApiKey: [] } ]
      parameters:
        - name: project_id
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: Idempotency-Key
          in: header
          required: false
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [items]
              properties:
                items:
                  type: array
                  minItems: 1
                  maxItems: 500
                  items: { $ref: 'https://ontokit.openlegalstandard.org/schemas/suggestion/1.0.0.json' }
                options:
                  type: object
                  properties:
                    dedupe_mode: { type: string, enum: [strict, standard, off], default: standard }
                    dry_run: { type: boolean, default: false }
      responses:
        '202':
          description: Accepted (some items may be pending async dedupe)
          content:
            application/json:
              schema:
                type: object
                properties:
                  batch_id: { type: string, format: uuid }
                  accepted: { type: integer }
                  rejected: { type: integer }
                  results:
                    type: array
                    items:
                      type: object
                      properties:
                        suggestion_id: { type: string }
                        status:
                          type: string
                          enum: [queued, pending-dedupe, merged-duplicate, flagged-duplicate, rejected]
                        queue_item_id: { type: string, format: uuid, nullable: true }
                        dedupe:
                          type: object
                          nullable: true
                          properties:
                            stage: { type: string, enum: [exact-label, embedding, none] }
                            matched_iri: { type: string, nullable: true }
                            matched_queue_item_id: { type: string, nullable: true }
                            score: { type: number, nullable: true }
                        errors:
                          type: array
                          items: { type: object, properties: { code: {type: string}, field: {type: string}, message: {type: string} } }
        '400': { description: Malformed batch (not per-item; whole-body invalid) }
        '401': { description: Missing/invalid service key }
        '403': { description: Key lacks scope for this project }
        '409': { description: Idempotency-Key replay with a different body }
        '422': { description: Schema validation failed for the batch envelope }
        '429': { description: Rate limit exceeded (see §4.6) }
  /api/v1/projects/{project_id}/suggestions/import/batches/{batch_id}:
    get:
      summary: Poll async dedupe results for a batch
      security: [ { serviceApiKey: [] } ]
      responses:
        '200': { description: Per-item final statuses once dedupe completes }
components:
  securitySchemes:
    serviceApiKey:
      type: apiKey
      in: header
      name: X-Ontokit-Key   # Zitadel-issued service credential; carries trust_tier claim
```

### 4.3 Batch semantics

- **Per-item outcomes, not all-or-nothing.** A batch of 500 with 3 malformed items returns 202 with 497 queued/pending and 3 `rejected` (each with `errors`). Only a structurally broken *envelope* is 400/422.
- **Intra-batch dedupe.** Two items in the same batch with the same normalized label collapse to one queue item (the higher-confidence / higher-trust one wins; the other is recorded as a corroborating source — raising the merged item's evidence weight).
- **`dry_run`** returns the same `results` shape with no writes — feeders and CI use it to preview.

### 4.4 The dedupe cascade (gestalt: deterministic → probabilistic → human)

Runs **against both the live ontology and the pending queue** (a near-duplicate of a *pending* suggestion should merge, not create a second queue item). Stages, cheapest first:

1. **Stage 0 — validation + normalization** (sync, deterministic). Schema-validate; recompute `normalized_label` server-side (never trust the client's) via the same normalizer used by `normalization_service`; recompute `embedding_text` in `embedding_text_builder` shape.
2. **Stage 1 — exact/near normalized-label match** (sync, deterministic). Reuse `duplicate_detection_service` logic (`difflib` ratio ≥ label threshold, **within the same target branch/entity type**) against (a) ontology labels + alt-labels and (b) pending-queue normalized labels.
   - Hit ≥ `exact_threshold` (default 0.95) → **merged-duplicate**: attach this source as corroboration to the existing concept/queue item; do not create a new item.
3. **Stage 2 — embedding similarity** (async, probabilistic). If Stage 1 is inconclusive, embed `embedding_text` (reuse client vector if model matches `ProjectEmbeddingConfig`; else re-embed via `embedding_service`) and run pgvector top-k against ontology + pending queue.
   - Score ≥ `auto_merge_threshold` → **merged-duplicate** (see QA-2 — whether this auto-merges or still flags is a **policy decision**).
   - `flag_threshold` ≤ score < `auto_merge_threshold` → **flagged-duplicate**: queue item created but tagged "possible duplicate of X" for the reviewer.
   - score < `flag_threshold` → **queued** as net-new.
4. **Stage 3 — human review** (the existing queue UI). All `queued` and `flagged-duplicate` items land here; `merged-duplicate` items surface only as corroboration weight on their target.

`dedupe_mode`: `strict` lowers thresholds (more flagging, fewer silent merges); `off` skips Stages 1–2 (for trusted bulk hydration that has pre-deduped); `standard` is the default cascade.

### 4.5 Validation & error handling

- **Schema errors** → per-item `rejected` with JSON-Pointer `field` + `code` (`schema.required`, `schema.enum`, `iri.malformed`).
- **Semantic errors** → `target.kind=existing` but `iri` not found in project ontology → `rejected` (`target.iri.unknown`); reviewer can't act on a phantom target.
- **Trust/scope** → key not authorized for `suggestion_type=deprecation` (destructive) → `rejected` (`scope.forbidden`) — deprecations may be restricted to high-trust feeders (QA-3).
- **Poison-pill isolation** — one bad item never fails its batch-mates.

### 4.6 Idempotency, rate limits

- **Idempotency:** `suggestion_id` unique per `(source.tool, project_id)`; replay → prior `queue_item_id`, status `queued` (no-op). Whole-batch `Idempotency-Key` caches the batch response for 24h; replay with a *different* body → 409.
- **Rate limits:** per-service-key token bucket (reuse `ontokit/api/utils/redis.py` + `rate_limit` patterns from the feeders). Suggested defaults: 500 items/request, 10 requests/min/key, 50k items/day/key for bulk feeders (hydration gets a higher tier). 429 returns `Retry-After`.

---

## 5. Client library sketch

A thin library each feeder imports. **Match ontokit's stack (Python) as primary; TS variant for the mapper/intake frontends.**

### 5.1 Design decisions

| # | Decision | Recommendation |
|---|---|---|
| C1 | Language(s) | **Python primary** (enrich, intake, insights, mapper backend, generative-folio, hydration are all Python). **TS secondary** for browser-side emission where a feeder confirms in the UI. |
| C2 | Packaging | Publish as `folio-suggest` (PyPI) + `@folio/suggest` (npm). Vendors the JSON Schema; validates locally before send (fail fast, save round-trips). |
| C3 | Buffering | Built-in batching + retry with backoff + idempotent replay (uses `suggestion_id`). Feeders call `emit(...)`; the lib flushes on size/time. |
| C4 | Embedding text | Lib computes `dedupe.normalized_label` and `dedupe.embedding_text` in the ontokit shape so producers never hand-roll it. |

### 5.2 Python API (illustrative)

```python
from folio_suggest import SuggestionClient, NewConcept, Evidence, Span, Model

client = SuggestionClient(
    base_url="https://api.ontokit.openlegalstandard.org",
    project_id="…",
    api_key=os.environ["ONTOKIT_SUGGEST_KEY"],   # Zitadel service credential
    source_tool="folio-enrich",
    tool_version=folio_enrich.__version__,
    trust_tier="raw-llm",
)

# In folio-enrich's unmapped-span path (backend/app/pipeline/…):
client.emit(
    NewConcept(
        label=match.concept_text,
        branch=(match.branches or [None])[0],
        definition=None,
    ),
    confidence=match.confidence,
    confidence_kind="llm",
    model=Model(provider="anthropic", name=settings.llm_model, role="generator"),
    evidence=Evidence(
        span=Span(text=span.text, start=span.start, end=span.end, sentence=span.sentence_text),
        source_document={"ref": f"job:{job_id}/doc:{doc_idx}"},
    ),
)   # buffered; auto-flushes → POST /suggestions/import

client.flush()   # or context-manager exit; retries idempotently on 5xx/429
```

### 5.3 TypeScript API (illustrative)

```ts
import { SuggestionClient } from "@folio/suggest";

const client = new SuggestionClient({
  baseUrl, projectId, apiKey, sourceTool: "folio-mapper",
  toolVersion: pkg.version, trustTier: "human-confirmed",
});

// When a user confirms a standards mapping in the mapper UI:
await client.emit({
  suggestionType: "mapping",
  target: { kind: "existing", iri: candidate.iri, branch: "Standards Compatibility" },
  payload: { externalLabel: node.label, externalScheme: standard.id, relation: "closeMatch" },
  provenance: { confidence: 0.98, confidenceKind: "human-confirmed",
                actor: { userId, action: "confirmed" } },
});
```

Both clients: local schema validation → buffer → batched POST → idempotent retry → return per-item status.

---

## 6. Queue & review integration

- **Where imported suggestions land.** A new `imported_suggestions` table (queue items), FK to `projects`, distinct from `suggestion_sessions` (which stays the human-editing/PR object). An `ImportedSuggestion` carries the full envelope (jsonb) + server-derived fields: `queue_item_id`, `status`, `dedupe_stage`, `matched_iri`, `corroborations[]` (list of source suggestion_ids merged in), `trust_tier` (server-derived), `review_state`.
- **Materialization on approve.** Approving an ImportedSuggestion **generates the Turtle edit and opens/append s to a `SuggestionSession` → PR** via the existing `suggestion_service` + Workstream B write-back. This reuses the entire existing review→PR→FOLIO pipeline; imported suggestions are just a *new inbound source* for it, not a parallel path.
- **UI (`app/projects/[id]/suggestions`).** Add a source-tagged, filterable queue view:
  - **Source chips** — `folio-enrich`, `alea-intake`, `folio-mapper`, etc., with counts; filter by source, type, branch, trust tier, dedupe status.
  - **Corroboration badge** — "3 feeders suggested this" (merged duplicates) ranks an item up: independent multi-source agreement is strong signal.
  - **Evidence panel** — render `provenance.evidence` (the span-in-sentence, source doc link, nearest-concepts with scores) so a reviewer decides in seconds.
  - **Provenance line** — "enrich 2.4.1 · claude-opus-4-8 (generator) · conf 0.41 (llm) · 2026-07-07".
  - **Flagged-duplicate** items show the suspected match inline with a merge/keep-both action.
- **Trust-tier handling in the queue.** Tier drives default sort and which stages an item may skip (§7.3): high-trust items can present as "fast-track" (pre-checked), low-trust as "needs scrutiny". Tier is **server-derived from the credential**, shown as a badge; the payload's self-declared tier is advisory and never elevates trust.

---

## 7. Cross-cutting decisions & the PM questions

### 7.1 Enumerated design decisions (recap of recommendations)

Schema: JSON Schema 2020-12 + generated Pydantic (D1); single top-level semver (D2); envelope + discriminated payload (D3); feeder-generated id as idempotency key (D4); IRI-or-new target with feeder local_iri (D5); confidence + confidence_kind (D6); structured evidence (D7).
API: batch POST with per-item results (A1); hybrid sync-validate / async-embed (A2); Zitadel service keys carrying trust tier (A3); suggestion_id idempotency (A4); per-project scoping (A5); server-authoritative dedupe (A6); reject-invalid / flag-duplicate (A7).
Client: Python primary + TS secondary (C1); vendored schema, local validation (C2); built-in batching/retry (C3); lib computes dedupe hints (C4).

### 7.2 Genuinely PM-level questions

These three are **not** engineering calls — they're policy/ownership and belong to Damien. Recommendations below; formatted as QA items in the report for the queue.

- **QA-1 — Queue ownership / triage.** Who owns and triages the *unified* queue across all feeders?
- **QA-2 — Dedupe policy.** Auto-merge above a threshold, or always route near-duplicates to a human?
- **QA-3 — Per-source trust tiers.** Should high-trust feeders (human-confirmed mapper mappings) skip stages that low-trust feeders (raw LLM guesses) must pass?

(Full option sets + recommendations are in the report's QA JSONL for appending to `briefs/qa/pending-questions.jsonl`.)

### 7.3 Damien decisions (QA round-1, 2026-07-07)

Round-1 QA-portal answers to §7.2 (`briefs/qa/round-1-answers.json`, submitted 2026-07-07 07:45). These are **locked policy** and bind the build:

- **q5 (QA-1 — Queue ownership / triage): Single ontology steward, ROUND-ROBIN batches allowed.** One steward owns a given decision, but ownership rotates *per batch* — a different steward may own each import batch. **Design impact:** the queue's batch-assignment must be first-class. Each ingest batch (from A1's `POST /suggestions/import` `items[]`) gets an `assigned_steward` field, assignable independently per batch (round-robin or manual). The unified queue is single-owner *at the item/decision level* but multi-owner *across batches* — model `queue_batch` as the assignment unit, not the whole queue. Sort/filter by `assigned_steward` in the review UI (§6 source chips gain a steward facet).
- **q6 (QA-2 — Dedupe policy): Tiered — auto-merge only deterministic exact-label; embedding near-dups always human-flagged.** In the §4.4 cascade: **Stage 1 (deterministic)** may auto-merge ONLY when the normalized-label match is exact AND score ≥ 0.95 AND the candidate is same-branch and same suggestion_type — those become `merged-duplicate` silently. **Stage 2 (embedding/probabilistic)** near-duplicates are NEVER auto-merged: they always land as `flagged-duplicate` for a human. This makes `auto_merge_threshold` apply to Stage 1 only; Stage 2 has no auto-merge path regardless of similarity. (Reinforces the gestalt rule §2.4: deterministic auto, probabilistic → human gate.)
- **q7 (QA-3 — Per-source trust tiers): Credential-derived tiers gate stage-skipping; human write-back gate never removed; destructive types high-trust-only.** Trust tier is **server-derived from the Zitadel service credential** (§4.1 A3), never from the payload's advisory `trust_tier`. Tier gates which *dedupe/validation* stages an item may fast-track (high-trust may skip scrutiny stages; raw-llm never skips). **Hard invariant:** the human approve→OWL write-back gate (Workstream B, §8) is NEVER removed by any trust tier — no feeder, however trusted, writes to FOLIO without human approval. **Destructive suggestion types** (`deprecation`, and any type that restructures/removes rather than adds) are restricted to high-trust credentials only (`human-confirmed`/`deterministic`); low-trust keys receive `scope.forbidden` (§4.4 rejection example). Additive types (new concept, mapping) remain open to all tiers subject to the standard cascade.

---

## 8. Sequencing & dependencies

**Rides Workstream B.** The Ecosystem Loop's *output* side (approve → OWL diff → PR to FOLIO) is Workstream B (II.1.1, "Suggestion→OWL write-back"). This spec is the *input* side. Ordering:

1. **Prerequisite — Workstream B write-back exists.** Approved suggestions must be able to reach FOLIO as PRs, or the queue dead-ends in a database (portfolio II.1.1). The import API can be *built* in parallel but delivers no loop value until write-back lands.
2. **Prerequisite — embedding infra per project.** Stage-2 dedupe needs `ProjectEmbeddingConfig` + populated `EntityEmbedding` for the target ontology (already in ontokit-api; must be *enabled/backfilled* for FOLIO).
3. **Phase 1 (this spec's build):** freeze `suggestion.schema.json` v1.0.0; ship `POST /suggestions/import` with Stage 0–1 (deterministic) dedupe + queue landing + service-key auth; ship `folio-suggest` Python client.
4. **Phase 2:** async Stage-2 embedding dedupe; corroboration weighting; source-tagged review UI.
5. **Phase 3 — first feeder:** **folio-enrich unmapped/low-confidence spans** (portfolio Roadmap #1 & II.4.1/II.4.4 — highest-volume signal). Its false-negative-correction affordance (span → cascade → "no adequate concept") is the natural first emit point.
6. **Phase 4 — remaining feeders:** intake (II.5 unmapped reports), mapper (II.6.0 standards mappings — lowest-risk, additive, first *production* write-back use case per Roadmap #2), insights (coverage gaps), then generative-folio/hydration as bulk feeders.

**Lowest-risk first production use:** folio-mapper's confirmed standards mappings are purely *additive* (a new SKOS mapping under the Standards-Compatibility branch, no restructuring), human-confirmed (high trust), and in immediate demand — the ideal first end-to-end loop to prove the pipeline before opening the raw-LLM firehose.

### 8.1 Open engineering follow-ups (not PM)

- Embedding-space parity: feeder-side `voyage-3` vs ontology-side model must match or the server re-embeds (handled, but costs tokens — decide default).
- Multi-ontology: same feeder emitting to FOLIO *and* CatholicOS/Canon needs per-project keys (II.1.2 cross-pollination reuses this exact machinery).
- Backpressure: hydration's 18K×components backlog needs the higher rate tier + `dedupe_mode=off` fast path.

---

## Appendix — reconnaissance grounding (files consulted)

- `ontokit-api/ontokit/models/suggestion_session.py`, `schemas/suggestion.py`, `services/suggestion_service.py` — existing session→PR object (name collision → "ImportedSuggestion").
- `ontokit-api/ontokit/services/duplicate_detection_service.py` — Stage-1 label dedupe primitive.
- `ontokit-api/ontokit/services/embedding_service.py`, `embedding_text_builder.py`, `schemas/embeddings.py` (`RankSuggestionRequest`/`RankedCandidate`) — Stage-2 embedding dedupe primitives + `embedding_text` shape.
- `ontokit-api/ontokit/api/routes/__init__.py`, `main.py` — route conventions (`/api/v1/projects/{id}/…`), Zitadel auth.
- `folio-enrich/backend/app/models/annotation.py` (`ConceptMatch`, `Span`) — enrich feeder shape.
- `folio-mapper/backend/app/models/mapping_models.py` (`FolioCandidate`, `CandidateRequest`) — mapper feeder shape.
- `alea-intake/backend/app/services/folio/unmapped.py` (`UnmappedConceptData`) — intake feeder shape.
- `PORTFOLIO-PLAN-2026-07-03.md` §II.0.1, §II.1, §II.4, §II.6.0, Roadmap — strategic framing, gestalt rule, sequencing.
