# FOLIO DEV — Autonomous UAT Log (2026-08-08)

Environment: `https://ontokit.dev.openlegalstandard.org` — CPX41 (`ontokit-dev`,
178.156.208.239) behind hetzner-dev's Coolify traefik (wildcard
`*.dev.openlegalstandard.org`, Let's Encrypt). Stack: pgvector/pg17, Redis 7, MinIO,
API+worker (SHA `3dc64817` = round-2 fixes), web pending round-2. `AUTH_MODE=disabled`
for autonomous UAT (dev user has full access; persona-gating UAT deferred to a
Zitadel-enabled pass).

## Environment verification
- [x] TLS issued + HTTP→HTTPS redirect; `/health` healthy through the public URL.
- [x] Migrations applied at container start (single alembic head).
- [x] FOLIO seeded via `POST /projects/import` (18MB OWL → Turtle): project
  **FOLIO DEV** `9981eedd-1808-4aaa-8fd3-d1f135461808`, index task completed —
  **18,566 entities in 27.9s**.
- [x] Class tree loads with `?branch=main` — real roots (Actor / Player, …).

## Findings

### F1 (P3, API nit) — tree endpoint empty without explicit `branch`
`GET /ontology/tree` (no branch param) returns 0 nodes on a project whose default
branch is `main`; with `?branch=main` it returns the real roots. The web client
passes branch explicitly, so no user impact — but default-branch resolution should
work. Not yet dispatched; batch with next fix round.

### F2 (P0 BLOCKER, found live; round-3 dispatched) — every submit 422s on
restriction-bearing ontologies
UAT-1 (mint "Zorptic Widget Claim" under Actor/Player, save OK, submit) → 422
"Suggestion references a malformed parent IRI" despite a well-formed in-project
parent. Root cause: round-2's malformed-parent gate
(`suggestion_service.py:217-231`, commit ad1f8111) set-diffs parsed triples;
rdflib mints fresh blank-node ids per parse, so every
`rdfs:subClassOf [ a owl:Restriction … ]` in FOLIO appears "added" on every save
and BNode objects fail the URIRef check. FOLIO has thousands of restriction
parents → all submits fail on real data. Neither the fix round's unit tests nor
the adversarial verifier caught it (their fixtures had no blank-node parents) —
only live UAT with the real ontology did. Round-3 Codex worker dispatched
(`agents/tasks/ontokit-api-llm-round3.md`) incl. an audit of sibling parse-diff
paths for the same bnode trap.

## Pending
- Web round-2 fixes (worker at quality gates) → web deploy → browser UAT
  (chrome-devtools): editor, tree, auto-save, suggestion UI, model picker,
  duplicate warnings.
- Re-run UAT-1 after round-3; then UAT-2 (true-duplicate block), UAT-3 (external
  parent accept), UAT-4 (approve→merge→trust).
