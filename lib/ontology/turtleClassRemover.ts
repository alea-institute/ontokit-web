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
 *
 * Removal is exact: a statement that shares a line with another statement
 * loses only its own characters, so neighbouring data is never erased.
 */

import {
  assertSafeTurtleIri,
  escapeRegex,
  iriTurtleForms,
  isSubjectOfStatement,
  iterateStatements,
  parseDeclarations,
  OWL_ANNOTATED_SOURCE_IRI,
  OWL_AXIOM_IRI,
  RDF_TYPE_IRI,
  type TurtleStatement,
} from "@/lib/ontology/turtleUtils";

// Characters that may follow a complete term inside a statement.
const TERM_END = "(?=[\\s;,.\\]]|$)";

function alternation(forms: string[]): string {
  return forms.map(escapeRegex).join("|");
}

/**
 * Remove a class's own statements from Turtle source.
 *
 * Matches the class as a full IRI, any prefixed name (including `:local`) and
 * a `@base`-relative IRI. Every statement that is not removed keeps its bytes.
 * A statement that owns its lines is removed line-wise, together with the
 * serializer header comment naming the class and one blank separator line,
 * so the surrounding layout stays intact. A statement that shares a line
 * with another statement is removed as its exact character span, keeping
 * the rest of the line. An absent class returns `source` unchanged.
 *
 * @throws Error if `classIri` contains characters that are unsafe in Turtle
 * @throws Error if one of the class's statements is not terminated by `.`,
 *   so its exact extent cannot be determined; the caller keeps the source
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

  const statements: TurtleStatement[] = [];
  for (const statement of iterateStatements(source)) {
    const { text } = statement;
    const owned =
      isSubjectOfStatement(text, classForms) ||
      ((text.startsWith("[") || text.startsWith("_:")) &&
        isAxiom.test(text) &&
        annotatesClass.test(text));
    if (!owned) continue;
    if (!statement.terminated) {
      throw new Error(
        `Cannot delete "${classIri}": one of its statements is not terminated by ".", ` +
          "so it cannot be removed without risking other data. The source was not changed.",
      );
    }
    statements.push(statement);
  }

  if (statements.length === 0) return source;

  const lines = source.split("\n");
  const lineStarts: number[] = [];
  for (let index = 0, offset = 0; index < lines.length; index++) {
    lineStarts.push(offset);
    offset += lines[index].length + 1;
  }

  const removeLines = new Set<number>();
  const deleted = new Uint8Array(source.length);
  const cut = (from: number, to: number) => deleted.fill(1, from, to);
  const touchedLines = new Set<number>();

  // The empty element after a final newline is the file's terminator, not a
  // separator line, so it is never removed.
  const lastSeparator = source.endsWith("\n") ? lines.length - 2 : lines.length - 1;
  const isBlank = (index: number) =>
    index >= 0 && index <= lastSeparator && lines[index].trim() === "";
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- classIri is quoted by escapeRegex before interpolation
  const headerComment = new RegExp(
    `^#+\\s*<?${escapeRegex(classIri)}>?\\s*$`,
  );
  const isHorizontalSpace = (offset: number) => source[offset] === " " || source[offset] === "\t";

  for (const statement of statements) {
    const { startLine, endLine } = statement;

    if (!statement.startsLine || !statement.endsLine) {
      // Shares a line with another statement: remove exactly its span plus
      // the spacing that separated it from its neighbour.
      let from = statement.startsLine ? lineStarts[startLine] : statement.start;
      let to = statement.end + 1;
      if (statement.startsLine) {
        while (to < source.length && isHorizontalSpace(to)) to++;
      } else {
        while (from > 0 && isHorizontalSpace(from - 1)) from--;
      }
      cut(from, to);
      for (let line = startLine; line <= endLine; line++) touchedLines.add(line);
      continue;
    }

    let first = startLine;
    // OWL API serializers head each entity with a comment naming its IRI.
    if (first > 0 && headerComment.test(lines[first - 1].trim())) first--;
    for (let line = first; line <= endLine; line++) removeLines.add(line);

    if (isBlank(endLine + 1) && !removeLines.has(endLine + 1)) {
      removeLines.add(endLine + 1);
    } else if (isBlank(first - 1) && !removeLines.has(first - 1)) {
      removeLines.add(first - 1);
    }
  }

  // A line whose every statement was cut is removed whole, not left blank,
  // and takes one blank separator line with it like a line-wise removal.
  const consumed = [...touchedLines]
    .filter((line) => {
      const start = lineStarts[line];
      const text = lines[line];
      for (let k = 0; k < text.length; k++) {
        if (!deleted[start + k] && !/\s/.test(text[k])) return false;
      }
      return true;
    })
    .sort((a, b) => a - b);
  consumed.forEach((line, index) => {
    removeLines.add(line);
    if (consumed[index + 1] === line + 1) return;
    let first = line;
    while (first > 0 && consumed.includes(first - 1)) first--;
    // A run that continues into a surviving part of a cut statement's line
    // is not a whole statement, so the layout around it stays.
    if (touchedLines.has(line + 1) || touchedLines.has(first - 1)) return;
    if (isBlank(line + 1) && !removeLines.has(line + 1)) {
      removeLines.add(line + 1);
    } else if (isBlank(first - 1) && !removeLines.has(first - 1)) {
      removeLines.add(first - 1);
    }
  });

  // Delete whole lines exactly as `lines.filter(...).join("\n")` would: each
  // run of removed lines takes its trailing newline, or the preceding one
  // when the run ends the source.
  const sorted = [...removeLines].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length; ) {
    const runStart = sorted[index];
    let runEnd = runStart;
    while (index + 1 < sorted.length && sorted[index + 1] === runEnd + 1) runEnd = sorted[++index];
    index++;
    if (runEnd < lines.length - 1) {
      cut(lineStarts[runStart], lineStarts[runEnd + 1]);
    } else {
      cut(Math.max(0, lineStarts[runStart] - 1), source.length);
    }
  }

  let result = "";
  for (let offset = 0; offset < source.length; offset++) {
    if (!deleted[offset]) result += source[offset];
  }
  return result;
}
