/**
 * Shared Turtle source manipulation utilities.
 *
 * Used by turtleClassUpdater, turtlePropertyUpdater, turtleIndividualUpdater,
 * and turtleBlockParser to parse and generate Turtle source text.
 */

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
  const subjectMatch = block.match(/^\s*(<[^>]+>|(?:[A-Za-z_][\w-]*)?:[\w-]+)/u);
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
      if (local && /^[A-Za-z_][\w-]*$/.test(local)) {
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
        if (!next || /\s/.test(next)) {
          return j;
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Find the subject block for an entity IRI in Turtle source.
 *
 * Strategy:
 * 1. Try all known Turtle forms (full IRI, prefixed, relative via @base)
 * 2. Fallback: search for the raw IRI string on any subject-position line
 */
export function findBlock(
  lines: string[],
  iri: string,
  prefixes: PrefixMap,
  base?: string,
): BlockRange | null {
  const forms = iriTurtleForms(iri, prefixes, base);

  // Primary: match one of the known Turtle forms at the start of a line
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

    const isSubject = forms.some((f) => {
      if (!trimmed.startsWith(f)) return false;
      const after = trimmed[f.length];
      return !after || after === " " || after === "\t";
    });

    if (isSubject) {
      // Verify it's actually a subject position (not an object on a continuation line)
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const isContinuation =
        prevLine.endsWith(";") || prevLine.endsWith(",");

      if (!isContinuation) {
        return { startLine: i, endLine: scanToBlockEnd(lines, i) };
      }
    }
  }

  // Fallback: search for the full IRI string inside angle brackets anywhere
  // as the first token on a non-continuation line
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

    // Check if this line contains the full IRI as a subject
    if (trimmed.includes(iri)) {
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const isContinuation =
        prevLine.endsWith(";") || prevLine.endsWith(",");

      if (!isContinuation) {
        return { startLine: i, endLine: scanToBlockEnd(lines, i) };
      }
    }
  }

  // Last resort: extract the local name and search for it as a prefixed subject
  const localName = iri.includes("#")
    ? iri.split("#").pop()
    : iri.split("/").pop();

  if (localName) {
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

      // Match patterns like  :LocalName  or  prefix:LocalName  at line start
      const localNamePattern = new RegExp( // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp  Reason: localName is passed through escapeRegex() (defined below in this file), so the pattern cannot contain unescaped metacharacters.
        `^(\\w*:)?${escapeRegex(localName)}(\\s|$)`,
      );
      if (localNamePattern.test(trimmed)) {
        // Verify it's not a continuation line
        const prevLine = i > 0 ? lines[i - 1].trim() : "";
        const isContinuation =
          prevLine.endsWith(";") || prevLine.endsWith(",");

        if (!isContinuation) {
          return { startLine: i, endLine: scanToBlockEnd(lines, i) };
        }
      }
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
