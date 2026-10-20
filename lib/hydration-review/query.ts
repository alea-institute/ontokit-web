/**
 * Filtering, search, pagination and seeded sampling over the full bundle.
 * All functions operate on every matching row, never on a loaded page.
 */

import type { BundleRow } from "./bundle";
import type { Review } from "./reviews";

export type ReviewStatusFilter = "" | "unreviewed" | "reviewed" | "SAME" | "MINOR" | "MATERIAL" | "corrected" | "rejected";

export interface RowFilter {
  branch: string;
  component: string;
  partition: string;
  status: ReviewStatusFilter;
  q: string;
}

export const EMPTY_FILTER: RowFilter = { branch: "", component: "", partition: "", status: "", q: "" };

/** Case-folded, NFC-normalized needle; values are compared, never rewritten. */
function fold(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

export function matchesStatus(review: Review | undefined, status: ReviewStatusFilter): boolean {
  const done = !!review && review.disposition !== null;
  switch (status) {
    case "":
      return true;
    case "unreviewed":
      return !done;
    case "reviewed":
      return done;
    case "corrected":
      return done && review!.disposition === "correct";
    case "rejected":
      return done && review!.disposition === "reject";
    default:
      return done && review!.classification === status;
  }
}

/** Folded search text per row, built once per bundle so a keystroke is one pass of `includes`. */
export function buildSearchIndex(rows: readonly BundleRow[]): string[] {
  return rows.map((row) => fold(`${row.label}\u0000${row.iri}\u0000${row.value}\u0000${row.row_id}`));
}

export function filterRows(
  rows: readonly BundleRow[],
  filter: RowFilter,
  reviews: ReadonlyMap<string, Review>,
  index?: readonly string[],
  /** Kept despite the review-state filter, so reviewing a row does not drop it from navigation. */
  pinnedId?: string | null,
): BundleRow[] {
  const needle = filter.q.trim() ? fold(filter.q.trim()) : "";
  const hay = needle ? (index ?? buildSearchIndex(rows)) : null;
  return rows.filter((row, i) => {
    if (filter.branch && row.branch !== filter.branch) return false;
    if (filter.component && row.component !== filter.component) return false;
    if (filter.partition && row.partition !== filter.partition) return false;
    if (filter.status && row.row_id !== pinnedId && !matchesStatus(reviews.get(row.row_id), filter.status)) return false;
    if (hay && !hay[i].includes(needle)) return false;
    return true;
  });
}

export function pageOf<T>(items: readonly T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * pageSize;
  return {
    page: current,
    pages,
    start,
    end: Math.min(items.length, start + pageSize),
    items: items.slice(start, start + pageSize),
  };
}

/** mulberry32: small, fast, and identical in every JS engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw `size` distinct row ids from `population` with a seeded partial
 * Fisher–Yates shuffle. The population is sorted by row id first, so the same
 * seed over the same bundle and filter always yields the same members.
 */
export function drawSample(population: readonly BundleRow[], size: number, seed: number): string[] {
  const ids = population.map((r) => r.row_id).sort();
  const n = Math.min(Math.max(0, Math.floor(size)), ids.length);
  const rand = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, n);
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}
