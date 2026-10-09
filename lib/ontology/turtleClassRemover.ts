/**
 * Turtle source manipulation utility for class deletion.
 *
 * The API serves no project-scoped class DELETE route, so deletion is a pure
 * text transform whose result is committed through the source save endpoint,
 * exactly as form edits are.
 *
 * Only the class's own statements are removed: every statement whose subject
 * is the class, and every reified `owl:Axiom` whose `owl:annotatedSource` is
 * the class. References to the class from other entities are left untouched;
 * the delete dialog makes the editor acknowledge them first.
 */

import {
  assertSafeTurtleIri,
  escapeRegex,
  iriTurtleForms,
  parseDeclarations,
  scanToBlockEnd,
} from "@/lib/ontology/turtleUtils";

const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const OWL_AXIOM_IRI = "http://www.w3.org/2002/07/owl#Axiom";
const OWL_ANNOTATED_SOURCE_IRI = "http://www.w3.org/2002/07/owl#annotatedSource";

// Characters that may follow a complete term inside a statement.
const TERM_END = "(?=[\\s;,.\\]]|$)";

function alternation(forms: string[]): string {
  return forms.map(escapeRegex).join("|");
}

function startsWithTerm(trimmed: string, forms: string[]): boolean {
  return forms.some((form) => {
    if (!trimmed.startsWith(form)) return false;
    const after = trimmed[form.length];
    return !after || /\s/.test(after);
  });
}

/**
 * Remove a class's own statements from Turtle source.
 *
 * Matches the class as a full IRI, any prefixed name (including `:local`) and
 * a `@base`-relative IRI. Every statement that is not removed keeps its bytes,
 * and one blank separator line is dropped with each removed statement so the
 * surrounding layout stays intact. An absent class returns `source` unchanged.
 *
 * @throws Error if `classIri` contains characters that are unsafe in Turtle
 */
export function removeClassFromTurtle(source: string, classIri: string): string {
  assertSafeTurtleIri(classIri);

  const { prefixes, base } = parseDeclarations(source);
  const classForms = iriTurtleForms(classIri, prefixes, base);
  const typeForms = ["a", ...iriTurtleForms(RDF_TYPE_IRI, prefixes, base)];
  const axiomForms = iriTurtleForms(OWL_AXIOM_IRI, prefixes, base);
  const annotatedSourceForms = iriTurtleForms(OWL_ANNOTATED_SOURCE_IRI, prefixes, base);

  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- forms are quoted by escapeRegex before interpolation
  const isAxiom = new RegExp(
    `(?:^|[\\s;\\[])(?:${alternation(typeForms)})\\s+(?:${alternation(axiomForms)})${TERM_END}`,
  );
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- forms are quoted by escapeRegex before interpolation
  const annotatesClass = new RegExp(
    `(?:^|[\\s;\\[])(?:${alternation(annotatedSourceForms)})\\s+(?:${alternation(classForms)})${TERM_END}`,
  );

  const lines = source.split("\n");
  const statements: Array<{ start: number; end: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("@") ||
      /^(PREFIX|BASE)\s/i.test(trimmed)
    ) {
      continue;
    }

    const end = scanToBlockEnd(lines, i);
    if (startsWithTerm(trimmed, classForms)) {
      statements.push({ start: i, end });
    } else if (trimmed.startsWith("[") || trimmed.startsWith("_:")) {
      const block = lines.slice(i, end + 1).join("\n");
      if (isAxiom.test(block) && annotatesClass.test(block)) {
        statements.push({ start: i, end });
      }
    }
    // Skip the whole statement so objects never read as subjects.
    i = end;
  }

  if (statements.length === 0) return source;

  const remove = new Set<number>();
  // The empty element after a final newline is the file's terminator, not a
  // separator line, so it is never removed.
  const lastSeparator = source.endsWith("\n") ? lines.length - 2 : lines.length - 1;
  const isBlank = (index: number) =>
    index >= 0 && index <= lastSeparator && lines[index].trim() === "";
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- classIri is quoted by escapeRegex before interpolation
  const headerComment = new RegExp(
    `^#+\\s*<?${escapeRegex(classIri)}>?\\s*$`,
  );

  for (const { start, end } of statements) {
    let first = start;
    // OWL API serializers head each entity with a comment naming its IRI.
    if (first > 0 && headerComment.test(lines[first - 1].trim())) first--;
    for (let line = first; line <= end; line++) remove.add(line);

    if (isBlank(end + 1) && !remove.has(end + 1)) {
      remove.add(end + 1);
    } else if (isBlank(first - 1) && !remove.has(first - 1)) {
      remove.add(first - 1);
    }
  }

  return lines.filter((_, index) => !remove.has(index)).join("\n");
}
