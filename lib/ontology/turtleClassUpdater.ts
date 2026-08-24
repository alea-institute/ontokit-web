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
  iriTurtleForms,
  scanToBlockEnd,
  escapeRegex,
} from "@/lib/ontology/turtleUtils";

const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_SUBCLASS_IRI = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const OWL_DEPRECATED_IRI = "http://www.w3.org/2002/07/owl#deprecated";
const OWL_EQUIVALENT_CLASS_IRI = "http://www.w3.org/2002/07/owl#equivalentClass";
const OWL_DISJOINT_WITH_IRI = "http://www.w3.org/2002/07/owl#disjointWith";

interface ExistingClassBlock {
  subject: string;
  predicateObjects: Array<{ predicate: string; text: string }>;
}

function preserveExistingUntaggedLabels(
  labels: LocalizedString[],
  existing: ExistingClassBlock,
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

function parseExistingClassBlock(block: string): ExistingClassBlock {
  const subjectMatch = block.match(/^\s*(<[^>]+>|(?:[A-Za-z_][\w-]*)?:[\w-]+)/u);
  if (!subjectMatch) {
    throw new Error("Could not parse the class subject from its Turtle block");
  }

  const body = block.slice(subjectMatch[0].length);
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let longString = false;
  let inIri = false;

  for (let index = 0; index < body.length; index++) {
    const char = body[index];

    if (quote) {
      if (longString) {
        if (body.slice(index, index + 3) === quote.repeat(3)) {
          quote = "";
          longString = false;
          index += 2;
        }
      } else if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (inIri) {
      if (char === ">") inIri = false;
      continue;
    }

    if (body.slice(index, index + 3) === '\"\"\"' || body.slice(index, index + 3) === "'''") {
      quote = char;
      longString = true;
      index += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "<") {
      inIri = true;
      continue;
    }
    if (char === "[" || char === "(") depth++;
    if (char === "]" || char === ")") depth--;

    if (depth === 0 && (char === ";" || (char === "." && /\s|$/.test(body[index + 1] ?? "")))) {
      const part = body.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }

  return {
    subject: subjectMatch[1],
    predicateObjects: parts.map((text) => ({
      predicate: text.match(/^\S+/u)?.[0] ?? "",
      text,
    })),
  };
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

function retainedLiteralPatterns(
  data: TurtleClassUpdateData,
  prefixes: ReturnType<typeof parseDeclarations>["prefixes"],
): Array<{ propertyForms: string[]; target: string }> {
  const patterns: Array<{ propertyForms: string[]; target: string }> = [];
  const add = (propertyIri: string, values: LocalizedString[]) => {
    for (const value of values) {
      if (!value.value.trim() || (!value.lang && isIriValue(value.value))) continue;
      patterns.push({
        propertyForms: iriTurtleForms(propertyIri, prefixes),
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

function pruneDeletedLiteralAxioms(
  lines: string[],
  classIri: string,
  data: TurtleClassUpdateData,
  declarations: ReturnType<typeof parseDeclarations>,
): string {
  const { prefixes, base } = declarations;
  const sourceForms = iriTurtleForms(classIri, prefixes, base);
  const retained = retainedLiteralPatterns(data, prefixes);
  const remove = new Set<number>();

  for (let start = 0; start < lines.length; start++) {
    const trimmed = lines[start].trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("@")) continue;

    const end = scanToBlockEnd(lines, start);
    const block = lines.slice(start, end + 1).join("\n");
    if (!/(?:^|[;\s])a\s+owl:Axiom\b/.test(block)) {
      start = end;
      continue;
    }

    const annotatesClass = sourceForms.some((form) =>
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- form is quoted by escapeRegex before interpolation
      new RegExp(`owl:annotatedSource\\s+${escapeRegex(form)}(?=\\s*[;.])`).test(block),
    );
    if (!annotatesClass) {
      start = end;
      continue;
    }

    const stillExists = retained.some(({ propertyForms, target }) => {
      const hasProperty = propertyForms.some((form) =>
        // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- form is quoted by escapeRegex before interpolation
        new RegExp(`owl:annotatedProperty\\s+${escapeRegex(form)}(?=\\s*[;.])`).test(block),
      );
      return (
        hasProperty &&
        // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- target is quoted by escapeRegex before interpolation
        new RegExp(`owl:annotatedTarget\\s+${escapeRegex(target)}(?=\\s*[;.])`).test(block)
      );
    });

    if (!stillExists) {
      for (let line = start; line <= end; line++) remove.add(line);
      if (end + 1 < lines.length && lines[end + 1].trim() === "") remove.add(end + 1);
    }
    start = end;
  }

  return lines.filter((_, index) => !remove.has(index)).join("\n");
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

  po.push(...carriedPredicateObjects);

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

  const existing = parseExistingClassBlock(
    lines.slice(block.startLine, block.endLine + 1).join("\n"),
  );
  const described = describedPredicateForms(data, declarations);
  const carriedPredicateObjects = existing.predicateObjects
    .filter(({ predicate }) => !described.has(predicate))
    .map(({ text }) => text);
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

  return pruneDeletedLiteralAxioms(
    [...before, newBlock, ...after],
    classIri,
    normalizedData,
    declarations,
  );
}
