---
title: BAIF end-to-end rehearsal — FOLIO, Catholic OS and CTT
date: 2026-10-20
kind: implementation-plan
cycle: sweep-2026-10-20
status: implementing
---

# BAIF end-to-end rehearsal: FOLIO, Catholic OS and CTT

## Goal

Before 2026-11-02, one scripted rehearsal proves that OntoKit serves real FOLIO work and real
Catholic OS work, ahead of BAIF in Rome (2026-11-05/06). The rehearsal covers:

1. A contributor signs in through the identity provider.
2. The contributor browses FOLIO (tree, search, class detail).
3. The contributor proposes a real FOLIO edit, and a reviewer approves and merges it.
4. The contributor browses the Catholic OS ontology, which now carries CTT terms marked uncalibrated.
5. The contributor proposes a Catholic edit, and a reviewer approves and merges it.

The same spec runs in two places:

- **Isolated stack (local verification):** the D06 launcher builds a fresh stack on a disposable host.
- **Serving host (hosted rehearsal):** a separate runner points the spec at the DEV host, using
  personas that already exist there.

## Inputs (pinned)

| Input | Source | Pin |
|---|---|---|
| FOLIO | `alea-institute/FOLIO`, `FOLIO.owl` (RDF/XML, 18,327 classes, CC BY 4.0) | commit `a8f0d29f`, SHA-256 `44657b4e…` |
| Catholic OS | `CatholicOS/ontology-semantic-canon`, `sources/ontology-semantic-canon.ttl` (Apache-2.0) | commit `935bc5a`, SHA-256 `58d55f92…` |
| CTT | `https://ctt.jaces.com/`: home, vocabulary and findings pages | live; the snapshot records the site build and a hash |

The upstream files are large (18 MB and 8 MB), so the repository stores none of them.
`scripts/rehearsal/prepare-sources.mjs` downloads them at the pinned commits and checks
their hashes. It also runs the CTT import and writes the merged Catholic+CTT file and a
manifest into an ignored cache. The launcher copies the cache into the private run
directory and re-checks every hash before any import.

## CTT import path (`scripts/ctt/`)

- `pages.mjs` parses the three public pages: labels, sense counts, community legend,
  core-word counts, false-friend senses, strongest pairs, and the short quotations the site
  already limits. It keys on accessible names and stable classes. It fails closed when
  the page's own totals disagree with what it parsed, and when the "Uncalibrated" banner is
  missing.
- `snapshot.mjs` defines `ctt-snapshot/v1`, the one shape every source produces. A future
  structured export from the Taxonomy Working Group plugs in through `--export` with no
  other change.
- `turtle.mjs` writes an OWL module: a `CTT term` root, `CTT false friend` and `CTT core word`
  subclasses, 24 community individuals, and calibration status and provenance on every
  term. The module declares no `owl:Ontology`, so the Catholic header stays in charge.
  The merge refuses to rebind a host prefix.
- The namespace defaults to `https://ontology.catholicos.catholic/ctt/` and can be
  overridden with `--base`. The handoff records the naming question.

## Harness profile `rehearsal`

- **Personas** use the D10 names, with rehearsal roles: `owner` (steward: imports and owns
  both projects), `suggester` (contributor), `editor` (reviewer: approves).
- **Setup** runs in a worker fixture, outside the inventory. It signs in each persona,
  imports both real ontologies as public projects through the product's import API, adds
  the members, and waits for the index to reach the imported revision.
- **Inventory** has four exact cases, so receipts cannot pass with fewer:
  1. contributor signs in through the provider and browses the FOLIO class tree, search and class detail
  2. contributor proposes a FOLIO label edit that the reviewer approves and merges
  3. contributor browses the Catholic OS ontology and finds CTT terms marked uncalibrated
  4. contributor proposes a Catholic OS edit that the reviewer approves and merges
- The receipt records the input hashes and the CTT build (non-secret), and states
  `acceptance.scope` as local verification.

## Hosted runner (`scripts/rehearsal/hosted.mjs`)

The runner reads a private (mode 0600) target file: web/API/issuer/login origins and the
three persona credentials. It never takes credentials from arguments or environment. It
writes the same private run config shape and runs Playwright with the rehearsal project.
The projects it creates carry a run tag and are deleted afterwards. Its receipt states
`acceptance.scope: hosted-rehearsal` and records the host's origin. Running it needs
verified DEV personas; the D10 Mailpit blocker still applies, so the handoff carries that
step.

## Out of scope

- Writing the rehearsal's edits back to the real FOLIO or CatholicOS repositories.
- Provisioning hosting (the ALEA AWS account does not exist yet), and anything that bills.

## Verification

- `npm run test:ctt` unit tests run in CI (synthetic page fixtures; no site content is committed).
- Profile and inventory tests (`npm run test:e2e:profiles`, `npm run test:e2e:evidence`).
- `npm run test:e2e:rehearsal -- --api-source <api>` passes on a fresh isolated stack, twice.
- Lint, type-check and the full Vitest suite pass, and CI is green.
