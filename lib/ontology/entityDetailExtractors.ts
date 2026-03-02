/**
 * Entity detail extractors — transform ParsedTriple[] into typed detail objects
 * for PropertyDetailPanel and IndividualDetailPanel.
 */

import { parseBlockTriples, type ParsedTriple } from "@/lib/ontology/turtleBlockParser";
import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import {
  LABEL_IRI,
  COMMENT_IRI,
  DEFINITION_IRI,
  SEE_ALSO_IRI,
  IS_DEFINED_BY_IRI,
} from "@/lib/ontology/annotationProperties";

// ── Well-known IRIs ───────────────────────────────────────────────────

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// OWL property types
const OWL_DATATYPE_PROPERTY = "http://www.w3.org/2002/07/owl#DatatypeProperty";
const OWL_ANNOTATION_PROPERTY = "http://www.w3.org/2002/07/owl#AnnotationProperty";

// OWL property characteristics
const OWL_FUNCTIONAL = "http://www.w3.org/2002/07/owl#FunctionalProperty";
const OWL_INVERSE_FUNCTIONAL = "http://www.w3.org/2002/07/owl#InverseFunctionalProperty";
const OWL_TRANSITIVE = "http://www.w3.org/2002/07/owl#TransitiveProperty";
const OWL_SYMMETRIC = "http://www.w3.org/2002/07/owl#SymmetricProperty";
const OWL_ASYMMETRIC = "http://www.w3.org/2002/07/owl#AsymmetricProperty";
const OWL_REFLEXIVE = "http://www.w3.org/2002/07/owl#ReflexiveProperty";
const OWL_IRREFLEXIVE = "http://www.w3.org/2002/07/owl#IrreflexiveProperty";

// OWL/RDFS predicates for properties
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range";
const RDFS_SUB_PROPERTY_OF = "http://www.w3.org/2000/01/rdf-schema#subPropertyOf";
const OWL_INVERSE_OF = "http://www.w3.org/2002/07/owl#inverseOf";
const OWL_EQUIVALENT_PROPERTY = "http://www.w3.org/2002/07/owl#equivalentProperty";
const OWL_PROPERTY_DISJOINT_WITH = "http://www.w3.org/2002/07/owl#propertyDisjointWith";
const OWL_DEPRECATED = "http://www.w3.org/2002/07/owl#deprecated";

// OWL individual predicates
const OWL_NAMED_INDIVIDUAL = "http://www.w3.org/2002/07/owl#NamedIndividual";
const OWL_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs";
const OWL_DIFFERENT_FROM = "http://www.w3.org/2002/07/owl#differentFrom";

export const PROPERTY_CHARACTERISTIC_TYPES = [
  { iri: OWL_FUNCTIONAL, label: "Functional" },
  { iri: OWL_INVERSE_FUNCTIONAL, label: "Inverse Functional" },
  { iri: OWL_TRANSITIVE, label: "Transitive" },
  { iri: OWL_SYMMETRIC, label: "Symmetric" },
  { iri: OWL_ASYMMETRIC, label: "Asymmetric" },
  { iri: OWL_REFLEXIVE, label: "Reflexive" },
  { iri: OWL_IRREFLEXIVE, label: "Irreflexive" },
] as const;

const CHARACTERISTIC_IRIS = new Set<string>(PROPERTY_CHARACTERISTIC_TYPES.map((c) => c.iri));

// IRIs that belong to specific sections (not general annotations)
const PROPERTY_METADATA_IRIS = new Set([
  RDF_TYPE, LABEL_IRI, COMMENT_IRI, DEFINITION_IRI,
  RDFS_DOMAIN, RDFS_RANGE, RDFS_SUB_PROPERTY_OF,
  OWL_INVERSE_OF, OWL_EQUIVALENT_PROPERTY, OWL_PROPERTY_DISJOINT_WITH,
  OWL_DEPRECATED, SEE_ALSO_IRI, IS_DEFINED_BY_IRI,
]);

const INDIVIDUAL_METADATA_IRIS = new Set([
  RDF_TYPE, LABEL_IRI, COMMENT_IRI, DEFINITION_IRI,
  OWL_SAME_AS, OWL_DIFFERENT_FROM, OWL_DEPRECATED,
  SEE_ALSO_IRI, IS_DEFINED_BY_IRI,
]);

// ── Types ─────────────────────────────────────────────────────────────

export type PropertyType = "object" | "data" | "annotation";

export interface ParsedPropertyDetail {
  propertyType: PropertyType;
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  annotations: AnnotationUpdate[];
  domainIris: string[];
  rangeIris: string[];
  parentIris: string[];
  inverseOf: string | null;
  characteristics: string[]; // IRIs of characteristic types
  deprecated: boolean;
  equivalentIris: string[];
  disjointIris: string[];
  seeAlsoIris: string[];
  isDefinedByIris: string[];
}

export interface PropertyAssertion {
  propertyIri: string;
  targetIri?: string;
  value?: string;
  lang?: string;
  datatype?: string;
}

export interface ParsedIndividualDetail {
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  annotations: AnnotationUpdate[];
  typeIris: string[]; // rdf:type excluding owl:NamedIndividual
  sameAsIris: string[];
  differentFromIris: string[];
  deprecated: boolean;
  objectPropertyAssertions: PropertyAssertion[];
  dataPropertyAssertions: PropertyAssertion[];
  seeAlsoIris: string[];
  isDefinedByIris: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractLiterals(triples: ParsedTriple[], predicateIri: string): LocalizedString[] {
  return triples
    .filter((t) => t.predicate === predicateIri && t.object.type === "literal")
    .map((t) => {
      const obj = t.object as { type: "literal"; value: string; lang?: string };
      return { value: obj.value, lang: obj.lang || "" };
    });
}

function extractIris(triples: ParsedTriple[], predicateIri: string): string[] {
  return triples
    .filter((t) => t.predicate === predicateIri && t.object.type === "iri")
    .map((t) => (t.object as { type: "iri"; value: string }).value);
}

function extractFirstIri(triples: ParsedTriple[], predicateIri: string): string | null {
  const iris = extractIris(triples, predicateIri);
  return iris.length > 0 ? iris[0] : null;
}

function isDeprecated(triples: ParsedTriple[]): boolean {
  return triples.some(
    (t) =>
      t.predicate === OWL_DEPRECATED &&
      t.object.type === "boolean" &&
      t.object.value === true,
  );
}

/** Group remaining annotation triples into AnnotationUpdate[] */
function groupAnnotations(
  triples: ParsedTriple[],
  excludeIris: Set<string>,
): AnnotationUpdate[] {
  const groups = new Map<string, { value: string; lang: string }[]>();

  for (const t of triples) {
    if (excludeIris.has(t.predicate)) continue;
    if (t.object.type !== "literal") continue;
    const obj = t.object as { type: "literal"; value: string; lang?: string };
    if (!groups.has(t.predicate)) groups.set(t.predicate, []);
    groups.get(t.predicate)!.push({ value: obj.value, lang: obj.lang || "" });
  }

  return Array.from(groups.entries()).map(([property_iri, values]) => ({
    property_iri,
    values,
  }));
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Extract property detail from Turtle source.
 * Returns null if the property block cannot be found.
 */
export function extractPropertyDetail(
  source: string,
  propertyIri: string,
): ParsedPropertyDetail | null {
  const triples = parseBlockTriples(source, propertyIri);
  if (!triples) return null;

  // Determine property type from rdf:type triples
  const typeIris = extractIris(triples, RDF_TYPE);
  let propertyType: PropertyType = "object";
  if (typeIris.includes(OWL_DATATYPE_PROPERTY)) {
    propertyType = "data";
  } else if (typeIris.includes(OWL_ANNOTATION_PROPERTY)) {
    propertyType = "annotation";
  }

  // Extract characteristics from rdf:type
  const characteristics = typeIris.filter((iri) => CHARACTERISTIC_IRIS.has(iri));

  return {
    propertyType,
    labels: extractLiterals(triples, LABEL_IRI),
    comments: extractLiterals(triples, COMMENT_IRI),
    definitions: extractLiterals(triples, DEFINITION_IRI),
    annotations: groupAnnotations(triples, PROPERTY_METADATA_IRIS),
    domainIris: extractIris(triples, RDFS_DOMAIN),
    rangeIris: extractIris(triples, RDFS_RANGE),
    parentIris: extractIris(triples, RDFS_SUB_PROPERTY_OF),
    inverseOf: extractFirstIri(triples, OWL_INVERSE_OF),
    characteristics,
    deprecated: isDeprecated(triples),
    equivalentIris: extractIris(triples, OWL_EQUIVALENT_PROPERTY),
    disjointIris: extractIris(triples, OWL_PROPERTY_DISJOINT_WITH),
    seeAlsoIris: extractIris(triples, SEE_ALSO_IRI),
    isDefinedByIris: extractIris(triples, IS_DEFINED_BY_IRI),
  };
}

/**
 * Extract individual detail from Turtle source.
 * Returns null if the individual block cannot be found.
 */
export function extractIndividualDetail(
  source: string,
  individualIri: string,
): ParsedIndividualDetail | null {
  const triples = parseBlockTriples(source, individualIri);
  if (!triples) return null;

  // Types: rdf:type excluding owl:NamedIndividual
  const allTypeIris = extractIris(triples, RDF_TYPE);
  const typeIris = allTypeIris.filter((iri) => iri !== OWL_NAMED_INDIVIDUAL);

  // Property assertions: any predicate NOT in the known metadata set
  const objectPropertyAssertions: PropertyAssertion[] = [];
  const dataPropertyAssertions: PropertyAssertion[] = [];

  for (const t of triples) {
    if (INDIVIDUAL_METADATA_IRIS.has(t.predicate)) continue;
    // Skip annotation properties (literal-valued predicates in known annotation vocabs)
    // These are handled by groupAnnotations

    if (t.object.type === "iri") {
      objectPropertyAssertions.push({
        propertyIri: t.predicate,
        targetIri: t.object.value,
      });
    } else if (t.object.type === "literal") {
      const obj = t.object as { type: "literal"; value: string; lang?: string; datatype?: string };
      // Check if this is a known annotation property (literal-valued)
      // If so, it'll be grouped in annotations instead
      const isKnownAnnotation = !INDIVIDUAL_METADATA_IRIS.has(t.predicate) &&
        groupAnnotations([t], INDIVIDUAL_METADATA_IRIS).length > 0;
      if (!isKnownAnnotation) {
        dataPropertyAssertions.push({
          propertyIri: t.predicate,
          value: obj.value,
          lang: obj.lang,
          datatype: obj.datatype,
        });
      }
    }
  }

  // For annotations, we need to separate literal predicates that are "annotation-like"
  // from data property assertions. We consider predicates from known annotation vocabularies
  // as annotations, and everything else as property assertions.
  const knownAnnotationPrefixes = [
    "http://www.w3.org/2004/02/skos/core#",
    "http://purl.org/dc/elements/1.1/",
    "http://purl.org/dc/terms/",
  ];

  const annotationTriples: ParsedTriple[] = [];
  const pureDataAssertions: PropertyAssertion[] = [];

  for (const da of dataPropertyAssertions) {
    const isAnnotation = knownAnnotationPrefixes.some((p) => da.propertyIri.startsWith(p));
    if (isAnnotation) {
      annotationTriples.push({
        predicate: da.propertyIri,
        object: { type: "literal", value: da.value || "", lang: da.lang, datatype: da.datatype },
      });
    } else {
      pureDataAssertions.push(da);
    }
  }

  return {
    labels: extractLiterals(triples, LABEL_IRI),
    comments: extractLiterals(triples, COMMENT_IRI),
    definitions: extractLiterals(triples, DEFINITION_IRI),
    annotations: [
      ...groupAnnotations(triples, INDIVIDUAL_METADATA_IRIS),
      // Remove duplicates from annotationTriples that groupAnnotations already caught
    ].filter((a, i, arr) => arr.findIndex((b) => b.property_iri === a.property_iri) === i),
    typeIris,
    sameAsIris: extractIris(triples, OWL_SAME_AS),
    differentFromIris: extractIris(triples, OWL_DIFFERENT_FROM),
    deprecated: isDeprecated(triples),
    objectPropertyAssertions,
    dataPropertyAssertions: pureDataAssertions,
    seeAlsoIris: extractIris(triples, SEE_ALSO_IRI),
    isDefinedByIris: extractIris(triples, IS_DEFINED_BY_IRI),
  };
}
