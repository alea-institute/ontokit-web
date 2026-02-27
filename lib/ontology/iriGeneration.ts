/**
 * IRI generation utilities for creating new ontology entities.
 *
 * Supports three IRI suffix patterns:
 * - UUID: Base62-encoded UUIDs (e.g., "R1a2b3c4d5e6f7g8h9i0j1k")
 * - Numeric: Sequential numeric suffixes (e.g., "Class_001")
 * - Named: PascalCase label-based suffixes (e.g., "RedBloodCell")
 */

import type { IriPosition } from "@/lib/editor/indexWorker";

// ── Types ────────────────────────────────────────────────────────────

export type IriSuffixPattern = "uuid" | "numeric" | "named";

export type EntityType =
  | "class"
  | "objectProperty"
  | "dataProperty"
  | "annotationProperty"
  | "individual";

export interface IriPatternDetectionResult {
  pattern: IriSuffixPattern;
  confidence: number;
  nextNumeric?: number;
}

export interface GenerateIriOptions {
  baseNamespace: string;
  pattern: IriSuffixPattern;
  label?: string;
  nextNumeric?: number;
}

// ── Base62 UUID Encoding ─────────────────────────────────────────────

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Encode a UUID (with or without hyphens) as a ~23-character base62 string,
 * prefixed with "R" to ensure RDF/XML QName safety (QNames must start with
 * a letter or underscore).
 */
export function uuidToBase62(uuid?: string): string {
  const id = uuid ?? crypto.randomUUID();
  const hex = id.replace(/-/g, "");

  let num = BigInt("0x" + hex);
  if (num === 0n) return "R0";

  const chars: string[] = [];
  const base = BigInt(62);
  while (num > 0n) {
    chars.push(BASE62_CHARS[Number(num % base)]);
    num = num / base;
  }

  return "R" + chars.reverse().join("");
}

// ── Label → Local Name ───────────────────────────────────────────────

/**
 * Convert a human-readable label to a PascalCase local name suitable for
 * use in an IRI.  Non-alphanumeric characters are stripped and word
 * boundaries trigger capitalisation.
 *
 * Examples:
 *   "Red Blood Cell" → "RedBloodCell"
 *   "has-part"       → "HasPart"
 *   "  foo  bar  "   → "FooBar"
 */
export function labelToLocalName(label: string): string {
  return label
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

// ── Pattern Detection ────────────────────────────────────────────────

/** Regex matching a 20+ char alphanumeric string (typical UUID-base62 or hex) */
const UUID_RE = /^[A-Za-z][A-Za-z0-9]{19,}$/;

/** Regex matching a trailing numeric suffix (e.g., "Class_001", "ENTITY0042") */
const NUMERIC_SUFFIX_RE = /[_-]?(\d+)$/;

/**
 * Classify the dominant IRI suffix pattern from a list of local names.
 *
 * Returns `{ pattern, confidence, nextNumeric? }`.
 */
export function detectIriPattern(localNames: string[]): IriPatternDetectionResult {
  if (localNames.length === 0) {
    return { pattern: "uuid", confidence: 0 };
  }

  let uuidCount = 0;
  let numericCount = 0;
  let maxNumeric = 0;

  for (const name of localNames) {
    if (UUID_RE.test(name)) {
      uuidCount++;
    }
    const numMatch = name.match(NUMERIC_SUFFIX_RE);
    if (numMatch) {
      numericCount++;
      const n = parseInt(numMatch[1], 10);
      if (n > maxNumeric) maxNumeric = n;
    }
  }

  const total = localNames.length;

  if (uuidCount / total > 0.5) {
    return { pattern: "uuid", confidence: uuidCount / total };
  }
  if (numericCount / total > 0.5) {
    return {
      pattern: "numeric",
      confidence: numericCount / total,
      nextNumeric: maxNumeric + 1,
    };
  }
  return { pattern: "named", confidence: 1 - (uuidCount + numericCount) / total };
}

/**
 * Extract local names from the IRI index (built by the Web Worker), filter
 * to internal namespaces, and delegate to `detectIriPattern()`.
 *
 * @param iriIndex        Map<fullIri, IriPosition> from the indexer
 * @param internalNamespaces  Set of namespace URIs that belong to this ontology
 */
export function detectPatternFromIriIndex(
  iriIndex: Map<string, IriPosition>,
  internalNamespaces: Set<string>,
): IriPatternDetectionResult {
  const localNames: string[] = [];

  for (const iri of iriIndex.keys()) {
    const isInternal = [...internalNamespaces].some((ns) => iri.startsWith(ns));
    if (!isInternal) continue;

    const hashIdx = iri.lastIndexOf("#");
    const slashIdx = iri.lastIndexOf("/");
    const sep = hashIdx > -1 ? hashIdx : slashIdx;
    if (sep > -1 && sep < iri.length - 1) {
      localNames.push(iri.slice(sep + 1));
    }
  }

  return detectIriPattern(localNames);
}

// ── IRI Generation ───────────────────────────────────────────────────

/**
 * Generate a full IRI for a new entity.
 *
 * @param options.baseNamespace  The ontology namespace (must end with # or /)
 * @param options.pattern        Which suffix strategy to use
 * @param options.label          Used when pattern is "named"
 * @param options.nextNumeric    Used when pattern is "numeric"
 */
export function generateEntityIri(options: GenerateIriOptions): string {
  const { baseNamespace, pattern, label, nextNumeric } = options;

  switch (pattern) {
    case "uuid":
      return baseNamespace + uuidToBase62();
    case "numeric":
      return baseNamespace + String(nextNumeric ?? 1);
    case "named":
      return baseNamespace + (label ? labelToLocalName(label) : uuidToBase62());
    default:
      return baseNamespace + uuidToBase62();
  }
}
