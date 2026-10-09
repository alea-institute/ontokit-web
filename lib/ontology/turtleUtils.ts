/**
 * Shared Turtle source manipulation utilities.
 *
 * Used by turtleClassUpdater, turtlePropertyUpdater, turtleIndividualUpdater,
 * and turtleBlockParser to parse and generate Turtle source text.
 */

// ── Vocabulary IRIs shared by the updaters and the remover ─────────────

export const RDF_TYPE_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export const OWL_CLASS_IRI = "http://www.w3.org/2002/07/owl#Class";
export const OWL_NAMED_INDIVIDUAL_IRI = "http://www.w3.org/2002/07/owl#NamedIndividual";
export const OWL_DEPRECATED_IRI = "http://www.w3.org/2002/07/owl#deprecated";
export const OWL_SAME_AS_IRI = "http://www.w3.org/2002/07/owl#sameAs";
export const OWL_DIFFERENT_FROM_IRI = "http://www.w3.org/2002/07/owl#differentFrom";
export const OWL_AXIOM_IRI = "http://www.w3.org/2002/07/owl#Axiom";
export const OWL_ANNOTATED_SOURCE_IRI = "http://www.w3.org/2002/07/owl#annotatedSource";
export const OWL_ANNOTATED_PROPERTY_IRI = "http://www.w3.org/2002/07/owl#annotatedProperty";
export const OWL_ANNOTATED_TARGET_IRI = "http://www.w3.org/2002/07/owl#annotatedTarget";

// ── Types ─────────────────────────────────────────────────────────────

export interface PrefixMap {
  [alias: string]: string;
}

export interface ParsedDeclarations {
  prefixes: PrefixMap;
  base?: string;
}

export interface BlockRange {
  startLine: number;
  endLine: number;
}

export interface ExistingTurtleBlock {
  subject: string;
  predicateObjects: Array<{ predicate: string; text: string }>;
}

export function parseExistingTurtleBlock(block: string): ExistingTurtleBlock {
  const subjectMatch = block.match(/^\s*(<[^>]+>|[^\s:<>]*:[^\s]+)/u);
  if (!subjectMatch) {
    throw new Error("Could not parse the subject from its Turtle block");
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

// ── Prefix / base helpers ─────────────────────────────────────────────

export function parseDeclarations(source: string): ParsedDeclarations {
  const prefixes: PrefixMap = {};
  let base: string | undefined;

  for (const line of source.split("\n")) {
    // @prefix ex: <ns> .  OR  PREFIX ex: <ns>
    const pm = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
    if (pm) prefixes[pm[1]] = pm[2];

    // @base <ns> .  OR  BASE <ns>
    const bm = line.match(/@?base\s+<([^>]+)>/i);
    if (bm) base = bm[1];
  }

  return { prefixes, base };
}

export function reverseMap(prefixes: PrefixMap): Map<string, string> {
  const rev = new Map<string, string>();
  for (const [alias, ns] of Object.entries(prefixes)) {
    const existing = rev.get(ns);
    if (!existing || alias.length < existing.length) {
      rev.set(ns, alias);
    }
  }
  return rev;
}

/** Reject characters that can escape or corrupt a Turtle IRI reference. */
export function assertSafeTurtleIri(iri: string): void {
  if (!iri || /[\u0000-\u0020<>"{}|^`\\]/u.test(iri)) {
    throw new Error("Invalid IRI: unsafe characters are not allowed");
  }
}

/** Convert a full IRI to shortest Turtle form using available prefixes */
export function toTurtle(iri: string, rev: Map<string, string>): string {
  assertSafeTurtleIri(iri);
  for (const [ns, alias] of rev) {
    if (iri.startsWith(ns)) {
      const local = iri.slice(ns.length);
      if (local && /^[A-Za-z_][\w-]*$/.test(local)) {
        return alias === "" ? `:${local}` : `${alias}:${local}`;
      }
    }
  }
  return `<${iri}>`;
}

// Turtle PN_CHARS_BASE / PN_CHARS, used for existing unescaped local names.
// Escaped spellings are not synthesized from an IRI here.
const PN_CHARS_BASE = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}";
const PN_CHARS = `${PN_CHARS_BASE}_0-9\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040`;
const UNESCAPED_LOCAL_NAME = new RegExp(`^[${PN_CHARS_BASE}_:0-9](?:[${PN_CHARS}.:]*[${PN_CHARS}:])?$`, "u");

/**
 * Get all possible Turtle representations of an IRI.
 *
 * Covers:
 * - Full IRI:     <https://example.org/Foo>
 * - Prefixed:     ex:Foo  or  :Foo
 * - Relative IRI: <Foo>       (when @base matches)
 */
export function iriTurtleForms(
  iri: string,
  prefixes: PrefixMap,
  base?: string,
): string[] {
  const forms = [`<${iri}>`];

  // Prefixed forms
  for (const [alias, ns] of Object.entries(prefixes)) {
    if (iri.startsWith(ns)) {
      const local = iri.slice(ns.length);
      if (local && UNESCAPED_LOCAL_NAME.test(local)) {
        forms.push(alias === "" ? `:${local}` : `${alias}:${local}`);
      }
    }
  }

  // Relative IRI form (from @base)
  if (base && iri.startsWith(base)) {
    const relative = iri.slice(base.length);
    if (relative) {
      forms.push(`<${relative}>`);
    }
  }

  return forms;
}

// ── Block finder ──────────────────────────────────────────────────────

/**
 * Scan from line `start` forward to find the terminating '.' at bracket
 * depth 0, respecting string literals and comments. Returns the end line.
 */
export function scanToBlockEnd(lines: string[], start: number): number {
  let depth = 0;
  let inStr = false;
  let longStr = false;
  let strCh = "";
  let inIri = false;

  for (let j = start; j < lines.length; j++) {
    const line = lines[j];

    for (let k = 0; k < line.length; k++) {
      const c = line[k];

      if (longStr) {
        if (line.slice(k, k + 3) === strCh.repeat(3)) {
          longStr = false;
          k += 2;
        }
        continue;
      }

      if (inStr) {
        if (c === "\\") {
          k++;
          continue;
        }
        if (c === strCh) inStr = false;
        continue;
      }

      if (inIri) {
        if (c === ">") inIri = false;
        continue;
      }
      if (c === "<") {
        inIri = true;
        continue;
      }

      if (c === "#") break;

      if (
        line.slice(k, k + 3) === '"""' ||
        line.slice(k, k + 3) === "'''"
      ) {
        strCh = c;
        longStr = true;
        k += 2;
        continue;
      }

      if (c === '"' || c === "'") {
        strCh = c;
        inStr = true;
        continue;
      }

      if (c === "[" || c === "(") depth++;
      if (c === "]" || c === ")") depth--;

      if (c === "." && depth === 0) {
        const next = k + 1 < line.length ? line[k + 1] : "";
        if (!next || /[\s#]/.test(next)) {
          return j;
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Index of the `.` that terminates the statement starting at character
 * `from`, at bracket depth 0 and outside strings, IRIs and comments, or -1
 * when the statement is unterminated. Character-precise counterpart of
 * {@link scanToBlockEnd}.
 */
export function scanStatementEnd(source: string, from: number): number {
  let depth = 0;
  let quote = "";
  let longString = false;
  let inIri = false;

  for (let k = from; k < source.length; k++) {
    const c = source[k];

    if (quote) {
      if (c === "\\") {
        k++;
      } else if (longString) {
        if (source.startsWith(quote.repeat(3), k)) {
          quote = "";
          longString = false;
          k += 2;
        }
      } else if (c === quote) {
        quote = "";
      }
      continue;
    }

    if (inIri) {
      if (c === ">") inIri = false;
      continue;
    }
    if (c === "<") {
      inIri = true;
      continue;
    }

    if (c === "#") {
      const newline = source.indexOf("\n", k);
      if (newline < 0) return -1;
      k = newline;
      continue;
    }

    if (source.startsWith('"""', k) || source.startsWith("'''", k)) {
      quote = c;
      longString = true;
      k += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }

    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === "." && depth === 0) {
      const next = source[k + 1];
      if (next === undefined || /[\s#]/.test(next)) return k;
    }
  }

  return -1;
}

/** One top-level Turtle statement (directives and comments excluded). */
export interface TurtleStatement {
  /** Offset of the statement's first character (its subject). */
  start: number;
  /** Offset of its terminating `.`, or the last character if unterminated. */
  end: number;
  /** `source.slice(start, end + 1)`. */
  text: string;
  startLine: number;
  endLine: number;
  terminated: boolean;
  /** Only whitespace precedes the statement on its first line. */
  startsLine: boolean;
  /** Only whitespace or a comment follows the statement on its last line. */
  endsLine: boolean;
}

/**
 * Iterate the top-level statements of Turtle source in order.
 *
 * `@prefix`/`@base` and SPARQL `PREFIX`/`BASE` directives and comments are
 * skipped line-wise, as the line-oriented scanners always did. Statements
 * are found at character precision, so a statement that begins after
 * another one on the same line is reported too (with `startsLine: false`).
 */
export function* iterateStatements(source: string): Generator<TurtleStatement> {
  let line = 0;
  let counted = 0;
  const lineAt = (offset: number) => {
    for (; counted < offset; counted++) if (source[counted] === "\n") line++;
    return line;
  };
  const skipLine = (offset: number) => {
    const newline = source.indexOf("\n", offset);
    return newline < 0 ? source.length : newline + 1;
  };

  let pos = 0;
  while (pos < source.length) {
    const c = source[pos];
    if (/\s/.test(c)) {
      pos++;
      continue;
    }

    const lineStart = source.lastIndexOf("\n", pos - 1) + 1;
    const startsLine = source.slice(lineStart, pos).trim() === "";
    if (
      c === "#" ||
      (startsLine && (c === "@" || /^(PREFIX|BASE)\s/i.test(source.slice(pos, pos + 7))))
    ) {
      pos = skipLine(pos);
      continue;
    }

    const terminator = scanStatementEnd(source, pos);
    const terminated = terminator >= 0;
    const end = terminated ? terminator : source.length - 1;
    const startLine = lineAt(pos);
    const endLine = lineAt(end);
    const restOfLine = source.slice(end + 1, skipLine(end + 1)).trim();
    yield {
      start: pos,
      end,
      text: source.slice(pos, end + 1),
      startLine,
      endLine,
      terminated,
      startsLine,
      endsLine: restOfLine === "" || restOfLine.startsWith("#"),
    };
    pos = end + 1;
  }
}

/**
 * Whether a statement (or trimmed line) has one of `forms` as its subject:
 * the form must be the first token, followed by whitespace or the end.
 */
export function isSubjectOfStatement(trimmed: string, forms: string[]): boolean {
  return forms.some((form) => {
    if (!trimmed.startsWith(form)) return false;
    const after = trimmed[form.length];
    return !after || /\s/.test(after);
  });
}

/**
 * Split an object list at depth-0 commas, respecting strings (with
 * escapes), long strings, IRIs, comments and nested `[...]` / `(...)`.
 * Returns the trimmed, non-empty items.
 */
export function splitObjectList(objects: string): string[] {
  const items: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let longString = false;
  let inIri = false;

  for (let k = 0; k < objects.length; k++) {
    const c = objects[k];
    if (quote) {
      if (c === "\\") {
        k++;
      } else if (longString) {
        if (objects.startsWith(quote.repeat(3), k)) {
          quote = "";
          longString = false;
          k += 2;
        }
      } else if (c === quote) {
        quote = "";
      }
      continue;
    }
    if (inIri) {
      if (c === ">") inIri = false;
      continue;
    }
    if (c === "<") {
      inIri = true;
      continue;
    }
    if (c === "#") {
      const newline = objects.indexOf("\n", k);
      k = newline < 0 ? objects.length : newline;
      continue;
    }
    if (objects.startsWith('"""', k) || objects.startsWith("'''", k)) {
      quote = c;
      longString = true;
      k += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      const item = objects.slice(start, k).trim();
      if (item) items.push(item);
      start = k + 1;
    }
  }
  const last = objects.slice(start).trim();
  if (last) items.push(last);
  return items;
}

/**
 * Whether an object term is a blank node (`[ ... ]`) or collection
 * (`( ... )`), which a form payload cannot express.
 */
export function isStructuralObjectText(term: string): boolean {
  const trimmed = term.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("(");
}

/**
 * The text an existing predicate-object entry contributes to the
 * regenerated block, or null when the payload fully replaces it.
 *
 * An undescribed predicate is carried verbatim. For a described predicate
 * the payload supplies the IRI and literal objects, but blank-node and
 * collection objects cannot be expressed in it, so those items of the
 * object list are carried as `<predicate> <items>` beside the payload's
 * values. An entry made only of such items is carried verbatim.
 */
export function carriedPredicateObjectText(
  entry: { predicate: string; text: string },
  described: Set<string>,
): string | null {
  if (!described.has(entry.predicate)) return entry.text;
  if (entry.predicate === "a") return null;
  const items = splitObjectList(entry.text.slice(entry.predicate.length));
  const structural = items.filter(isStructuralObjectText);
  if (structural.length === 0) return null;
  if (structural.length === items.length) return entry.text;
  return `${entry.predicate} ${structural.join(", ")}`;
}

/**
 * Find the subject block for an entity IRI in Turtle source.
 *
 * Only consider the first token of each statement. Matching an object or a
 * local name without its namespace could replace an unrelated entity. A
 * statement that begins mid-line is never returned, because callers replace
 * whole lines.
 */
export function findBlock(
  lines: string[],
  iri: string,
  prefixes: PrefixMap,
  base?: string,
): BlockRange | null {
  const forms = iriTurtleForms(iri, prefixes, base);

  for (const statement of iterateStatements(lines.join("\n"))) {
    if (statement.startsLine && isSubjectOfStatement(statement.text, forms)) {
      return { startLine: statement.startLine, endLine: statement.endLine };
    }
  }
  return null;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Serialization helpers ─────────────────────────────────────────────

export function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function literal(value: string, lang: string): string {
  // Deliberately conservative BCP 47 subset, matching the project settings
  // validator: primary language plus optional 1-8 character subtags.
  if (lang && !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(lang)) {
    throw new TypeError("Invalid BCP 47 language tag");
  }
  const escaped = esc(value);
  return lang ? `"${escaped}"@${lang}` : `"${escaped}"`;
}

export function isIriValue(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("urn:")
  );
}

// ── Axiom provenance pruning ──────────────────────────────────────────

export interface RetainedLiteralTarget {
  /** Turtle spellings of the property that still holds the literal. */
  propertyForms: string[];
  /** The literal as the regenerated block writes it. */
  target: string;
}

function alternationOf(forms: string[]): string {
  return forms.map(escapeRegex).join("|");
}

/**
 * Drop `owl:Axiom` provenance blocks for literals a form save deleted.
 *
 * An axiom is removed only when all of these hold: its `owl:annotatedSource`
 * is `subjectIri`; its `owl:annotatedProperty` is a predicate the payload
 * describes (`described`, Turtle spellings); its `owl:annotatedTarget` is a
 * literal; and that literal is not among `retained`. An axiom about a
 * carried predicate, or with an IRI-valued target, describes a triple the
 * save did not touch and is kept. Every term matches in any spelling (full
 * IRI, prefixed name, `@base`-relative IRI). Axioms that share a line with
 * other content are kept rather than risk erasing that content.
 */
export function pruneDeletedLiteralAxioms(
  lines: string[],
  subjectIri: string,
  described: Set<string>,
  retained: RetainedLiteralTarget[],
  declarations: ParsedDeclarations,
): string {
  const { prefixes, base } = declarations;
  const forms = (iri: string) => iriTurtleForms(iri, prefixes, base);
  const sourceForms = forms(subjectIri);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- forms are quoted by escapeRegex before interpolation
  const isAxiom = new RegExp(
    `(?:^|[\\s;\\[])(?:${alternationOf(["a", ...forms(RDF_TYPE_IRI)])})\\s+(?:${alternationOf(forms(OWL_AXIOM_IRI))})(?=[\\s;,.\\]]|$)`,
    "u",
  );
  const keyPattern = (iri: string) => `(?:^|[\\s;\\[])(?:${alternationOf(forms(iri))})\\s+`;
  const sourceKey = keyPattern(OWL_ANNOTATED_SOURCE_IRI);
  const propertyKey = keyPattern(OWL_ANNOTATED_PROPERTY_IRI);
  const targetKey = keyPattern(OWL_ANNOTATED_TARGET_IRI);
  const has = (block: string, key: string, value: string) =>
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- key is built from escaped forms and value is quoted by escapeRegex
    new RegExp(`${key}${escapeRegex(value)}(?=\\s*[;,.\\]])`, "u").test(block);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- key is built from escaped forms
  const literalTarget = new RegExp(`${targetKey}["']`, "u");

  // Elements of `lines` may themselves hold several lines (a regenerated
  // block), so work on the real lines of the joined source.
  const source = lines.join("\n");
  const sourceLines = source.split("\n");
  const remove = new Set<number>();
  for (const statement of iterateStatements(source)) {
    if (!statement.startsLine || !statement.endsLine) continue;
    const block = statement.text;
    if (!isAxiom.test(block)) continue;
    if (!sourceForms.some((form) => has(block, sourceKey, form))) continue;

    const propertyForm = [...described].find(
      (form) => form !== "a" && has(block, propertyKey, form),
    );
    if (!propertyForm) continue;
    if (!literalTarget.test(block)) continue;

    const stillExists = retained.some(
      ({ propertyForms, target }) =>
        propertyForms.includes(propertyForm) && has(block, targetKey, target),
    );
    if (stillExists) continue;

    for (let line = statement.startLine; line <= statement.endLine; line++) remove.add(line);
    const next = statement.endLine + 1;
    if (next < sourceLines.length && sourceLines[next].trim() === "") remove.add(next);
  }

  return sourceLines.filter((_, index) => !remove.has(index)).join("\n");
}
