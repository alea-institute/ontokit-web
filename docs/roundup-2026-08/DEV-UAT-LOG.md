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

### F3 (P1, open — into the plan) — submit 422s via ValidationService with swallowed detail
After the round-3 bnode fix deployed (9489b536), UAT-1's submit fails differently:
422 "Suggestion failed server-side entity validation"
(`suggestion_service.py:293-306` → `ValidationService.validate_entity` on the minted
class). The specific `errors` list is discarded — the response carries no detail, so
the cause (IRI-shape rule? namespace rule? label rule?) is invisible to UI and UAT
alike. Two tracked items: (a) diagnose/right-size the mint validation rules for real
FOLIO-style projects; (b) return the validation errors in the 422 payload — the
generic message contradicts the P1-15 error-surfacing work. Round-3 regression guard
(malformed parent still rejected) not yet re-verified live; UAT-2/3/4 blocked on (a).

### F4 (P2, open) — public projects list renders empty despite API returning the seed
Browser sweep of `https://ontokit.dev.openlegalstandard.org/` (auth-disabled): the
projects list shows "No projects available" while `GET /api/v1/projects` returns FOLIO
DEV (200, one item). Console shows two 404s + an authjs AutoError (NextAuth calling a
proxied `/api/auth/*` that the initial traefik rule swallowed — since fixed by narrowing
the API rule to `/api/v1`). Feasibility review found the list lives in `app/page.tsx`
(not the `app/projects/page.tsx` redirect stub), which flattens `page.items` correctly —
so the live candidates are a session-gated `useInfiniteQuery` disabled under
`AUTH_MODE=disabled`, or an SSR fetch using an in-container URL. Fix scoped in plan U3.

### SECURITY FIX (applied to live DEV) — network gate over AUTH_MODE=disabled
The doc-review security lens (in-process + independent cross-model, both P0/100) found
the running DEV box exposed: `AUTH_MODE=disabled` on the public URL made any internet
visitor a full-access principal against a real GitHub write path. Closed immediately by
adding a traefik basic-auth middleware on both `ontokit-dev` routers at the hetzner-dev
proxy — the public surface now returns 401 without credentials (verified: no-auth 401,
with-auth 200). This must become infrastructure-as-code in plan U12/R13; the credential
is held server-side only. The plan's KTD2 is amended to require this gate for the whole
auth-disabled window.

### Status after round-3 deploy
- F2 (bnode submit blocker): FIXED (round-3 `45b82a42`, deployed) — superseded by F3.
- F3 (mint validation 422 with swallowed detail): OPEN — plan U1 owns the fix.
- F1 (default-branch tree): OPEN — plan U2.
- F4 (empty projects list): OPEN — plan U3.
- Suggestion save works live (200, real commit on the suggestion branch); submit blocked
  only by F3's validation gate.
