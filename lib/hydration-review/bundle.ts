/**
 * Review bundle format (`folio-review-bundle/1`), produced offline by
 * generative-folio's `scripts/writeback_review_bundle.py`.
 *
 * The bundle is UTF-8 JSONL: one header, then concept context, then every
 * proposed row, then every excluded row. Nothing here writes to an ontology;
 * the viewer only reads the bundle and records a review alongside it.
 */

export const BUNDLE_SCHEMA = "folio-review-bundle/1";

export type Partition = "keep" | "regenerate";

export interface BundleHeader {
  kind: "header";
  schema: string;
  digest_id: string;
  writes_to_folio: false;
  counts: {
    rows: number;
    by_partition: Record<string, number>;
    by_component: Record<string, number>;
    by_branch: Record<string, number>;
    concepts: number;
    exclusions: number;
    exclusions_by_reason: Record<string, number>;
  };
  digest_manifest?: {
    accepted_total?: number | null;
    excluded_by_reason?: Record<string, number> | null;
    prescreen_rejected_items?: number | null;
    held_concepts?: number | null;
  };
  baseline?: { folio_source_sha256?: string | null; note?: string };
}

export interface ConceptContext {
  iri: string;
  label: string | null;
  branch: string | null;
  existing_definition: string | null;
}

export interface BundleRow {
  row_id: string;
  iri: string;
  label: string;
  branch: string;
  component: string;
  predicate: string;
  lang: string | null;
  value: string;
  partition: Partition;
  failed_gates: Record<string, string>;
  recognition_strip?: { rules: string[]; original_value: string };
}

export interface BundleExclusion {
  row_id: string;
  iri: string;
  label: string | null;
  branch: string | null;
  component: string;
  lang: string | null;
  reason: string;
  value: string | null;
}

export interface ParsedBundle {
  sha256: string;
  header: BundleHeader;
  concepts: Map<string, ConceptContext>;
  rows: BundleRow[];
  rowsById: Map<string, BundleRow>;
  exclusions: BundleExclusion[];
}

export class BundleError extends Error {}

/** Lower-case hex SHA-256 of the exact file bytes, matching `sha256sum`. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parse bundle text. Throws `BundleError` with the offending line number. */
export function parseBundle(text: string, sha256: string): ParsedBundle {
  let header: BundleHeader | null = null;
  const concepts = new Map<string, ConceptContext>();
  const rows: BundleRow[] = [];
  const rowsById = new Map<string, BundleRow>();
  const exclusions: BundleExclusion[] = [];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line);
    } catch {
      throw new BundleError(`Line ${i + 1} is not valid JSON.`);
    }
    switch (rec.kind) {
      case "header":
        header = rec as unknown as BundleHeader;
        break;
      case "concept":
        concepts.set(rec.iri as string, rec as unknown as ConceptContext);
        break;
      case "row": {
        const row = rec as unknown as BundleRow;
        if (rowsById.has(row.row_id)) {
          throw new BundleError(`Line ${i + 1} repeats row ${row.row_id}.`);
        }
        rows.push(row);
        rowsById.set(row.row_id, row);
        break;
      }
      case "exclusion":
        exclusions.push(rec as unknown as BundleExclusion);
        break;
      default:
        throw new BundleError(`Line ${i + 1} has unknown kind ${JSON.stringify(rec.kind)}.`);
    }
  }

  if (!header || header.schema !== BUNDLE_SCHEMA) {
    throw new BundleError(`Not a ${BUNDLE_SCHEMA} file: the header line is missing or has another schema.`);
  }
  if (header.counts.rows !== rows.length) {
    throw new BundleError(
      `Header declares ${header.counts.rows} rows but the file holds ${rows.length}; the file is truncated or edited.`,
    );
  }
  if (header.counts.exclusions !== exclusions.length) {
    throw new BundleError(
      `Header declares ${header.counts.exclusions} exclusions but the file holds ${exclusions.length}.`,
    );
  }
  for (const ex of exclusions) {
    if (rowsById.has(ex.row_id)) {
      throw new BundleError(`Excluded slot ${ex.row_id} also appears as a proposed row.`);
    }
  }
  return { sha256, header, concepts, rows, rowsById, exclusions };
}

/** Locales whose script is right-to-left. */
const RTL_LANGS = new Set(["he", "ar", "fa", "ur", "yi"]);

export function isRtl(lang: string | null | undefined): boolean {
  return !!lang && RTL_LANGS.has(lang.split("-")[0].toLowerCase());
}

/** `he-il` → `he-IL`, the BCP 47 casing browsers expect in `lang`. */
export function htmlLang(lang: string | null | undefined): string | undefined {
  if (!lang) return "en";
  const [base, region] = lang.split("-");
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
}
