# Requirements: OntoKit Web — v0.4.0 LLM-Assisted Ontology Improvements

**Defined:** 2026-04-05
**Core Value:** Enable SMEs to rapidly improve their ontology with LLM assistance while preserving integrity through human curation.

## v0.4.0 Requirements

### LLM Abstraction & Provider Routing

- [ ] **LLM-01**: User can configure an LLM provider (cloud or local) at the project level
- [ ] **LLM-02**: Project-owner API keys are stored on the backend and never exposed to the browser
- [ ] **LLM-03**: BYO-key users can enter their own API key which stays in the browser and calls the provider directly
- [ ] **LLM-04**: User can choose between "quality" and "cheap" model tiers per LLM call
- [ ] **LLM-05**: LLM dispatch layer is pluggable — can use ALEA LLM Client, direct provider SDKs (OpenAI, Anthropic, etc.), or local endpoints, chosen per-project. Default dispatch strategy is decided during phase planning based on what gives us access to the most current models (aligning with folio-enrich / folio-mapper conventions).
- [ ] **LLM-06**: Local model endpoint (Ollama or compatible) can be configured as a provider alongside cloud providers
- [ ] **LLM-07**: Backend records every project-key LLM call (timestamp, user, model, token count) for audit

### Suggestion Generation

- [ ] **GEN-01**: User can request LLM suggestions for child classes of the currently-selected class
- [ ] **GEN-02**: User can request LLM suggestions for sibling classes of the currently-selected class
- [ ] **GEN-03**: User can request LLM suggestions for annotations (altLabel, examples, notes, translations) on an existing class
- [ ] **GEN-04**: User can request LLM suggestions for additional parent classes on an existing class
- [ ] **GEN-05**: User can request LLM suggestions for seeAlso/isDefinedBy edges on an existing class
- [ ] **GEN-06**: LLM prompts include existing ontology context (current class, parents, existing siblings, existing annotations)
- [ ] **GEN-07**: Generative FOLIO prompt templates and validation routines are used for ontology-aware generation
- [ ] **GEN-08**: Each generated suggestion includes LLM confidence score when available
- [ ] **GEN-09**: Each generated suggestion is tagged with provenance (llm-proposed, user-written, user-edited-from-llm)

### Duplicate Detection

- [ ] **DEDUP-01**: System pre-computes embeddings for all existing classes and properties in the ontology
- [ ] **DEDUP-02**: Embeddings are stored in an approximate-nearest-neighbor index for O(log n) similarity search
- [ ] **DEDUP-03**: ANN index is rebuilt automatically after each merge to the main branch
- [ ] **DEDUP-04**: Every LLM suggestion is scored against the ontology for exact label match, semantic similarity, and structural similarity
- [ ] **DEDUP-05**: Composite duplicate score >0.95 blocks submission and forces the user to link to the existing entity instead
- [ ] **DEDUP-06**: Composite duplicate score >0.80 shows a warning with candidate existing entities and lets the user decide
- [ ] **DEDUP-07**: Composite score ≤0.80 passes duplicate check silently
- [ ] **DEDUP-08**: Duplicate check runs across the whole ontology, not just the local neighborhood

### Pre-Submit Validation

- [ ] **VALID-01**: Every new class/property must have at least one existing parent (cannot be a free-floating entity)
- [ ] **VALID-02**: Every new class/property must have an rdfs:label in English (other languages optional)
- [ ] **VALID-03**: System detects and blocks cycles in the class hierarchy
- [ ] **VALID-04**: System blocks IRIs in namespaces the user doesn't own
- [ ] **VALID-05**: Validation runs before the user can submit suggestions; failures show inline error messages
- [ ] **VALID-06**: New IRIs are minted using the WebProtege-style creation schema (e.g., UUID-based local names under the project's namespace) — matches existing OntoKit conventions and ensures no accidental collisions

### Session Clustering & Batches

- [ ] **CLUSTER-01**: System auto-clusters a user's session suggestions by common class ancestor
- [ ] **CLUSTER-02**: Shards have a max size of 50 items; shards exceeding this split by the next taxonomy level down
- [ ] **CLUSTER-03**: Shards have a min size of 3 items; smaller orphans roll into a "Miscellaneous improvements" shard
- [ ] **CLUSTER-04**: Cross-cutting changes that don't fit one ancestor form their own shard
- [ ] **CLUSTER-05**: Each suggestion appears in exactly one shard (no cross-posting)
- [ ] **CLUSTER-06**: At submit time, user sees a preview tree of proposed shards and can merge/split/rename them
- [ ] **CLUSTER-07**: Each approved shard becomes one PR with one commit
- [ ] **CLUSTER-08**: One session creates one "batch" that groups its N shards for traceability
- [ ] **CLUSTER-09**: Reviewer can approve/reject the entire batch or individual shards within it

### Dual UX Modes

- [ ] **UX-01**: Every class detail panel has an inline "✨ Suggest improvements" button (Mode A)
- [ ] **UX-02**: User can enter flashcard iterator mode from a tree branch, walking through classes sequentially (Mode B)
- [ ] **UX-03**: User can switch between inline and iterator modes mid-session
- [ ] **UX-04**: Each LLM suggestion has one-click accept, one-click reject, and inline-edit-then-accept affordances
- [ ] **UX-05**: Accepted suggestions land in the user's draft/staging area
- [ ] **UX-06**: User can see a count of pending LLM suggestions for the current session

### Property Support

- [ ] **PROP-01**: User can browse the property tree separately from the class tree
- [ ] **PROP-02**: User can request LLM suggestions for new ObjectProperty, DataProperty, and AnnotationProperty entities
- [ ] **PROP-03**: User can request LLM suggestions for property domain and range
- [ ] **PROP-04**: Duplicate detection and validation guardrails apply to properties as well as classes
- [ ] **PROP-05**: Properties use the same dual UX (inline + iterator), clustering, and review pipeline as classes

### Per-Role Access Model

- [ ] **ROLE-01**: Admins have full access: LLM suggestions, self-merge annotation PRs, self-merge structural PRs
- [ ] **ROLE-02**: Editors have LLM access and self-merge annotation PRs by default; structural PRs require peer review
- [ ] **ROLE-03**: Admin can override default editor permissions per-project (e.g., promote trusted editor to self-merge structural)
- [ ] **ROLE-04**: Suggesters have LLM access and submit through the existing suggestion-session flow (goes to admin review)
- [ ] **ROLE-05**: Anonymous users have no LLM access (can still submit manual suggestions via existing anonymous flow)

### Cost Controls

- [ ] **COST-01**: Project owner sets a monthly LLM budget ceiling per project
- [ ] **COST-02**: LLM features disable gracefully when project budget is exhausted (manual suggestions still work)
- [ ] **COST-03**: Editors are rate-limited to 500 LLM calls per day per project
- [ ] **COST-04**: Suggesters are rate-limited to 100 LLM calls per day per project
- [ ] **COST-05**: Project owner sees a usage dashboard with per-user, per-day call counts and estimated cost
- [ ] **COST-06**: Dashboard shows current budget consumption and burn rate
- [ ] **COST-07**: BYO-key users' calls do not count against the project budget

### Reviewer Tooling

Enhancements to the existing reviewer page at `app/projects/[id]/suggestions/review/page.tsx` (shipped in v0.2.0 / v0.3.0). No new reviewer UI is built — these requirements add LLM-specific affordances to the existing diff + approve/reject/request-changes workflow.

- [ ] **REVIEW-01**: Existing diff view works for LLM-proposed suggestions identically to human-written ones
- [ ] **REVIEW-02**: Reviewer sees a similar-existing-entities panel for every suggestion (duplicate detection results)
- [ ] **REVIEW-03**: Reviewer sees provenance tag on every suggestion (llm-proposed / user-written / user-edited-from-llm)
- [ ] **REVIEW-04**: Reviewer sees LLM confidence score where available
- [ ] **REVIEW-05**: Batch review view shows all shards in the existing review queue, allowing approve/reject per shard or for the whole batch

### Toolchain Integration

- [ ] **TOOL-01**: Backend calls folio-python for graph queries (structural similarity, parent/sibling lookups)
- [ ] **TOOL-02**: Backend integrates OpenGloss for definition/gloss extraction from reference texts
- [ ] **TOOL-03**: Backend loads the FOLIO OWL file into a reasoner for logical consistency checks (cycles, domain/range)
- [ ] **TOOL-04**: Reasoner validation runs after user accepts suggestions but before commit
- [ ] **TOOL-05**: Generative FOLIO is installable as a Python dependency in the ontokit-api virtual environment

## Future Requirements

### v0.5.0+

- **LLM-08**: Embeddings model is user-configurable (default: OpenAI text-embedding-3-small)
- **GEN-10**: LLM can suggest re-organization (splitting or merging existing classes)
- **GEN-11**: LLM can identify missing intermediate parents in a deep hierarchy
- **REVIEW-06**: Reviewer can request changes with inline comments on individual suggestions
- **COST-08**: Budget alerts notify project owner at 50%, 75%, 90% of monthly cap
- **UX-07**: Flashcard iterator supports multi-branch selection (not just one branch at a time)
- **CLUSTER-10**: Batches persist across sessions (user can come back days later to an open batch)
- **TOOL-06**: Custom user-defined LLM prompt templates per-project

### Infrastructure

- **INFRA-04**: Redis deployed for embeddings index caching
- **INFRA-05**: Background worker for ANN index rebuilds

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anonymous LLM access | Cost control + insufficient abuse signal |
| Custom LLM provider abstraction | Use ALEA LLM Client (existing) |
| Per-suggestion appearance in multiple PRs | Complicates audit trail; each suggestion lands in one shard |
| Real-time collaborative editing | Not the bottleneck for ontology quality |
| In-browser embeddings computation | Too slow, too memory-intensive; backend-only |
| LLM-generated commit messages | Human-authored messages keep history readable and intentional |
| Automatic acceptance of high-confidence LLM suggestions | Human curation is the entire point; no auto-accept |
| Cross-project ontology suggestions | Each project owns its own ontology scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LLM-01 | TBD | Pending |
| LLM-02 | TBD | Pending |
| LLM-03 | TBD | Pending |
| LLM-04 | TBD | Pending |
| LLM-05 | TBD | Pending |
| LLM-06 | TBD | Pending |
| LLM-07 | TBD | Pending |
| GEN-01 | TBD | Pending |
| GEN-02 | TBD | Pending |
| GEN-03 | TBD | Pending |
| GEN-04 | TBD | Pending |
| GEN-05 | TBD | Pending |
| GEN-06 | TBD | Pending |
| GEN-07 | TBD | Pending |
| GEN-08 | TBD | Pending |
| GEN-09 | TBD | Pending |
| DEDUP-01 | TBD | Pending |
| DEDUP-02 | TBD | Pending |
| DEDUP-03 | TBD | Pending |
| DEDUP-04 | TBD | Pending |
| DEDUP-05 | TBD | Pending |
| DEDUP-06 | TBD | Pending |
| DEDUP-07 | TBD | Pending |
| DEDUP-08 | TBD | Pending |
| VALID-01 | TBD | Pending |
| VALID-02 | TBD | Pending |
| VALID-03 | TBD | Pending |
| VALID-04 | TBD | Pending |
| VALID-05 | TBD | Pending |
| VALID-06 | TBD | Pending |
| CLUSTER-01 | TBD | Pending |
| CLUSTER-02 | TBD | Pending |
| CLUSTER-03 | TBD | Pending |
| CLUSTER-04 | TBD | Pending |
| CLUSTER-05 | TBD | Pending |
| CLUSTER-06 | TBD | Pending |
| CLUSTER-07 | TBD | Pending |
| CLUSTER-08 | TBD | Pending |
| CLUSTER-09 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| UX-05 | TBD | Pending |
| UX-06 | TBD | Pending |
| PROP-01 | TBD | Pending |
| PROP-02 | TBD | Pending |
| PROP-03 | TBD | Pending |
| PROP-04 | TBD | Pending |
| PROP-05 | TBD | Pending |
| ROLE-01 | TBD | Pending |
| ROLE-02 | TBD | Pending |
| ROLE-03 | TBD | Pending |
| ROLE-04 | TBD | Pending |
| ROLE-05 | TBD | Pending |
| COST-01 | TBD | Pending |
| COST-02 | TBD | Pending |
| COST-03 | TBD | Pending |
| COST-04 | TBD | Pending |
| COST-05 | TBD | Pending |
| COST-06 | TBD | Pending |
| COST-07 | TBD | Pending |
| REVIEW-01 | TBD | Pending |
| REVIEW-02 | TBD | Pending |
| REVIEW-03 | TBD | Pending |
| REVIEW-04 | TBD | Pending |
| REVIEW-05 | TBD | Pending |
| TOOL-01 | TBD | Pending |
| TOOL-02 | TBD | Pending |
| TOOL-03 | TBD | Pending |
| TOOL-04 | TBD | Pending |
| TOOL-05 | TBD | Pending |

**Coverage:**
- v0.4.0 requirements: 65 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 65 ⚠️ (will be populated by gsd-roadmapper)

---

## Previously Shipped (v0.3.0)

v0.3.0 requirements (SYNC-01/02, AUTH-01/05, DEPL-01/05, ANON-01/07) are all complete and shipped 2026-04-03. See git history and MILESTONES.md for details.

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 — milestone v0.4.0 initialized*
