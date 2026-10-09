# Drain tranche 1: full-stack UAT receipt (2026-10-09)

- **Harness:** `scripts/e2e/run.mjs`, baseline profile, on a real isolated stack: PostgreSQL 17/pgvector, Redis, MinIO, Zitadel and Login, the API and worker, the Next production server, and Playwright Chromium. Sign-in is a real OIDC owner login. All data is synthetic.
- **Command:** `bash -c 'umask 077; npm run test:e2e -- --api-source <ontokit-api feat/drain-tranche1 worktree>'`
- **Sources:**
  - web feat/drain-tranche1 at 84bd402b, plus `e2e/browser/editor-data-integrity.spec.ts`
  - api feat/drain-tranche1 at d4bc31b9 (alea-institute/ontokit-api#64)
- **Run:** `10412dfbc8bea1ffd8eb6ece06a34cec`.
  - **Exit:** 0.
  - **Tests:** 26 passed, 0 skipped, 0 failed (the 21 existing baseline tests plus 5 new ones).
  - **Status:** acceptedRun true, cleanup complete. A repeat run, `b2ab330d…`, gave the same result.

| Case | Proves | Result |
|---|---|---|
| a | Delete is enabled for a zero-reference class (CatholicOS#364), and confirming commits through PUT `/source` (alea#56). The class is gone, and the neighbouring blocks (four altLabels, the provenance axiom, a restriction, an individual) are byte-identical. | PASS |
| b | A class form edit keeps every altLabel once, the provenance axiom, and other classes' restrictions (#361 family). | PASS |
| c | An individual label edit keeps `skos:altLabel "Rexi"@de` and its type (#361 residual). | PASS |
| d | Search returns a bare `rdf:Property` as a property with `property_kind` null, and a bare `rdfs:Class` as a class (CatholicOS/ontokit-api#121). | PASS |
| e | A label typed into Add Entity right after the editor loads survives the namespace settling. The deterministic proof is in the unit tests. | PASS |

Screenshots are kept outside git, in the operator's drain-status store. The spec writes fresh ones on every run.
