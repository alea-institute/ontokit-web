/**
 * Turtle source manipulation utility for class updates.
 *
 * Instead of calling a non-existent REST endpoint, this utility modifies the
 * Turtle source text directly so it can be saved via the source save endpoint.
 */

import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";

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

interface PrefixMap {
  [alias: string]: string;
}

interface ParsedDeclarations {
  prefixes: PrefixMap;
  base?: string;
}

interface BlockRange {
  startLine: number;
  endLine: number;
}

// ── Prefix / base helpers ─────────────────────────────────────────────

function parseDeclarations(source: string): ParsedDeclarations {
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

function reverseMap(prefixes: PrefixMap): Map<string, string> {
  const rev = new Map<string, string>();
  for (const [alias, ns] of Object.entries(prefixes)) {
    const existing = rev.get(ns);
    if (!existing || alias.length < existing.length) {
      rev.set(ns, alias);
    }
  }
  return rev;
}

/** Convert a full IRI to shortest Turtle form using available prefixes */
function toTurtle(iri: string, rev: Map<string, string>): string {
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
function iriTurtleForms(
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
function scanToBlockEnd(lines: string[], start: number): number {
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
 * Find the subject block for a class IRI in Turtle source.
 *
 * Strategy:
 * 1. Try all known Turtle forms (full IRI, prefixed, relative via @base)
 * 2. Fallback: search for the raw IRI string on any subject-position line
 */
function findBlock(
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
  const fullIriAngle = `<${iri}>`;
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
      // Verify it's at subject position (start of statement, not a predicate/object)
      // A line is a subject position if it's not a continuation (doesn't start with
      // a predicate-like token after a previous ';' or ',')
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
      const localNamePattern = new RegExp(
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Block generator ───────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function literal(value: string, lang: string): string {
  const escaped = esc(value);
  return lang ? `"${escaped}"@${lang}` : `"${escaped}"`;
}

function isIriValue(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("urn:")
  );
}

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
