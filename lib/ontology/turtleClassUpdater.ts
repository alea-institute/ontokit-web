/**
 * Turtle source manipulation utility for class updates.
 *
 * Instead of calling a non-existent REST endpoint, this utility modifies the
 * Turtle source text directly so it can be saved via the source save endpoint.
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

// ── Types ─────────────────────────────────────────────────────────────

export interface TurtleClassUpdateData {
  labels: LocalizedString[];
  comments: LocalizedString[];
  parent_iris: string[];
  annotations?: AnnotationUpdate[];
  deprecated?: boolean;
  equivalent_iris?: string[];
  disjoint_iris?: string[];
}

// ── Block generator ───────────────────────────────────────────────────

/**
 * Generate a complete Turtle block for a class.
 */
function genBlock(
  iri: string,
  data: TurtleClassUpdateData,
  rev: Map<string, string>,
): string {
  const subject = toTurtle(iri, rev);
  const po: string[] = [];

  po.push("a owl:Class");

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

  for (const p of data.parent_iris) {
    po.push(`rdfs:subClassOf ${toTurtle(p, rev)}`);
  }

  if (data.equivalent_iris) {
    for (const e of data.equivalent_iris) {
      po.push(`owl:equivalentClass ${toTurtle(e, rev)}`);
    }
  }

  if (data.disjoint_iris) {
    for (const d of data.disjoint_iris) {
      po.push(`owl:disjointWith ${toTurtle(d, rev)}`);
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
    return `${subject} ${po[0] || "a owl:Class"} .`;
  }

  const lines = [`${subject} ${po[0]} ;`];
  for (let i = 1; i < po.length; i++) {
    lines.push(`    ${po[i]}${i === po.length - 1 ? " ." : " ;"}`);
  }
  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Update a class definition in Turtle source text.
 *
 * Finds the class block by IRI (handling full IRIs, prefixed names, and
 * relative IRIs via @base), generates a replacement block with all
 * provided properties, and returns the modified source.
 *
 * @throws Error if the class block cannot be found in the source
 */
export function updateClassInTurtle(
  source: string,
  classIri: string,
  data: TurtleClassUpdateData,
): string {
  const { prefixes, base } = parseDeclarations(source);
  const rev = reverseMap(prefixes);
  const lines = source.split("\n");

  const block = findBlock(lines, classIri, prefixes, base);
  if (!block) {
    throw new Error(
      `Could not find class "${classIri}" in ontology source. ` +
        `The class may have been added via the form and not yet committed to the source file.`,
    );
  }

  const newBlock = genBlock(classIri, data, rev);
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return [...before, newBlock, ...after].join("\n");
}
