/**
 * Review records, the rules a record must satisfy, and defect-rate arithmetic.
 *
 * The rules mirror generative-folio's `writeback_review_reconcile.py`, which
 * re-checks every record; enforcing them here stops a reviewer exporting work
 * that reconcile would then reject.
 */

import type { BundleRow } from "./bundle";

export const CLASSIFICATIONS = ["SAME", "MINOR", "MATERIAL"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const DISPOSITIONS = ["accept", "correct", "reject"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export interface Review {
  row_id: string;
  iri: string;
  component: string;
  original_value: string;
  classification: Classification | null;
  disposition: Disposition | null;
  corrected_value: string | null;
  note: string | null;
  reviewed_at: string;
}

export interface Sample {
  sample_id: string;
  seed: number;
  size: number;
  population: number;
  filter: Record<string, string>;
  members: string[];
  created_at: string;
}

export function emptyReview(row: BundleRow, now = new Date()): Review {
  return {
    row_id: row.row_id,
    iri: row.iri,
    component: row.component,
    original_value: row.value,
    classification: null,
    disposition: null,
    corrected_value: null,
    note: null,
    reviewed_at: now.toISOString(),
  };
}

/** Python `str.isspace()` characters, so "blank" means the same here and in reconcile. */
const BLANK = /^[\t\n\v\f\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/u;

export function isBlank(value: string | null | undefined): boolean {
  return !value || BLANK.test(value);
}

/** Problems that would make reconcile reject this record. Empty == valid. */
export function reviewProblems(review: Review, row: BundleRow | undefined): string[] {
  const problems: string[] = [];
  if (!row) return ["This row is not in the loaded bundle."];
  if (review.iri !== row.iri || review.component !== row.component) {
    problems.push("The IRI or component disagrees with the bundle row.");
  }
  if (review.classification !== null && !CLASSIFICATIONS.includes(review.classification)) {
    problems.push(`Unknown classification ${JSON.stringify(review.classification)}.`);
  }
  if (review.disposition !== null && !DISPOSITIONS.includes(review.disposition)) {
    problems.push(`Unknown disposition ${JSON.stringify(review.disposition)}.`);
  }
  if (review.original_value !== row.value) {
    problems.push("The original value differs from the bundle (stale review).");
  }
  if (review.disposition === null) problems.push("Choose accept, correct or reject.");
  if (review.disposition === "accept" && review.classification && review.classification !== "SAME") {
    problems.push(`A row classified ${review.classification} cannot be accepted as proposed.`);
  }
  if (review.disposition === "correct") {
    const v = review.corrected_value;
    if (isBlank(v)) problems.push("Enter the corrected value.");
    else if (v === row.value) problems.push("The correction equals the original.");
  }
  return problems;
}

export function isComplete(review: Review, row: BundleRow | undefined): boolean {
  return reviewProblems(review, row).length === 0;
}

export interface RateCell {
  key: string;
  population: number | null;
  reviewed: number;
  SAME: number;
  MINOR: number;
  MATERIAL: number;
  unclassified: number;
}

/**
 * Tally classified reviews by `keyOf(row)`. Unreviewed rows never count as
 * SAME: they are only the `population - reviewed` remainder.
 */
export function tallyRates(
  reviews: Iterable<Review>,
  rowsById: Map<string, BundleRow>,
  keyOf: (row: BundleRow) => string,
  population?: Record<string, number>,
): RateCell[] {
  const cells = new Map<string, RateCell>();
  const cell = (key: string): RateCell => {
    let c = cells.get(key);
    if (!c) {
      c = { key, population: population?.[key] ?? null, reviewed: 0, SAME: 0, MINOR: 0, MATERIAL: 0, unclassified: 0 };
      cells.set(key, c);
    }
    return c;
  };
  for (const r of reviews) {
    const row = rowsById.get(r.row_id);
    if (!row || r.disposition === null) continue;
    const c = cell(keyOf(row));
    c.reviewed++;
    if (r.classification) c[r.classification]++;
    else c.unclassified++;
  }
  return [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** "3/40 (7.5%)" — numerator and denominator always shown. */
export function formatMaterialRate(c: Pick<RateCell, "SAME" | "MINOR" | "MATERIAL">): string {
  const classified = c.SAME + c.MINOR + c.MATERIAL;
  if (!classified) return "—";
  return `${c.MATERIAL}/${classified} (${((100 * c.MATERIAL) / classified).toFixed(1)}%)`;
}
