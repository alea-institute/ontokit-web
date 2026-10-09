/**
 * Turtle source manipulation for individual (named individual) updates.
 *
 * Generates and replaces individual blocks in Turtle source text. Like the
 * class and property updaters, predicates the payload does not describe are
 * carried into the regenerated block verbatim, so a form save never destroys
 * data the form cannot show (#361).
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
  esc,
  iriTurtleForms,
  parseExistingTurtleBlock,
  pruneDeletedLiteralAxioms,
  carriedPredicateObjectText,
  isStructuralObjectText,
  RDF_TYPE_IRI,
  OWL_NAMED_INDIVIDUAL_IRI,
  OWL_DEPRECATED_IRI,
  OWL_SAME_AS_IRI,
  OWL_DIFFERENT_FROM_IRI,
  type ParsedDeclarations,
  type RetainedLiteralTarget,
} from "@/lib/ontology/turtleUtils";
import {
  extractIndividualDetail,
  type PropertyAssertion,
} from "@/lib/ontology/entityDetailExtractors";

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

// The block parser surfaces blank-node and collection objects as pseudo-IRIs
// ("[ ... ]", "( ... )"). They cannot be regenerated from the form payload,
// so they are never written from it; the existing text is carried instead.
const isStructuralObject = isStructuralObjectText;

function dataAssertionObject(
  value: string,
  a: PropertyAssertion,
  rev: Map<string, string>,
): string {
  if (a.lang) return literal(value, a.lang);
  if (a.datatype) return `"${esc(value)}"^^${toTurtle(a.datatype, rev)}`;
  return literal(value, "");
}

function genIndividualBlock(
  iri: string,
  data: TurtleIndividualUpdateData,
  rev: Map<string, string>,
  subject = toTurtle(iri, rev),
  carriedPredicateObjects: string[] = [],
): string {
  const po: string[] = [];

  // rdf:type — owl:NamedIndividual + user types on same line
  const typeTokens = [toTurtle(OWL_NAMED_INDIVIDUAL_IRI, rev)];
  for (const t of data.typeIris) {
    typeTokens.push(toTurtle(t, rev));
  }
  po.push(`a ${typeTokens.join(", ")}`);

  if (data.deprecated) {
    po.push(`${toTurtle(OWL_DEPRECATED_IRI, rev)} true`);
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

  for (const s of data.sameAsIris) {
    po.push(`${toTurtle(OWL_SAME_AS_IRI, rev)} ${toTurtle(s, rev)}`);
  }

  for (const d of data.differentFromIris) {
    po.push(`${toTurtle(OWL_DIFFERENT_FROM_IRI, rev)} ${toTurtle(d, rev)}`);
  }

  // Object property assertions
  for (const a of data.objectPropertyAssertions) {
    if (!a.targetIri || isStructuralObject(a.targetIri)) continue;
    po.push(`${toTurtle(a.propertyIri, rev)} ${toTurtle(a.targetIri, rev)}`);
  }

  // Data property assertions
  for (const a of data.dataPropertyAssertions) {
    if (!a.value) continue;
    po.push(`${toTurtle(a.propertyIri, rev)} ${dataAssertionObject(a.value, a, rev)}`);
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

// ── Preservation helpers ──────────────────────────────────────────────

function addForms(
  forms: Set<string>,
  iri: string,
  declarations: ParsedDeclarations,
): void {
  for (const form of iriTurtleForms(iri, declarations.prefixes, declarations.base)) {
    forms.add(form);
  }
}

/**
 * Turtle spellings of every predicate the form payload describes.
 *
 * Object and data property assertions are complete lists by construction:
 * the detail extractor surfaces every IRI-valued triple and every declared
 * data-property literal, and the form sends back what it shows. A predicate
 * whose assertions the editor removed entirely is therefore absent from the
 * payload yet still described, so the existing block's assertion predicates
 * count too; otherwise a deleted assertion would be resurrected on save.
 * Blank-node and collection objects are excluded because the form cannot
 * represent them.
 */
function describedPredicateForms(
  source: string,
  individualIri: string,
  data: TurtleIndividualUpdateData,
  declarations: ParsedDeclarations,
): Set<string> {
  const forms = new Set<string>(["a"]);
  const add = (iri: string) => addForms(forms, iri, declarations);

  for (const iri of [
    RDF_TYPE_IRI,
    LABEL_IRI,
    COMMENT_IRI,
    DEFINITION_IRI,
    OWL_DEPRECATED_IRI,
    OWL_SAME_AS_IRI,
    OWL_DIFFERENT_FROM_IRI,
    SEE_ALSO_IRI,
    IS_DEFINED_BY_IRI,
  ]) {
    add(iri);
  }
  for (const annotation of data.annotations ?? []) add(annotation.property_iri);

  const existing = extractIndividualDetail(source, individualIri);
  const objectAssertions = [
    ...data.objectPropertyAssertions,
    ...(existing?.objectPropertyAssertions ?? []),
  ];
  for (const a of objectAssertions) {
    if (a.targetIri && !isStructuralObject(a.targetIri)) add(a.propertyIri);
  }
  for (const a of [
    ...data.dataPropertyAssertions,
    ...(existing?.dataPropertyAssertions ?? []),
  ]) {
    add(a.propertyIri);
  }
  return forms;
}

/**
 * Literal objects the regenerated block still holds, keyed by the Turtle
 * spellings of their property, for axiom-provenance retention.
 */
function retainedLiteralTargets(
  data: TurtleIndividualUpdateData,
  declarations: ParsedDeclarations,
  rev: Map<string, string>,
): RetainedLiteralTarget[] {
  const retained: RetainedLiteralTarget[] = [];
  const forms = (iri: string) =>
    iriTurtleForms(iri, declarations.prefixes, declarations.base);
  const addLocalized = (propertyIri: string, values: LocalizedString[]) => {
    for (const v of values) {
      if (!v.value.trim() || (!v.lang && isIriValue(v.value))) continue;
      retained.push({ propertyForms: forms(propertyIri), target: literal(v.value, v.lang) });
    }
  };

  addLocalized(LABEL_IRI, data.labels);
  addLocalized(COMMENT_IRI, data.comments);
  addLocalized(DEFINITION_IRI, data.definitions);
  for (const annotation of data.annotations ?? []) {
    addLocalized(annotation.property_iri, annotation.values);
  }
  for (const a of data.dataPropertyAssertions) {
    if (!a.value) continue;
    retained.push({ propertyForms: forms(a.propertyIri), target: dataAssertionObject(a.value, a, rev) });
  }
  return retained;
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
  const declarations = parseDeclarations(source);
  const { prefixes, base } = declarations;
  const rev = reverseMap(prefixes);
  const lines = source.split("\n");

  const block = findBlock(lines, individualIri, prefixes, base);
  if (!block) {
    throw new Error(
      `Could not find individual "${individualIri}" in ontology source.`,
    );
  }

  const existing = parseExistingTurtleBlock(
    lines.slice(block.startLine, block.endLine + 1).join("\n"),
  );
  const described = describedPredicateForms(source, individualIri, data, declarations);
  const carriedPredicateObjects = existing.predicateObjects
    .map((entry) => carriedPredicateObjectText(entry, described))
    .filter((text): text is string => text !== null);
  const newBlock = genIndividualBlock(
    individualIri,
    data,
    rev,
    existing.subject,
    carriedPredicateObjects,
  );
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);

  return pruneDeletedLiteralAxioms(
    [...before, newBlock, ...after],
    individualIri,
    described,
    retainedLiteralTargets(data, declarations, rev),
    declarations,
  );
}
