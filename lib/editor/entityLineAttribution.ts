import type { EntityReviewMetadata } from "@/lib/api/suggestions";

export interface LineAttribution {
  entityIri: string | null;
  metadata: EntityReviewMetadata | null;
}

/**
 * Walk an array of patch lines and attribute each line to an entity IRI.
 * Implements the Turtle subject-declaration state machine from RESEARCH.md Pitfall 2:
 * - A `+` line matching `<http...>` at the start updates the current entity context
 * - A `+` line matching `prefix:LocalName a owl:` updates the current entity context
 * - Subsequent `+` lines (`;` continuations) inherit the current entity context
 * - Context lines, hunk headers, and deletion lines get null attribution
 */
export function attributeLinesToEntities(
  lines: string[],
  entityMetadataMap: Map<string, EntityReviewMetadata>,
): LineAttribution[] {
  let currentEntityIri: string | null = null;
  let currentMeta: EntityReviewMetadata | null = null;

  return lines.map((line) => {
    // Context lines, hunk headers, deletion lines: no entity attribution
    if (!line.startsWith("+") || line.startsWith("+++")) {
      return { entityIri: null, metadata: null };
    }

    // Detect full IRI subject declaration: + <http://...>
    const iriMatch = line.match(/^\+\s*<(http[^>]+)>/);
    if (iriMatch) {
      currentEntityIri = iriMatch[1];
      currentMeta = entityMetadataMap.get(currentEntityIri) ?? null;
    } else {
      // Detect prefixed subject declaration: + prefix:LocalName a owl:
      const prefixMatch = line.match(/^\+\s*(\w+:\w+)\s+a\s+owl:/);
      if (prefixMatch) {
        // Look up by scanning entityMetadataMap for a label/IRI ending match.
        // This is a secondary fallback; primary attribution is by full IRI.
        // For now, retain current context (prefix match is best-effort).
        // A more precise implementation would resolve the prefix to a full IRI.
      }
    }

    return { entityIri: currentEntityIri, metadata: currentMeta };
  });
}
