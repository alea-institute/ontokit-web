/**
 * Turtle source manipulation for individual (named individual) updates.
 *
 * Generates and replaces individual blocks in Turtle source text.
 */

import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import {
  parseDeclarations,
  reverseMap,
  toTurtle,
  findBlock,
  literal,
  isIriValue,
  esc,
} from "@/lib/ontology/turtleUtils";
import type { PropertyAssertion } from "@/lib/ontology/entityDetailExtractors";

// ── Types ─────────────────────────────────────────────────────────────

export interface TurtleIndividualUpdateData {
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  typeIris: string[];
  sameAsIris: string[];
  differentFromIris: string[];
  objectPropertyAssertions: PropertyAssertion[];
  dataPropertyAssertions: PropertyAssertion[];
  annotations?: AnnotationUpdate[];
  deprecated?: boolean;
  seeAlsoIris?: string[];
  isDefinedByIris?: string[];
}

// ── Block generator ───────────────────────────────────────────────────

function genIndividualBlock(
  iri: string,
  data: TurtleIndividualUpdateData,
  rev: Map<string, string>,
): string {
  const subject = toTurtle(iri, rev);
  const po: string[] = [];

  // rdf:type — owl:NamedIndividual + user types on same line
  const typeTokens = ["owl:NamedIndividual"];
  for (const t of data.typeIris) {
    typeTokens.push(toTurtle(t, rev));
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

  for (const s of data.sameAsIris) {
    po.push(`owl:sameAs ${toTurtle(s, rev)}`);
  }

  for (const d of data.differentFromIris) {
    po.push(`owl:differentFrom ${toTurtle(d, rev)}`);
  }

  // Object property assertions
  for (const a of data.objectPropertyAssertions) {
    if (!a.targetIri) continue;
    po.push(`${toTurtle(a.propertyIri, rev)} ${toTurtle(a.targetIri, rev)}`);
  }

  // Data property assertions
  for (const a of data.dataPropertyAssertions) {
    if (!a.value) continue;
    const prop = toTurtle(a.propertyIri, rev);
    if (a.lang) {
      po.push(`${prop} ${literal(a.value, a.lang)}`);
    } else if (a.datatype) {
      const escaped = esc(a.value);
      po.push(`${prop} "${escaped}"^^${toTurtle(a.datatype, rev)}`);
    } else {
      po.push(`${prop} ${literal(a.value, "")}`);
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
    return `${subject} ${po[0] || "a owl:NamedIndividual"} .`;
  }

  const lines = [`${subject} ${po[0]} ;`];
  for (let i = 1; i < po.length; i++) {
    lines.push(`    ${po[i]}${i === po.length - 1 ? " ." : " ;"}`);
  }
  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Update an individual definition in Turtle source text.
 *
 * @throws Error if the individual block cannot be found in the source
 */
export function updateIndividualInTurtle(
  source: string,
  individualIri: string,
  data: TurtleIndividualUpdateData,
): string {
  const { prefixes, base } = parseDeclarations(source);
  const rev = reverseMap(prefixes);
  const lines = source.split("\n");

  const block = findBlock(lines, individualIri, prefixes, base);
  if (!block) {
    throw new Error(
      `Could not find individual "${individualIri}" in ontology source.`,
    );
  }

  const newBlock = genIndividualBlock(individualIri, data, rev);
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return [...before, newBlock, ...after].join("\n");
}
