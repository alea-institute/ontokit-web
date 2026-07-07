/**
 * Generate valid Turtle snippets for new ontology entities.
 *
 * The snippet is appended to the Monaco editor buffer so it participates in
 * the existing undo stack and commit flow.
 */

import type { EntityType } from "./iriGeneration";

// ── Types ────────────────────────────────────────────────────────────

/**
 * PROV-O provenance for an AI-generated entity (q9 decision: PROV-O).
 *
 * Persisted on the new entity as:
 * `prov:wasGeneratedBy [ a prov:Activity ;
 *    prov:wasAssociatedWith [ a prov:SoftwareAgent ; rdfs:label <model> ] ;
 *    prov:used [ a prov:Plan ; rdfs:label <promptTemplate> ] ]`
 *
 * Only entities actually minted from an accepted LLM suggestion should carry
 * this. Value-level accepts on EXISTING entities (annotations/parents/edges)
 * are deliberately NOT stamped: statement-level provenance is not expressible
 * in plain Turtle without reification, and `prov:wasGeneratedBy` on a
 * pre-existing entity would assert something false.
 */
export interface SnippetProvenance {
  /** Model id that generated the suggestion (e.g., "openai/gpt-4o") */
  model: string;
  /** Prompt-template dispatch key (e.g., "children-v1") — persisted as a prov:Plan */
  promptTemplate?: string;
  /**
   * Emit `@prefix prov: <http://www.w3.org/ns/prov#> .` ahead of the entity
   * block. Turtle allows re-declaration, so `true` is always safe; callers
   * that can see the document source may pass `false` when the prefix is
   * already declared, to keep the source tidy. Default: true.
   */
  declarePrefix?: boolean;
}

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
  /** If provided, persists PROV-O provenance triples on the new entity */
  provenance?: SnippetProvenance;
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

/** W3C PROV-O namespace (inline constant — no runtime dependency). */
export const PROV_NAMESPACE = "http://www.w3.org/ns/prov#";

const PROV_PREFIX_DIRECTIVE = `@prefix prov: <${PROV_NAMESPACE}> .`;

/**
 * Matches an existing prov: prefix declaration in a Turtle document
 * (`@prefix prov: …` or SPARQL-style `PREFIX prov: …`).
 */
export const PROV_PREFIX_DECLARED_RE = /^\s*(@prefix|PREFIX)\s+prov:/im;

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

/**
 * Build the PROV-O predicate block for an AI-generated entity.
 * Returned WITHOUT leading indentation on the first line (the caller
 * indents predicate lines uniformly).
 */
function provenanceBlock(provenance: SnippetProvenance): string {
  const model = escapeTurtleString(provenance.model);
  const inner: string[] = [
    "        a prov:Activity ;",
    "        prov:wasAssociatedWith [",
    "            a prov:SoftwareAgent ;",
    `            rdfs:label "${model}"`,
    "        ]",
  ];
  if (provenance.promptTemplate) {
    const plan = escapeTurtleString(provenance.promptTemplate);
    inner[inner.length - 1] += " ;";
    inner.push(
      "        prov:used [",
      "            a prov:Plan ;",
      `            rdfs:label "${plan}"`,
      "        ]",
    );
  }
  return ["prov:wasGeneratedBy [", ...inner, "    ]"].join("\n");
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
    provenance,
  } = options;

  const subject = toPrefixedOrFull(iri, ontologyPrefix, ontologyNamespace);
  const owlType = OWL_TYPE[entityType];
  const escapedLabel = escapeTurtleString(label);

  // Predicate list (joined with ";", terminated with ".")
  const predicates: string[] = [`rdfs:label "${escapedLabel}"@en`];

  if (parentIri) {
    const predicate = PARENT_PREDICATE[entityType];
    const parentRef = toPrefixedOrFull(parentIri, ontologyPrefix, ontologyNamespace);
    predicates.push(`${predicate} ${parentRef}`);
  }

  if (provenance) {
    predicates.push(provenanceBlock(provenance));
  }

  const lines: string[] = [];

  if (provenance && provenance.declarePrefix !== false) {
    lines.push(PROV_PREFIX_DIRECTIVE);
  }

  lines.push(`${subject} a ${owlType} ;`);
  predicates.forEach((p, i) => {
    const terminator = i === predicates.length - 1 ? " ." : " ;";
    lines.push(`    ${p}${terminator}`);
  });

  // Leading blank line for separation, trailing newline
  return "\n" + lines.join("\n") + "\n";
}
