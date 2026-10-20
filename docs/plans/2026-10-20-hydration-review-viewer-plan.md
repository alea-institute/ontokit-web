---
title: Hydration review viewer (B34 slice — Generative-FOLIO digests)
type: feat
date: 2026-10-20
status: integrated
requirements: alea-institute/generative-folio docs/handoffs/2026-07-28-ontokit-diff-viewer-requirements.md
---

## Scope

`/hydration-review` gives a reviewer the row-level diff, sampling and correction
surface for a Generative-FOLIO write-back digest (digest-0001: 151,078 proposed
additions). It covers B34's "Generative-FOLIO/hydration batches" item for review
only. Applying reviewed rows to FOLIO is out of scope and stays a separate,
human-merged pull request.

## Design

- **Data:** the reviewer opens a local `folio-review-bundle/1` JSONL file built
  by generative-folio's `scripts/writeback_review_bundle.py`. No API change, no
  upload; generated text never reaches a server.
- **State:** reviews and samples persist in IndexedDB, keyed by the bundle's
  SHA-256 and each row's stable `row_id`. A `folio-review-export/1` file carries
  them back to generative-folio, where `scripts/writeback_review_reconcile.py`
  validates them, re-gates corrections and computes rates. That repository stays
  the source of truth.
- **Behavior:** filter by branch/component/partition/review state, search
  label/IRI/value/row id across all rows, paginate 50 at a time, open a row to see
  the empty FOLIO slot beside the proposed triple, classify SAME/MINOR/MATERIAL,
  accept/correct/reject, draw seeded samples from the full filtered population,
  view exclusions read-only, read rates with explicit denominators.
- **Text fidelity:** values render inside `<bdi>` with the locale's `lang` and
  `dir`. Foreign-script runs are underlined, and invisible or control characters
  show as code-point badges. Text is never normalized.

## Verification

- `__tests__/lib/hydration-review/` and `__tests__/components/hydration-review/`
  (40 tests); full suite (5,522 tests), lint, type-check and build.
- Chromium UAT against the real 151,078-row bundle: load ≈ 2.5 s; he-il filter
  13,247 rows; RTL correction saved; reviews restored after a reload; seeded
  50-row sample from 13,247; search 105–313 ms; 256 exclusions read-only; export
  reconciled by generative-folio with 0 rejections.

## Remaining

Hosted acceptance on DEV (deploy from `dev`); server-side review persistence and
role checks if multi-reviewer use is wanted; the other B34 feeders.
