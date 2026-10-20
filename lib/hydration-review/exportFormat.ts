/**
 * Review export (`folio-review-export/1`): the file generative-folio's
 * `writeback_review_reconcile.py` reads to bring corrections back into the digest.
 */

import type { BundleRow } from "./bundle";
import { isComplete, type Review, type Sample } from "./reviews";

export const EXPORT_SCHEMA = "folio-review-export/1";

export function buildExport(
  bundleSha: string,
  digestId: string,
  reviews: Iterable<Review>,
  samples: Iterable<Sample>,
  rowsById: Map<string, BundleRow>,
  now = new Date(),
): { text: string; included: number; skipped: number } {
  const lines: string[] = [
    JSON.stringify({ kind: "header", schema: EXPORT_SCHEMA, bundle_sha256: bundleSha, digest_id: digestId, exported_at: now.toISOString() }),
  ];
  let included = 0;
  let skipped = 0;
  const sorted = [...reviews].sort((a, b) => a.row_id.localeCompare(b.row_id));
  for (const r of sorted) {
    if (!isComplete(r, rowsById.get(r.row_id))) {
      skipped++;
      continue;
    }
    included++;
    lines.push(JSON.stringify({ kind: "review", ...r, corrected_value: r.disposition === "correct" ? r.corrected_value : null }));
  }
  for (const s of samples) lines.push(JSON.stringify({ kind: "sample", ...s }));
  return { text: lines.join("\n") + "\n", included, skipped };
}

export class ExportError extends Error {}

/** Parse an export for re-import. Refuses one made against another bundle. */
export function parseExport(text: string, bundleSha: string): { reviews: Review[]; samples: Sample[] } {
  const reviews: Review[] = [];
  const samples: Sample[] = [];
  let header: Record<string, unknown> | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line);
    } catch {
      throw new ExportError("The review file contains a line that is not valid JSON.");
    }
    const { kind, ...rest } = rec;
    if (kind === "header") header = rec;
    else if (kind === "review") reviews.push(rest as unknown as Review);
    else if (kind === "sample") samples.push(rest as unknown as Sample);
  }
  if (!header || header.schema !== EXPORT_SCHEMA) {
    throw new ExportError(`Not a ${EXPORT_SCHEMA} file.`);
  }
  if (header.bundle_sha256 !== bundleSha) {
    throw new ExportError("This review file was made against a different bundle; it was not imported.");
  }
  return { reviews, samples };
}
