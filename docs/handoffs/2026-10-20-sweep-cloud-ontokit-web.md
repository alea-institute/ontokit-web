---
title: Sweep handoff — ontokit-web cloud lane (BAIF rehearsal)
date: 2026-10-20
cycle: sweep-2026-10-20
lane: cloud / alea-institute/ontokit-web
status: RESULT_PLACEHOLDER
---

# Handoff: ontokit-web cloud lane, sweep-2026-10-20

**Mandate.** Before 2026-11-02, make OntoKit fully operational for real FOLIO work and real
Catholic OS work, with a scripted end-to-end rehearsal ahead of BAIF (Rome, 2026-11-05/06),
and incorporate Adam Jace's CTT taxonomy.

RESULT_SUMMARY_PLACEHOLDER

## What this lane delivered

| Deliverable | Where |
|---|---|
| CTT import path: public pages → `ctt-snapshot/v1` → OWL module → merge into Catholic OS. A structured export plugs in through `--export` | `scripts/ctt/`, [docs/ctt-import.md](../ctt-import.md) |
| Rehearsal sources: FOLIO and Catholic OS pinned to commit and SHA-256, plus the live CTT import and merge, cached outside Git | `scripts/rehearsal/{pins,sources}.mjs`, `npm run rehearsal:sources` |
| Rehearsal harness profile `rehearsal` (four exact cases) on a fresh isolated stack | `e2e/browser/rehearsal.spec.ts`, `e2e/fixtures/rehearsal.ts`, `npm run test:e2e:rehearsal` |
| Hosted runner: the same spec against the serving host | `scripts/rehearsal/hosted.mjs`, `npm run rehearsal:hosted` |
| Harness repair: `minio/minio` left Docker Hub in September 2026, so the image is now Chainguard's MinIO, pinned by digest | `e2e/compose.yaml` |
| Harness: allowlisted proxy/CA passthrough, so the stack builds behind an egress proxy | `scripts/e2e/runtime.mjs` |
| Plan | [docs/plans/2026-10-20-rehearsal-folio-catholic-ctt-plan.md](../plans/2026-10-20-rehearsal-folio-catholic-ctt-plan.md) |

The rehearsal covers five steps:

1. The contributor signs in through Zitadel in a fresh browser and browses FOLIO (18,326 classes): the tree, search for "Canon Law", and the class detail.
2. The contributor relabels FOLIO "Canon Law" to "Canon Law (Catholic Church)", which matches the class's own definition. The contributor saves and submits, and the reviewer approves and merges in triage.
3. The contributor browses Catholic OS with the 250 CTT terms merged in. The "CTT term" root sits at the top of the tree, with six false friends under it. "credence" shows its calibration status and both senses.
4. The contributor relabels Catholic OS "Holy See" to "Holy See (Apostolic See)", the synonym in canon 361 that the class already lists as an altLabel. The reviewer approves and merges, and the CTT module survives the merge.

EVIDENCE_PLACEHOLDER

## Findings for other lanes

FINDINGS_PLACEHOLDER

## Open questions (for Damien)

QUESTIONS_PLACEHOLDER

## Steps that need the home box or credentials

BOXSTEPS_PLACEHOLDER
