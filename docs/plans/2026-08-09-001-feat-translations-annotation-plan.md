---
title: Multilingual Translation Annotations - Plan
type: feat
date: 2026-08-09
topic: translations-annotation
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Multilingual Translation Annotations - Plan

## Goal Capsule

**Objective:** Make LLM-proposed translation a built-in part of authoring any OntoKit ontology — when a concept is minted, the system also proposes translations of its labels into each instance's configured languages, verifies them without needing anyone in the loop to speak the language, records their provenance, and commits them automatically; a coverage view and an admin bulk job drive an ontology to multilingual completeness.

**Product authority:** This plan owns the translation feature only. It is intent-level (WHAT), not implementation (HOW) — `ce-plan` decides representation, providers, and schema. It is the first of five consolidation-recovered intents being brainstormed in sequence; the other four are not active scope here (see How This Work Fits Together).

**Open blockers:** None blocking planning. Two items are deferred to planning (translation-provenance representation; language-set source data) — see Outstanding Questions.

## Product Contract

### Summary

Translation becomes a first-class, automatic part of authoring: minting a concept proposes translations of its labels (prefLabel + altLabel) into the instance's configured languages, verifies them by machine, records how each was produced, and commits them under an admin-chosen trust gate — with a coverage view and a cost-previewed bulk job to hydrate existing concepts.

### Problem Frame

OntoKit already stores language-tagged literals — a Spanish label can sit alongside an English one — but nothing *produces* them, *checks* them, or *tracks* their completeness. In practice FOLIO and the Catholic Semantic Canon are translated only at `rdfs:prefLabel`, and only where a bilingual contributor happened to add a value by hand. The people authoring an ontology are subject-matter experts, not polyglots: the person minting a concept generally cannot supply — or even validate — a Tagalog or Swahili label. So the multilingual surface that would make these ontologies usable across jurisdictions never gets built, and there is no way to see how far from complete it is. The value is concrete for the anchor tenants (FOLIO's worldwide legal reach, the Canon's evangelistic reach) and general for any ontology OntoKit hosts.

### Key Decisions

- KD1. **LLM auto-proposes translations as part of the mint act**, not as a separate user action (session-settled: user-directed — chosen over a distinct "translate" flow: translation rides the authoring the contributor is already doing). Governs R1, R2.
- KD2. **Labels-only by default; long-form fields on-demand.** prefLabel + altLabel auto-translate into all configured languages; `skos:definition`/`skos:example` translate only on explicit request (session-settled: user-directed — chosen over translating everything: bounds graph growth to the short, queryable surface). Governs R2, R3.
- KD3. **The verification mechanism is the commit gate; human PR review is not in the translation path** (session-settled: user-directed — chosen over routing each translation through the Phase A suggestion→PR flow: a human reviewer cannot validate a language they don't read, and per-translation review would flood the queue). Governs R6, R7.
- KD4. **Trust rigor is an admin choice, budget-driven.** Default is multi-model consensus + back-translation; a lower-cost confidence-scored path is selectable; an independent "provisional until a native speaker confirms" gate can layer on either (session-settled: user-directed — chosen over one fixed mechanism: token cost varies by an order of magnitude and the org paying picks its accuracy/cost point). Governs R4, R5, R7.
- KD5. **Per-instance, admin-defined language sets** seeded from a top-N-by-speakers palette (session-settled: user-directed — chosen over a fixed global set: each ontology's stakeholders differ — FOLIO wants the populous long tail, the Canon wants Christian-population-weighted). Governs R2, R10.
- KD6. **Every translation carries its provenance** — producing model/version, method, trust level, verified-vs-provisional, timestamp — so a future era can re-translate a targeted subset (e.g., "replace all machine translations produced by 2026-era models") (session-settled: user-directed). Governs R8, R9, R12.
- KD7. **Backfill is an admin bulk job with a cost preview, defaulting to low-cost async batch**, with a per-org speed-vs-cost choice (session-settled: user-directed — chosen over silent continuous translation: full-ontology translation is a large paid batch and must not surprise the org's bill). Governs R10, R11, R12.
- KD8. **Native-speaker reviewer is a role tag, multi-assignable** — one person may hold several roles (e.g., Admin + Native-Speaker-Reviewer for Spanish) (session-settled: user-directed). Governs R14, R7.

### Actors

- A1. **Contributor** — mints/edits concepts; triggers auto-translation implicitly by authoring. Generally cannot supply or validate non-native translations.
- A2. **Admin (org)** — configures the language set, trust mechanism, translated-field scope, and cost/speed mode; launches bulk backfills; assigns roles.
- A3. **Native-speaker reviewer** — a role tag scoped to one or more languages; confirms provisional translations to promote them to verified. Optional to the common path (only needed when the provisional gate is on).
- A4. **Translation engine (LLM + bot)** — produces, back-translates, scores, and commits translations under the configured gate, attributing commits per the Phase A commit-identity mechanics.

### Requirements

**Generation & scope**

- R1. Minting a concept proposes translations of its labels into every language in the instance's configured set, without the contributor initiating a separate action.
- R2. Translation covers all label types — `rdfs:label`/prefLabel and `skos:altLabel` synonyms — not only the preferred label. The configured set (R10) is the target.
- R3. `skos:definition` and `skos:example` are not auto-translated by default; they translate only on explicit per-entity request or when an admin turns the field on instance-wide.

**Trust & verification**

- R4. An admin selects the instance's verification mechanism: (default) multi-model consensus with back-translation to the source language and agreement scoring, or a lower-cost single-model confidence-scored path.
- R5. An admin may independently require that machine translations stay provisional until a native-speaker reviewer confirms them; when off, sufficiently-verified translations are usable immediately.
- R6. A translation that fails its verification threshold is not committed as verified — it is withheld or marked provisional per the configured gate, never silently accepted.
- R7. Verified translations commit automatically under the trust gate without passing through the human suggestion→PR review flow; the only human touchpoint is the optional native-speaker confirmation of provisional translations.

**Provenance**

- R8. Every translation records its provenance: producing model and version, method (consensus/back-translation/single-model), trust level/score, verified-or-provisional state, and creation timestamp.
- R9. Provenance is queryable well enough to scope a future backfill by it — e.g., "all machine (non-native-confirmed) translations produced by models older than X."

**Coverage & backfill**

- R10. An admin defines the instance's language set, seeded from a top-N-by-speakers palette and freely adjustable; the set is the target for R1/R2 and the coverage view.
- R11. A coverage view shows, per language, what is translated, what is provisional, and what is missing across the ontology, so an ontology can be driven to completeness.
- R12. An admin can launch a bulk backfill that translates existing concepts (or fills a newly-added language) across the ontology, shown an estimated scope and token cost before confirming, and defaulting to a low-cost asynchronous batch mode with a faster higher-cost mode selectable.

**Cost, config & roles**

- R13. Translation token cost is borne by the org running the instance (BYOK), consistent with OntoKit's existing LLM cost model; the trust mechanism, language set, translated-field scope, and speed/cost mode are all per-instance admin settings.
- R14. "Native-speaker reviewer" is a role tag scoped to one or more languages and assignable alongside a person's other roles; only holders of the tag for a language can confirm that language's provisional translations.

### Key Flows

- F1. **Auto-translate at mint.** **Trigger:** a contributor mints a concept and supplies at least a prefLabel. **Covers R1, R2, R4, R7, R8.** The engine proposes translations of the concept's labels into each configured language; verifies each per the configured mechanism; records provenance; commits verified ones automatically (attributed per Phase A commit identity) and marks the rest provisional per R5/R6. Under async batch mode the translations arrive after the mint (F4).
- F2. **Bulk backfill.** **Trigger:** an admin starts a backfill (whole ontology, or a newly-added language). **Covers R10, R11, R12.** The system estimates scope + token cost and shows it; on confirm it translates the missing set under the configured mechanism and cost/speed mode; the coverage view reflects progress and remaining gaps.
- F3. **Native-speaker confirmation.** **Trigger:** the provisional gate is on and a reviewer holds the language's role tag. **Covers R5, R7, R14.** The reviewer confirms (or rejects) provisional translations for their language(s); confirmation promotes provisional → verified and updates provenance.
- F4. **Eventual consistency under batch.** **Covers R12.** When the org chooses async batch, a concept's translations are pending immediately after mint and land later; the coverage view surfaces the pending state so the delay is visible rather than silent.

### Acceptance Examples

- AE1. **Covers R1, R2.** A contributor mints "Bailment" with an English prefLabel and one altLabel; with three configured languages, the system proposes prefLabel + altLabel translations in all three — not the definition, and not only the prefLabel.
- AE2. **Covers R4, R6.** Under consensus mode, two models agree on a French prefLabel and the back-translation matches the source: it commits verified. A third language where the models disagree does not commit verified — it is withheld or marked provisional per the gate.
- AE3. **Covers R5, R7, R14.** With the provisional gate on, a machine Swahili translation is usable but visibly provisional; it becomes verified only when a person holding the Swahili native-speaker role confirms it. A person who is Admin but lacks that language tag cannot confirm it.
- AE4. **Covers R9.** In 2028 an admin scopes a backfill to "machine translations produced by 2026-era models, never native-confirmed"; provenance is sufficient to select exactly that set and leave native-confirmed translations untouched.
- AE5. **Covers R12.** An admin adds a new language to a large ontology; before any tokens are spent they see an estimated count and cost; choosing batch mode runs it asynchronously and the coverage view shows the language filling in over time.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan owns **translations** only — one of five intents recovered from the 2026-08-08 roundup consolidation (`docs/residual-review-findings/u6-lens2.md`) that Damien chose to pull back through the full brainstorm→plan process, in sequence. The breakdown below is the current understanding, not a committed roadmap; a later brainstorm may revise it.

- Translations (this plan)
  - **Shares** the LLM cost/BYOK model and the "bot commits under a trust gate" pattern with the other AI-assisted features.
  - **Shares** the Phase A trust-ladder + role model with intent #3 (contributor-credential metadata) and with the native-speaker role tag here.
  - **Can proceed independently of** intent #1 (user-configurable N-day auto-accept), intent #3 (contributor-credential metadata on bot submissions), intent #2 (SSO evaluation — a `ce-pov` verdict), and intent #4 (Generative-FOLIO / folio-python / folio-api / OWL tooling evaluation — a `ce-pov` verdict).
  - **Still to decide:** intents #2 and #4 are adopt-vs-evaluate verdicts better suited to `ce-pov` than to a build brainstorm.

### Scope Boundaries

**Deferred (in the feature's spirit, later):**
- Auto-translating `skos:definition`/`skos:example` by default (on-demand only for now — R3).
- Continuous/background gap-filling beyond the admin bulk job (R12 is admin-triggered; a capped background filler is possible future work).

**Outside this plan's identity:**
- Human PR review of individual translations (KD3 — the trust gate replaces it).
- Building or hosting translation models (uses LLM providers via BYOK).
- The other four consolidation-recovered intents — each is its own brainstorm/plan (see How This Work Fits Together).

### Assumptions

- OntoKit's existing language-tagged-literal storage and the ~44-property annotation set (including `rdfs:label`, `skos:altLabel`, `skos:definition`) are the substrate translations attach to; the source label may be authored in any language, with the rest derived from it.
- The Phase A trust ladder + commit-identity mechanics (attributed bot commits) are the basis the native-speaker role tag and translation commits extend.
- Async batch translation is acceptable for the low-cost path because translations hydrate an ontology over time rather than blocking authoring.

### Outstanding Questions

**Deferred to Planning:**
- **Translation-provenance representation.** A plain `"Abogado"@es` literal cannot hold model/method/trust/state/timestamp. How provenance is represented (annotation-on-annotation, reification, a companion provenance graph or store) is a planning decision — but it is load-bearing: the coverage view (R11), provisional flags (R5/R6), native-review queue (R14), and era-scoped backfill (R9) all depend on it existing.
- **Language-set palette source.** The concrete top-N-by-speakers seed list, and how "provisional/verified" states surface in the editor and coverage UI, are planning-level.
- **Verification thresholds.** The exact agreement/confidence thresholds that gate auto-commit vs provisional (R4/R6) are tuning decisions for planning, likely admin-adjustable.

### Sources / Research

- `lib/ontology/annotationProperties.ts` — the annotation property set (`rdfs:label`, `skos:altLabel`, `skos:definition`, `dc:language`, `dcterms:language`) translations attach to.
- `components/editor/ClassDetailPanel.tsx`, `lib/ontology/turtleClassUpdater.ts` — existing per-value language-tag handling (`n` field, `LanguageFlag`) and how labels/comments serialize.
- `docs/residual-review-findings/u6-lens2.md` — where this intent was found dropped in the 2026-08-08 consolidation.
- `docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md` — the roundup plan; Phase A trust ladder + commit-identity (KD1) this feature extends.
