/**
 * Known annotation properties grouped by vocabulary.
 * Matches the backend's ANNOTATION_PROPERTIES dict.
 *
 * Each entry has:
 *  - `iri`: full IRI
 *  - `curie`: prefixed name (e.g., "skos:prefLabel") — shown in tooltips
 *  - `displayLabel`: plain-language name (e.g., "Preferred Label") — shown in UI
 *  - `vocabulary`: grouping label for the picker
 */

export interface KnownAnnotationProperty {
  iri: string;
  curie: string;
  displayLabel: string;
  vocabulary: string;
}

export const ANNOTATION_PROPERTIES: KnownAnnotationProperty[] = [
  // ── DC Elements 1.1 ──
  { iri: "http://purl.org/dc/elements/1.1/contributor", curie: "dc:contributor", displayLabel: "Contributor", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/coverage", curie: "dc:coverage", displayLabel: "Coverage", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/creator", curie: "dc:creator", displayLabel: "Creator", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/date", curie: "dc:date", displayLabel: "Date", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/description", curie: "dc:description", displayLabel: "Description", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/format", curie: "dc:format", displayLabel: "Format", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/identifier", curie: "dc:identifier", displayLabel: "Identifier", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/language", curie: "dc:language", displayLabel: "Language", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/publisher", curie: "dc:publisher", displayLabel: "Publisher", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/relation", curie: "dc:relation", displayLabel: "Relation", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/rights", curie: "dc:rights", displayLabel: "Rights", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/source", curie: "dc:source", displayLabel: "Source", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/subject", curie: "dc:subject", displayLabel: "Subject", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/title", curie: "dc:title", displayLabel: "Title", vocabulary: "DC Elements" },
  { iri: "http://purl.org/dc/elements/1.1/type", curie: "dc:type", displayLabel: "Type", vocabulary: "DC Elements" },

  // ── DC Terms ──
  { iri: "http://purl.org/dc/terms/contributor", curie: "dcterms:contributor", displayLabel: "Contributor", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/created", curie: "dcterms:created", displayLabel: "Date Created", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/creator", curie: "dcterms:creator", displayLabel: "Creator", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/date", curie: "dcterms:date", displayLabel: "Date", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/description", curie: "dcterms:description", displayLabel: "Description", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/format", curie: "dcterms:format", displayLabel: "Format", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/identifier", curie: "dcterms:identifier", displayLabel: "Identifier", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/language", curie: "dcterms:language", displayLabel: "Language", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/license", curie: "dcterms:license", displayLabel: "License", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/modified", curie: "dcterms:modified", displayLabel: "Date Modified", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/publisher", curie: "dcterms:publisher", displayLabel: "Publisher", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/rights", curie: "dcterms:rights", displayLabel: "Rights", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/source", curie: "dcterms:source", displayLabel: "Source", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/subject", curie: "dcterms:subject", displayLabel: "Subject", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/title", curie: "dcterms:title", displayLabel: "Title", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/type", curie: "dcterms:type", displayLabel: "Type", vocabulary: "DC Terms" },
  { iri: "http://purl.org/dc/terms/abstract", curie: "dcterms:abstract", displayLabel: "Abstract", vocabulary: "DC Terms" },

  // ── SKOS ──
  { iri: "http://www.w3.org/2004/02/skos/core#prefLabel", curie: "skos:prefLabel", displayLabel: "Preferred Label", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#altLabel", curie: "skos:altLabel", displayLabel: "Synonym(s)", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#hiddenLabel", curie: "skos:hiddenLabel", displayLabel: "Hidden Label", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#definition", curie: "skos:definition", displayLabel: "Definition", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#example", curie: "skos:example", displayLabel: "Example(s)", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#scopeNote", curie: "skos:scopeNote", displayLabel: "Scope Note", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#editorialNote", curie: "skos:editorialNote", displayLabel: "Editorial Note", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#historyNote", curie: "skos:historyNote", displayLabel: "History Note", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#changeNote", curie: "skos:changeNote", displayLabel: "Change Note", vocabulary: "SKOS" },
  { iri: "http://www.w3.org/2004/02/skos/core#notation", curie: "skos:notation", displayLabel: "Notation", vocabulary: "SKOS" },

  // ── RDFS / OWL ──
  { iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", curie: "rdfs:seeAlso", displayLabel: "See Also", vocabulary: "RDFS" },
  { iri: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy", curie: "rdfs:isDefinedBy", displayLabel: "Defined By", vocabulary: "RDFS" },
];

/** Well-known IRIs excluded from the general "Annotations" section (shown in their own sections) */
export const LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
export const COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
export const DEFINITION_IRI = "http://www.w3.org/2004/02/skos/core#definition";

/** Relationship property IRIs — IRI-valued, shown in the Relationship(s) section instead of Annotations */
export const SEE_ALSO_IRI = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
export const IS_DEFINED_BY_IRI = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
export const RELATIONSHIP_PROPERTY_IRIS = new Set([SEE_ALSO_IRI, IS_DEFINED_BY_IRI]);

/** Look up a known annotation property — returns { displayLabel, curie } */
export function getAnnotationPropertyInfo(iri: string): { displayLabel: string; curie: string } {
  const found = ANNOTATION_PROPERTIES.find((p) => p.iri === iri);
  if (found) return { displayLabel: found.displayLabel, curie: found.curie };
  // Fallback: extract local name
  const hashIdx = iri.lastIndexOf("#");
  const localName = hashIdx >= 0 ? iri.substring(hashIdx + 1) : iri.substring(iri.lastIndexOf("/") + 1);
  return { displayLabel: localName, curie: localName };
}

/**
 * @deprecated Use getAnnotationPropertyInfo() instead for both display label and curie.
 */
export function getAnnotationPropertyLabel(iri: string): string {
  return getAnnotationPropertyInfo(iri).displayLabel;
}

/** Group known annotation properties by vocabulary for picker display */
export function getAnnotationPropertiesByVocabulary(): Record<string, KnownAnnotationProperty[]> {
  const groups: Record<string, KnownAnnotationProperty[]> = {};
  for (const prop of ANNOTATION_PROPERTIES) {
    if (!groups[prop.vocabulary]) {
      groups[prop.vocabulary] = [];
    }
    groups[prop.vocabulary].push(prop);
  }
  return groups;
}
