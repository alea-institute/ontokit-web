/**
 * Turtle source manipulation utility for class updates.
 *
 * Instead of calling a non-existent REST endpoint, this utility modifies the
 * Turtle source text directly so it can be saved via the source save endpoint.
 */

import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import {
  parseDeclarations,
  parseExistingTurtleBlock,
  type ExistingTurtleBlock,
  reverseMap,
  toTurtle,
  findBlock,
  literal,
  isIriValue,
  iriTurtleForms,
  escapeRegex,
  pruneDeletedLiteralAxioms,
  carriedPredicateObjectText,
  RDF_TYPE_IRI,
  OWL_CLASS_IRI,
  OWL_DEPRECATED_IRI,
  type RetainedLiteralTarget,
} from "@/lib/ontology/turtleUtils";

const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_SUBCLASS_IRI = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const OWL_EQUIVALENT_CLASS_IRI = "http://www.w3.org/2002/07/owl#equivalentClass";
const OWL_DISJOINT_WITH_IRI = "http://www.w3.org/2002/07/owl#disjointWith";

function preserveExistingUntaggedLabels(
  labels: LocalizedString[],
  existing: ExistingTurtleBlock,
  declarations: ReturnType<typeof parseDeclarations>,
): LocalizedString[] {
  const labelForms = new Set(
    iriTurtleForms(RDFS_LABEL_IRI, declarations.prefixes, declarations.base),
  );
  const existingLabelObjects = existing.predicateObjects
    .filter(({ predicate }) => labelForms.has(predicate))
    .map(({ predicate, text }) => text.slice(predicate.length).trim());

  return labels.map((label) => {
    if (!label.lang || !label.value.trim()) return label;

    const untaggedLiteral = literal(label.value, "");
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- the only dynamic segment is quoted by escapeRegex
    const untaggedPattern = new RegExp(
      `(?:^|,\\s*)${escapeRegex(untaggedLiteral)}(?=\\s*(?:,|$))`,
      "u",
    );
    return existingLabelObjects.some((objects) => untaggedPattern.test(objects))
      ? { ...label, lang: "" }
      : label;
  });
}

function describedPredicateForms(
  data: TurtleClassUpdateData,
  declarations: ReturnType<typeof parseDeclarations>,
): Set<string> {
  const { prefixes, base } = declarations;
  const forms = new Set<string>(["a"]);
  const add = (iri: string) => {
    for (const form of iriTurtleForms(iri, prefixes, base)) forms.add(form);
  };

  add(RDF_TYPE_IRI);
  add(RDFS_LABEL_IRI);
  add(RDFS_COMMENT_IRI);
  add(RDFS_SUBCLASS_IRI);
  add(OWL_DEPRECATED_IRI);
  add(OWL_EQUIVALENT_CLASS_IRI);
  add(OWL_DISJOINT_WITH_IRI);
  for (const annotation of data.annotations ?? []) add(annotation.property_iri);
  return forms;
}

/**
 * Literal objects the regenerated block still holds, keyed by the Turtle
 * spellings of their property, for axiom-provenance retention.
 */
function retainedLiteralPatterns(
  data: TurtleClassUpdateData,
  declarations: ReturnType<typeof parseDeclarations>,
): RetainedLiteralTarget[] {
  const patterns: RetainedLiteralTarget[] = [];
  const add = (propertyIri: string, values: LocalizedString[]) => {
    for (const value of values) {
      if (!value.value.trim() || (!value.lang && isIriValue(value.value))) continue;
      patterns.push({
        propertyForms: iriTurtleForms(propertyIri, declarations.prefixes, declarations.base),
        target: literal(value.value, value.lang),
      });
    }
  };

  add(RDFS_LABEL_IRI, data.labels);
  add(RDFS_COMMENT_IRI, data.comments);
  for (const annotation of data.annotations ?? []) {
    add(annotation.property_iri, annotation.values);
  }
  return patterns;
}

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
  subject = toTurtle(iri, rev),
  carriedPredicateObjects: string[] = [],
): string {
  const po: string[] = [];

  po.push(`a ${toTurtle(OWL_CLASS_IRI, rev)}`);

  if (data.deprecated) {
    po.push(`${toTurtle(OWL_DEPRECATED_IRI, rev)} true`);
  }

  for (const l of data.labels) {
    if (!l.value.trim()) continue;
    po.push(`${toTurtle(RDFS_LABEL_IRI, rev)} ${literal(l.value, l.lang)}`);
  }

  for (const c of data.comments) {
    if (!c.value.trim()) continue;
    po.push(`${toTurtle(RDFS_COMMENT_IRI, rev)} ${literal(c.value, c.lang)}`);
  }

  for (const p of data.parent_iris) {
    po.push(`${toTurtle(RDFS_SUBCLASS_IRI, rev)} ${toTurtle(p, rev)}`);
  }

  if (data.equivalent_iris) {
    for (const e of data.equivalent_iris) {
      po.push(`${toTurtle(OWL_EQUIVALENT_CLASS_IRI, rev)} ${toTurtle(e, rev)}`);
    }
  }

  if (data.disjoint_iris) {
    for (const d of data.disjoint_iris) {
      po.push(`${toTurtle(OWL_DISJOINT_WITH_IRI, rev)} ${toTurtle(d, rev)}`);
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
  const declarations = parseDeclarations(source);
  const { prefixes, base } = declarations;
  const rev = reverseMap(prefixes);
  const lines = source.split("\n");

  const block = findBlock(lines, classIri, prefixes, base);
  if (!block) {
    throw new Error(
      `Could not find class "${classIri}" in ontology source. ` +
        `The class may have been added via the form and not yet committed to the source file.`,
    );
  }

  const existing = parseExistingTurtleBlock(
    lines.slice(block.startLine, block.endLine + 1).join("\n"),
  );
  const described = describedPredicateForms(data, declarations);
  // Undescribed predicates are carried whole; for described ones (e.g.
  // rdfs:subClassOf) the blank-node restrictions and collections the form
  // cannot express are carried beside the payload's IRIs.
  const carriedPredicateObjects = existing.predicateObjects
    .map((entry) => carriedPredicateObjectText(entry, described))
    .filter((text): text is string => text !== null);
  const normalizedData = {
    ...data,
    labels: preserveExistingUntaggedLabels(data.labels, existing, declarations),
  };
  const newBlock = genBlock(
    classIri,
    normalizedData,
    rev,
    existing.subject,
    carriedPredicateObjects,
  );
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  // Only axioms whose literal this save removed from a described predicate
  // are pruned; provenance on carried or untouched triples survives.
  return pruneDeletedLiteralAxioms(
    [...before, newBlock, ...after],
    classIri,
    described,
    retainedLiteralPatterns(normalizedData, declarations),
    declarations,
  );
}
