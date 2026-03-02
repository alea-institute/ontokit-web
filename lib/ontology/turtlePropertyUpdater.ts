/**
 * Turtle source manipulation for property updates.
 *
 * Generates and replaces property blocks in Turtle source text.
 */

import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import {
  parseDeclarations,
  reverseMap,
  toTurtle,
  findBlock,
  literal,
  isIriValue,
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
  object: "owl:ObjectProperty",
  data: "owl:DatatypeProperty",
  annotation: "owl:AnnotationProperty",
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
): string {
  const subject = toTurtle(iri, rev);
  const po: string[] = [];

  // rdf:type — primary type + characteristics on same line with commas
  const typeTokens = [PROPERTY_TYPE_MAP[data.propertyType]];
  for (const ch of data.characteristics) {
    const curie = CHARACTERISTIC_CURIE_MAP[ch];
    if (curie) typeTokens.push(curie);
  }
  po.push(`a ${typeTokens.join(", ")}`);

  if (data.deprecated) {
    po.push("owl:deprecated true");
  }

  for (const l of data.labels) {
    if (!l.value.trim()) continue;
    po.push(`rdfs:label ${literal(l.value, l.lang)}`);
  }

  for (const c of data.comments) {
    if (!c.value.trim()) continue;
    po.push(`rdfs:comment ${literal(c.value, c.lang)}`);
  }

  for (const d of data.definitions) {
    if (!d.value.trim()) continue;
    po.push(`skos:definition ${literal(d.value, d.lang)}`);
  }

  for (const d of data.domainIris) {
    po.push(`rdfs:domain ${toTurtle(d, rev)}`);
  }

  for (const r of data.rangeIris) {
    po.push(`rdfs:range ${toTurtle(r, rev)}`);
  }

  for (const p of data.parentIris) {
    po.push(`rdfs:subPropertyOf ${toTurtle(p, rev)}`);
  }

  if (data.inverseOf) {
    po.push(`owl:inverseOf ${toTurtle(data.inverseOf, rev)}`);
  }

  if (data.equivalentIris) {
    for (const e of data.equivalentIris) {
      po.push(`owl:equivalentProperty ${toTurtle(e, rev)}`);
    }
  }

  if (data.disjointIris) {
    for (const d of data.disjointIris) {
      po.push(`owl:propertyDisjointWith ${toTurtle(d, rev)}`);
    }
  }

  if (data.seeAlsoIris) {
    for (const s of data.seeAlsoIris) {
      po.push(`rdfs:seeAlso ${toTurtle(s, rev)}`);
    }
  }

  if (data.isDefinedByIris) {
    for (const d of data.isDefinedByIris) {
      po.push(`rdfs:isDefinedBy ${toTurtle(d, rev)}`);
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

  if (po.length <= 1) {
    return `${subject} ${po[0] || `a ${PROPERTY_TYPE_MAP[data.propertyType]}`} .`;
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

  const newBlock = genPropertyBlock(propertyIri, data, rev);
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return [...before, newBlock, ...after].join("\n");
}
