/**
 * Generate valid Turtle snippets for new ontology entities.
 *
 * The snippet is appended to the Monaco editor buffer so it participates in
 * the existing undo stack and commit flow.
 */

import type { EntityType } from "./iriGeneration";

// ── Types ────────────────────────────────────────────────────────────

export interface TurtleSnippetOptions {
  /** Full IRI of the new entity */
  iri: string;
  /** Human-readable label */
  label: string;
  /** The kind of OWL entity to create */
  entityType: EntityType;
  /** If provided, adds a parent relationship (subClassOf / subPropertyOf / rdf:type) */
  parentIri?: string;
  /** Prefix alias for the ontology namespace (e.g., "ex") — enables prefixed names */
  ontologyPrefix?: string;
  /** The ontology namespace (e.g., "http://example.org/ont#") */
  ontologyNamespace?: string;
}

// ── Mappings ─────────────────────────────────────────────────────────

const OWL_TYPE: Record<EntityType, string> = {
  class: "owl:Class",
  objectProperty: "owl:ObjectProperty",
  dataProperty: "owl:DatatypeProperty",
  annotationProperty: "owl:AnnotationProperty",
  individual: "owl:NamedIndividual",
};

const PARENT_PREDICATE: Record<EntityType, string> = {
  class: "rdfs:subClassOf",
  objectProperty: "rdfs:subPropertyOf",
  dataProperty: "rdfs:subPropertyOf",
  annotationProperty: "rdfs:subPropertyOf",
  individual: "rdf:type",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Escape a Turtle string literal (quotes and backslashes). */
function escapeTurtleString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Convert a full IRI to a prefixed name if the ontology prefix/namespace
 * are available and the IRI starts with the namespace.  Falls back to
 * `<full-IRI>` syntax.
 */
function toPrefixedOrFull(
  iri: string,
  ontologyPrefix?: string,
  ontologyNamespace?: string,
): string {
  if (ontologyPrefix && ontologyNamespace && iri.startsWith(ontologyNamespace)) {
    const localName = iri.slice(ontologyNamespace.length);
    return `${ontologyPrefix}:${localName}`;
  }
  return `<${iri}>`;
}

// ── Generator ────────────────────────────────────────────────────────

/**
 * Produce a complete Turtle snippet for a new entity.
 *
 * Example output:
 * ```
 * ex:Foo a owl:Class ;
 *     rdfs:label "Foo"@en ;
 *     rdfs:subClassOf ex:Bar .
 * ```
 */
export function generateTurtleSnippet(options: TurtleSnippetOptions): string {
  const {
    iri,
    label,
    entityType,
    parentIri,
    ontologyPrefix,
    ontologyNamespace,
  } = options;

  const subject = toPrefixedOrFull(iri, ontologyPrefix, ontologyNamespace);
  const owlType = OWL_TYPE[entityType];
  const escapedLabel = escapeTurtleString(label);

  const lines: string[] = [];

  // Subject and rdf:type
  lines.push(`${subject} a ${owlType} ;`);

  // rdfs:label
  if (parentIri) {
    lines.push(`    rdfs:label "${escapedLabel}"@en ;`);
  } else {
    lines.push(`    rdfs:label "${escapedLabel}"@en .`);
  }

  // Parent relationship
  if (parentIri) {
    const predicate = PARENT_PREDICATE[entityType];
    const parentRef = toPrefixedOrFull(parentIri, ontologyPrefix, ontologyNamespace);
    lines.push(`    ${predicate} ${parentRef} .`);
  }

  // Leading blank line for separation, trailing newline
  return "\n" + lines.join("\n") + "\n";
}
