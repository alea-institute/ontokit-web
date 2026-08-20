---
title: "FOLIO tooling verdict: folio-python + RDFLib in, folio-api and Generative-FOLIO out"
date: 2026-08-10
category: tooling-decisions
module: OntoKit API
problem_type: tooling_decision
component: tooling
severity: high
applies_when:
  - "Evaluating or pinning FOLIO library dependencies"
  - "Adding FOLIO-specific capability (similarity, search, traversal) to ontokit-api"
  - "Reviewing ontology processing library choices"
  - "Editing ontokit-api pyproject.toml dependencies"
tags: [folio-python, rdflib, folio-api, dependency-management, owl-handling, semantic-similarity, tooling-decision]
related_components: [service_object, development_workflow]
---

# FOLIO tooling verdict: folio-python + RDFLib in, folio-api and Generative-FOLIO out

## Context

The original PRD for LLM-assisted ontology improvements (`docs/roundup-2026-08/outlines/feature-prd-llm-assisted-improvements.md:29-34`, ontokit-web) listed four FOLIO tooling candidates — Generative-FOLIO, folio-python, folio-api, and the FOLIO OWL file handled directly — and said "the system will be able to choose from all or any of these tools." No evaluation was ever recorded; the U6 retrospective flagged this as an unevaluated intent (`docs/residual-review-findings/u6-lens2.md:68`), and the 2026-08-09 intent-recovery brainstorm explicitly routed it to a ce-pov verdict rather than further brainstorming (session history).

Meanwhile the codebase had quietly made a partial choice on its own: folio-python was imported at exactly one call site (`ontokit-api/ontokit/services/structural_similarity_service.py:17`, `from folio.graph import FOLIO`, inside a try/except that logs a warning and degrades gracefully) while remaining **absent from `pyproject.toml`** — so a deploy could silently lack it, and duplicate-check quality silently depended on it. That exposure produced a real defect: P0-6, a duplicate-check false-pass when folio-python was unavailable (`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md:46-49`), fixed in ontokit-api by renormalizing the composite weights when the structural signal is missing (ontokit-api commit 7b60405b — sibling repo, not resolvable from this tree — 2026-08-08, "fix(llm-review): P0-6 — renormalize unavailable structural signal"; per this session's read, `duplicate_check_service.py:100-110` now calls `try_compute_similarity` and tracks `structural_available`). The renormalization removes the false-pass, but the undeclared-dependency risk it exposed persists until folio-python is pinned. In the wider duplicate-check design, the folio-python Jaccard parent-set score is the 20% structural component alongside exact-label and embedding-based semantic signals (session history).

A ce-pov approach-set evaluation (2026-08-10, reversibility Tier 2) closed the open question with a graded verdict on all four candidates. This doc records that verdict and the evidence behind it, so future FOLIO work does not re-open the question from scratch.

**Status update (2026-08-20):** the release gate has cleared. `folio-python` 0.4.0
published on 2026-08-18, superseding the anticipated 0.3.7 release. The approved
OntoKit dependency change is now executable: verify 0.4 compatibility, pin the secure
release, remove `owlready2`, update the lockfile, and run the API gates. CatholicOS
ontokit-api #209 remains open for that work.

## Guidance

The verdict, per candidate:

1. **folio-python — adopt properly, with a version condition.** Promote it from undeclared soft import to a declared, pinned dependency in ontokit-api's `pyproject.toml`. It is the right layer for FOLIO-specific operations: typed OWL class objects, parent/relationship traversal (what `StructuralSimilarityService` uses for Jaccard parent-set similarity), fuzzy/prefix/label search behind an optional `[search]` extra. **Condition:** pin to a release containing the security fix. PyPI's latest is 0.3.6 (2026-04-08), but upstream main carries an unpublished v0.3.7 fixing 5 high-severity Dependabot alerts (commit dated 2026-07-24) — so `pip install folio-python` today ships known vulnerable transitive dependencies. ALEA must publish 0.3.7 first; Damien is part of ALEA and can drive that release. Keep the graceful-degradation wrapper even after declaring the dependency — the renormalization path in `duplicate_check_service.py` is correct defense-in-depth.

2. **RDFLib — keep as the backbone.** Already a required dependency (`pyproject.toml:29`, `rdflib>=7.1.0`, BSD-3-Clause) and pervasive across 10+ modules (ontology parsing, entity-type detection, label extraction, the import pipeline, linting). folio-python **complements** RDFLib for FOLIO-graph-specific queries; it never replaces RDFLib for generic RDF/OWL I/O. Do not build an abstraction layer over RDFLib to accommodate FOLIO tooling — the codebase deliberately uses `Graph`/`URIRef`/namespace constants directly.

3. **folio-api — reject as a runtime dependency.** It duplicates folio-python's capabilities behind a network hop, which is the wrong fit for a self-hostable, in-memory product. The trust evidence is decisive: open issue alea-institute/folio-api#17 documents undocumented manual production changes on the hosted instance (folio.openlegalstandard.org), including the LLM backend silently swapped from OpenAI to xAI via on-box config edits never merged to git. Do not take a runtime dependency — hosted or self-hosted — on it. **Reversal trigger:** revisit a *self-hosted* folio-api deployment only if OntoKit grows a feature need for its hosted-LLM-backed semantic search.

4. **Generative-FOLIO — reference-only; its value is already consumed.** It is a private alea-institute repo (verified via authenticated `gh`; a public API sweep misses it — an earlier research pass concluded it "does not exist" for exactly that reason), and it is an *application* (generative legal dictionary/KG), not a library. Its useful content was already ported into ontokit-api as 15 files — 5 prompt/taxonomy files from generative-folio plus 10 LLM-provider infrastructure files from its sibling folio-enrich — e.g. `ontokit-api/ontokit/services/llm/prompts/edges.py:4` ("Adapted from generative-folio concept_generation.py") and `ontokit-api/ontokit/schemas/generation.py:43-46` (the 14 controlled relationship types). Treat it as an upstream reference to consult, never a dependency to add.

5. **Bonus: remove owlready2.** Declared at `pyproject.toml:30` (`owlready2>=0.51`) with **zero call sites** anywhere in ontokit-api's `ontokit/` package (verified by grep at the current sibling tree), and it is LGPLv3 copyleft against the project's MIT license — an unused dependency that only adds install weight and a license-compliance question. Recommend removal.

The follow-on dependency changes (pin folio-python once 0.3.7 publishes; drop owlready2) were routed to a Cockpit ask for Damien's approval, not executed — dependency changes require his sign-off per standing policy.

## Why This Matters

- **The undeclared-dependency pattern already caused a shipped defect.** P0-6 was not hypothetical: with folio-python absent, the structural signal scored 0.0, capping the duplicate composite at 0.80 while blocking required >0.95 — identical-label suggestions scored ≈0.76 and passed as non-duplicates. Tests masked it by patching `compute_similarity` to constants. A soft import whose absence degrades *quality* rather than *crashing* is precisely the failure that survives CI and review.
- **"Reported as working" is not the same as "pinned and reproducible."** Whether a deploy has folio-python currently depends on the environment, not the manifest. Declaring and pinning it makes the duplicate-check's quality floor a property of the build.
- **Security exposure hides in the publish gap.** Adopting folio-python at PyPI-latest (0.3.6) would import 5 known high-severity dependency vulnerabilities already fixed upstream but never released. The condition on the verdict — publish 0.3.7 first — is the difference between adopting a tool and adopting its backlog.
- **Runtime dependence on the hosted folio-api would outsource OntoKit's correctness to un-versioned infrastructure.** folio-api#17 shows the hosted instance's behavior can change (including which LLM answers semantic-search queries) with no git trail. For a product whose selling point includes self-hostable, in-memory operation, that is an architectural mismatch, not just an ops risk.
- **Recording the verdict closes a review finding.** The u6-lens2 flag existed because a "choose among four" instruction with no recorded disposition invites every future session to re-litigate the choice. This doc is the disposition.

## When to Apply

- When adding or touching any FOLIO-specific capability in ontokit-api (similarity, search, traversal, enrichment): reach for folio-python (once pinned), not folio-api, and not a fresh hand-rolled SPARQL layer for things folio-python already provides.
- When doing generic RDF/OWL parsing, serialization, or graph manipulation: RDFLib directly, no wrapper.
- When someone proposes calling folio.openlegalstandard.org (or standing up folio-api) at runtime: reject by default; the only revisit trigger is a concrete hosted-LLM-search feature need, and then self-hosted only.
- When looking for prompt patterns or the controlled relationship taxonomy: read the already-ported files in ontokit-api (or the private generative-folio repo via authenticated access, for reference) — do not add it as a dependency, and do not conclude it doesn't exist from a public API sweep.
- When editing ontokit-api's `pyproject.toml`: check whether folio-python 0.3.7 has published (unblocks the pin) and whether owlready2 is still declared unused (remove, with Damien's approval per the dependency-change policy).
- When writing tests around duplicate-check or structural similarity: test the *unavailable* path against real behavior (`try_compute_similarity` returning None → renormalization), never by patching the score to a constant.

## Examples

**The soft-import pattern that hid the exposure** (`ontokit-api/ontokit/services/structural_similarity_service.py:16-24`, current tree):

```python
try:
    from folio.graph import FOLIO  # type: ignore[import-not-found]

    instance = FOLIO(use_cache=True)
    _folio_cache[project_key] = instance
    return instance
except Exception:
    logger.warning("folio-python not available — structural similarity disabled")
    return None
```

Graceful degradation is good design; graceful degradation of an **undeclared** dependency is a silent quality regression waiting for the first environment that lacks the package. The fix is not to remove the try/except — it is to also declare and pin the package so the degraded path becomes the exception, not a deploy-time coin flip.

**The consumer after the P0-6 fix** (`ontokit-api/ontokit/services/duplicate_check_service.py:100-110`, current tree): the service calls `try_compute_similarity(...)`, sets `structural_available = structural_result is not None`, and renormalizes weights across available signals instead of scoring missing evidence as 0.0 — missing evidence is no longer evidence against duplication (ontokit-api commit 7b60405b).

**The already-consumed value of Generative-FOLIO** (`ontokit-api/ontokit/schemas/generation.py:43-46`):

```python
# Ported from generative-folio RelationshipType literal
...
# All 14 controlled relationship types from alea-institute/generative-folio
```

The port comments are the citation trail: the application's taxonomy and prompt structure live in OntoKit's own tree, which is why "reference-only" costs nothing.

**The dead dependency** (`ontokit-api/pyproject.toml:29-30`):

```toml
"rdflib>=7.1.0",
"owlready2>=0.51",
```

Two adjacent lines, opposite verdicts: rdflib is used in 10+ modules; owlready2 has zero call sites in `ontokit/` and an LGPLv3 license against the project's MIT. Manifest presence is not usage — verify with grep before assuming a declared dependency earns its keep.

## Related

- `docs/roundup-2026-08/outlines/feature-prd-llm-assisted-improvements.md:29-34` — the original "choose among four" ask this verdict resolves
- `docs/residual-review-findings/u6-lens2.md:68` — the retrospective finding that the evaluation was never recorded
- `docs/residual-review-findings/2026-08-08-llm-subsystem-review.md:46-49` — P0-6 analysis (folio-python as the structural-similarity backbone)
- `ontokit-api/docs/plans/2026-08-09-001-feat-translations-annotation-plan.md:109` — notes this evaluation as a parallel-safe dependent intent
- Cockpit ask `ontokit-api-2026-08-10-0930-folio-tooling-followups` — the three pending sign-off decisions (declare folio-python; publish 0.3.7; remove owlready2)
