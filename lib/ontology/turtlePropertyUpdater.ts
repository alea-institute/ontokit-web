/**
 * Turtle source manipulation for property updates.
 *
 * Generates and replaces property blocks in Turtle source text.
 */

import {
  LABEL_IRI,
  COMMENT_IRI,
  DEFINITION_IRI,
  SEE_ALSO_IRI,
  IS_DEFINED_BY_IRI,
} from "@/lib/ontology/annotationProperties";
import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import {
  parseDeclarations,
  reverseMap,
  toTurtle,
  findBlock,
  literal,
  isIriValue,
  iriTurtleForms,
  parseExistingTurtleBlock,
} from "@/lib/ontology/turtleUtils";
import type { PropertyType } from "@/lib/ontology/entityDetailExtractors";

// ── Types ─────────────────────────────────────────────────────────────

export interface TurtlePropertyUpdateData {
  propertyType: PropertyType;
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  domainIris: string[];
  rangeIris: string[];
  parentIris: string[];
  inverseOf: string | null;
  characteristics: string[]; // Full IRIs of owl:FunctionalProperty etc.
  annotations?: AnnotationUpdate[];
  deprecated?: boolean;
  equivalentIris?: string[];
  disjointIris?: string[];
  seeAlsoIris?: string[];
  isDefinedByIris?: string[];
}

// ── OWL type mappings ─────────────────────────────────────────────────

const PROPERTY_TYPE_MAP: Record<PropertyType, string> = {
  object: "http://www.w3.org/2002/07/owl#ObjectProperty",
  data: "http://www.w3.org/2002/07/owl#DatatypeProperty",
  annotation: "http://www.w3.org/2002/07/owl#AnnotationProperty",
};

const CHARACTERISTIC_CURIE_MAP: Record<string, string> = {
  "http://www.w3.org/2002/07/owl#FunctionalProperty": "owl:FunctionalProperty",
  "http://www.w3.org/2002/07/owl#InverseFunctionalProperty": "owl:InverseFunctionalProperty",
  "http://www.w3.org/2002/07/owl#TransitiveProperty": "owl:TransitiveProperty",
  "http://www.w3.org/2002/07/owl#SymmetricProperty": "owl:SymmetricProperty",
  "http://www.w3.org/2002/07/owl#AsymmetricProperty": "owl:AsymmetricProperty",
  "http://www.w3.org/2002/07/owl#ReflexiveProperty": "owl:ReflexiveProperty",
  "http://www.w3.org/2002/07/owl#IrreflexiveProperty": "owl:IrreflexiveProperty",
};

// ── Block generator ───────────────────────────────────────────────────

function genPropertyBlock(
  iri: string,
  data: TurtlePropertyUpdateData,
  rev: Map<string, string>,
  carriedPredicateObjects: string[] = [],
): string {
  const subject = toTurtle(iri, rev);
  const po: string[] = [];

  // rdf:type — primary type + characteristics on same line with commas
  const typeTokens = [toTurtle(PROPERTY_TYPE_MAP[data.propertyType], rev)];
  for (const ch of data.characteristics) {
    const curie = CHARACTERISTIC_CURIE_MAP[ch];
    if (curie) typeTokens.push(toTurtle(ch, rev));
  }
  po.push(`a ${typeTokens.join(", ")}`);

  if (data.deprecated) {
    po.push(`${toTurtle("http://www.w3.org/2002/07/owl#deprecated", rev)} true`);
  }

  for (const l of data.labels) {
    if (!l.value.trim()) continue;
    po.push(`${toTurtle(LABEL_IRI, rev)} ${literal(l.value, l.lang)}`);
  }

  for (const c of data.comments) {
    if (!c.value.trim()) continue;
    po.push(`${toTurtle(COMMENT_IRI, rev)} ${literal(c.value, c.lang)}`);
  }

  for (const d of data.definitions) {
    if (!d.value.trim()) continue;
    po.push(`${toTurtle(DEFINITION_IRI, rev)} ${literal(d.value, d.lang)}`);
  }

  for (const d of data.domainIris) {
    po.push(`${toTurtle("http://www.w3.org/2000/01/rdf-schema#domain", rev)} ${toTurtle(d, rev)}`);
  }

  for (const r of data.rangeIris) {
    po.push(`${toTurtle("http://www.w3.org/2000/01/rdf-schema#range", rev)} ${toTurtle(r, rev)}`);
  }

  for (const p of data.parentIris) {
    po.push(`${toTurtle("http://www.w3.org/2000/01/rdf-schema#subPropertyOf", rev)} ${toTurtle(p, rev)}`);
  }

  if (data.inverseOf) {
    po.push(`${toTurtle("http://www.w3.org/2002/07/owl#inverseOf", rev)} ${toTurtle(data.inverseOf, rev)}`);
  }

  if (data.equivalentIris) {
    for (const e of data.equivalentIris) {
      po.push(`${toTurtle("http://www.w3.org/2002/07/owl#equivalentProperty", rev)} ${toTurtle(e, rev)}`);
    }
  }

  if (data.disjointIris) {
    for (const d of data.disjointIris) {
      po.push(`${toTurtle("http://www.w3.org/2002/07/owl#propertyDisjointWith", rev)} ${toTurtle(d, rev)}`);
    }
  }

  if (data.seeAlsoIris) {
    for (const s of data.seeAlsoIris) {
      po.push(`${toTurtle(SEE_ALSO_IRI, rev)} ${toTurtle(s, rev)}`);
    }
  }

  if (data.isDefinedByIris) {
    for (const d of data.isDefinedByIris) {
      po.push(`${toTurtle(IS_DEFINED_BY_IRI, rev)} ${toTurtle(d, rev)}`);
    }
  }

  if (data.annotations) {
    for (const ann of data.annotations) {
      const prop = toTurtle(ann.property_iri, rev);
      for (const v of ann.values) {
        if (!v.value.trim()) continue;
        if (!v.lang && isIriValue(v.value)) {
          po.push(`${prop} ${toTurtle(v.value, rev)}`);
        } else {
          po.push(`${prop} ${literal(v.value, v.lang)}`);
        }
      }
    }
  }

  po.push(...carriedPredicateObjects);

  if (po.length <= 1) {
    return `${subject} ${po[0]} .`;
  }

  const lines = [`${subject} ${po[0]} ;`];
  for (let i = 1; i < po.length; i++) {
    lines.push(`    ${po[i]}${i === po.length - 1 ? " ." : " ;"}`);
  }
  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Update a property definition in Turtle source text.
 *
 * @throws Error if the property block cannot be found in the source
 */
export function updatePropertyInTurtle(
  source: string,
  propertyIri: string,
  data: TurtlePropertyUpdateData,
): string {
  const { prefixes, base } = parseDeclarations(source);
  const rev = reverseMap(prefixes);
  const lines = source.split("\n");

  const block = findBlock(lines, propertyIri, prefixes, base);
  if (!block) {
    throw new Error(
      `Could not find property "${propertyIri}" in ontology source.`,
    );
  }

  const existing = parseExistingTurtleBlock(
    lines.slice(block.startLine, block.endLine + 1).join("\n"),
  );
  const described = new Set<string>(["a"]);
  const describedIris = [
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "http://www.w3.org/2000/01/rdf-schema#label",
    "http://www.w3.org/2000/01/rdf-schema#comment",
    "http://www.w3.org/2004/02/skos/core#definition",
    "http://www.w3.org/2000/01/rdf-schema#domain",
    "http://www.w3.org/2000/01/rdf-schema#range",
    "http://www.w3.org/2000/01/rdf-schema#subPropertyOf",
    "http://www.w3.org/2002/07/owl#inverseOf",
    "http://www.w3.org/2002/07/owl#deprecated",
    "http://www.w3.org/2002/07/owl#equivalentProperty",
    "http://www.w3.org/2002/07/owl#propertyDisjointWith",
    "http://www.w3.org/2000/01/rdf-schema#seeAlso",
    "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
    ...(data.annotations ?? []).map((annotation) => annotation.property_iri),
  ];
  for (const iri of describedIris) {
    for (const form of iriTurtleForms(iri, prefixes, base)) described.add(form);
  }
  const carriedPredicateObjects = existing.predicateObjects
    .filter(({ predicate }) => !described.has(predicate))
    .map(({ text }) => text);
  const newBlock = genPropertyBlock(propertyIri, data, rev, carriedPredicateObjects);
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return [...before, newBlock, ...after].join("\n");
}
