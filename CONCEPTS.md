# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Ontology domain

### FOLIO
The Federated Open Legal Information Ontology — the open legal-domain OWL ontology (maintained by the ALEA Institute) that OntoKit is built to browse, edit, and extend. Distinct from the unrelated library-systems platform of the same name. "FOLIO work" in this project means features that operate on this ontology's graph: importing it, suggesting changes to it, and measuring similarity against it.

### Suggestion
A proposed change to an ontology (such as a new class) submitted for review rather than applied directly. Suggestions pass through automated validation — including the Duplicate check — before a reviewer approves or rejects them.

### Duplicate check
The validation step that decides whether a Suggestion proposes an entity the ontology already has. It combines several similarity signals (exact label match, semantic embedding similarity, and Structural similarity) into a composite score with block and warn thresholds. When a signal is unavailable, its weight is renormalized across the remaining signals — missing evidence is never treated as evidence against duplication.

### Structural similarity
The Duplicate-check signal that compares two entities by the overlap of their parent sets in the FOLIO graph, rather than by their labels or definitions. It degrades gracefully: when the FOLIO graph tooling is unavailable, or neither entity has parents in the public graph, the signal reports itself unavailable instead of returning a misleading zero.
