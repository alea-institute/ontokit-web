import {
  iriTurtleForms,
  iterateStatements,
  type PrefixMap,
} from "./turtleUtils";

export interface EntitySourceExcerpt {
  text: string;
  /** One-based line in the original file. */
  startLine: number;
}

export type EntitySourceResult =
  | { status: "available"; excerpts: EntitySourceExcerpt[] }
  | { status: "unavailable"; reason: string };

interface StatementRange {
  start: number;
  end: number;
  startLine: number;
}

export interface EntitySourceIndex {
  source: string;
  statements: ReadonlyMap<string, readonly StatementRange[]>;
  unavailableReason?: string;
}

const unsupportedReason = "This source uses syntax the preview cannot safely attribute. Open full source to inspect it.";
const chunkSize = 64 * 1024;

/** Reject lexical forms whose boundaries the shared writer iterator cannot establish. */
function* validatePreviewSyntax(source: string): Generator<void, boolean> {
  let quote = "";
  let longString = false;
  let inIri = false;
  let inComment = false;
  let bareToken = false;
  let tokenStart = 0;
  let depth = 0;
  let nextYield = chunkSize;

  for (let offset = 0; offset < source.length; offset++) {
    if (offset >= nextYield) {
      yield;
      nextYield = offset + chunkSize;
    }
    const char = source[offset];
    if (inComment) {
      if (char === "\n") inComment = false;
      continue;
    }
    if (quote) {
      if (char === "\\") offset++;
      else if (longString ? source.startsWith(quote.repeat(3), offset) : char === quote) {
        if (longString) offset += 2;
        quote = "";
      }
      continue;
    }
    if (inIri) {
      if (char === ">") inIri = false;
      continue;
    }
    // Escaped prefixed-name punctuation can hide comments or terminators from
    // iterateStatements. Support it only in the full editor, never by guessing.
    if (char === "\\") return false;
    if (char === "#") { inComment = true; bareToken = false; }
    else if (char === "<") { inIri = true; bareToken = false; }
    else if (char === '"' || char === "'") {
      quote = char;
      longString = source.startsWith(char.repeat(3), offset);
      if (longString) offset += 2;
      bareToken = false;
    } else if (char === "[" || char === "(") { depth++; bareToken = false; }
    else if (char === "]" || char === ")") { depth--; bareToken = false; }
    else if (/\s|[;,]/u.test(char)) bareToken = false;
    else if (char === "." && depth === 0) {
      const next = source[offset + 1];
      if (next !== undefined && !/[\s#]/u.test(next)) {
        // Dots within numeric/prefixed tokens are supported. A dot after an
        // IRI/string/structure, or immediately before one, is an unsafe boundary.
        if (!bareToken || /[<>"'\[\]()\\]/u.test(next)) return false;
        const token = source.slice(tokenStart, offset);
        if (!token.includes(":")) {
          // Numeric dots must continue a decimal/double. A completed number or
          // boolean followed by `.ex:Next` is a second statement, not one token.
          if (!/^[+-]?\d+$/u.test(token)
            || (!/\d/u.test(next) && !/^[eE][+-]?\d/u.test(source.slice(offset + 1, offset + 5)))) return false;
        }
      } else bareToken = false;
    } else {
      if (!bareToken) tokenStart = offset;
      bareToken = true;
    }
  }
  return true;
}

function resolveIri(value: string, base?: string): string | undefined {
  if (/[\u0000-\u0020<>"{}|^`\\]/u.test(value)) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  if (!base) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

/**
 * One parsing implementation for synchronous extraction and asynchronous indexing.
 * Offsets preserve original text without retaining a copy of every statement.
 */
function* scanEntitySource(source: string): Generator<void, EntitySourceIndex> {
  const unavailable = (reason = unsupportedReason): EntitySourceIndex => ({
    source, statements: new Map(), unavailableReason: reason,
  });
  if (!(yield* validatePreviewSyntax(source))) return unavailable();
  const prefixes: PrefixMap = {};
  let base: string | undefined;
  let previousEnd = 0;
  let nextYield = chunkSize;
  const statements = new Map<string, StatementRange[]>();

  const readDeclarations = (gap: string): boolean => {
    for (const line of gap.split("\n")) {
      if (/^\s*(?:#.*)?$/.test(line)) continue;
      const prefix = line.match(/^\s*(@prefix|PREFIX)\s+([A-Za-z][\w-]*|):\s*<([^>]*)>\s*(\.)?\s*(?:#.*)?$/i);
      const baseDeclaration = line.match(/^\s*(@base|BASE)\s+<([^>]*)>\s*(\.)?\s*(?:#.*)?$/i);
      if (prefix) {
        if (prefix[1].startsWith("@") !== !!prefix[4]) return false;
        const namespace = resolveIri(prefix[3], base);
        if (namespace === undefined) return false;
        prefixes[prefix[2]] = namespace;
      } else if (baseDeclaration) {
        if (baseDeclaration[1].startsWith("@") !== !!baseDeclaration[3]) return false;
        const nextBase = resolveIri(baseDeclaration[2], base);
        if (nextBase === undefined) return false;
        base = nextBase;
      } else {
        return false;
      }
    }
    return true;
  };

  for (const statement of iterateStatements(source)) {
    if (statement.end >= nextYield) {
      yield;
      nextYield = statement.end + chunkSize;
    }
    if (!readDeclarations(source.slice(previousEnd, statement.start))) return unavailable();
    previousEnd = statement.end + 1;
    if (!statement.terminated) {
      return unavailable("Source is incomplete. Open full source to inspect it.");
    }

    if (/^(?:\[|\(|_:)/.test(statement.text)) continue;

    const subject = statement.text.match(/^(<[^>]*>|[^\s]+)\s/)?.[1];
    if (!subject) return unavailable();
    let resolved: string;
    if (subject.startsWith("<")) {
      const fullIri = resolveIri(subject.slice(1, -1), base);
      if (fullIri === undefined) return unavailable();
      resolved = fullIri;
    } else {
      const colon = subject.indexOf(":");
      const namespace = prefixes[subject.slice(0, colon)];
      if (colon < 0 || namespace === undefined) return unavailable();
      resolved = namespace + subject.slice(colon + 1);
      const forms = iriTurtleForms(resolved, prefixes);
      if (!forms.includes(subject)) return unavailable();
    }

    const ranges = statements.get(resolved) ?? [];
    ranges.push({ start: statement.start, end: statement.end + 1, startLine: statement.startLine + 1 });
    statements.set(resolved, ranges);
  }

  if (!readDeclarations(source.slice(previousEnd))) return unavailable();
  return { source, statements };
}

/** Build once per source buffer, yielding between chunks and discarding cancelled work. */
export async function buildEntitySourceIndex(source: string, signal?: AbortSignal): Promise<EntitySourceIndex | null> {
  const scan = scanEntitySource(source);
  // Leave the render/effect turn before doing any source-size work.
  do {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (signal?.aborted) return null;
    const step = scan.next();
    if (step.done) return step.value;
  } while (!signal?.aborted);
  return null;
}

/** Only visits the selected subject's ranges, with no whole-file scan. */
export function lookupEntitySource(index: EntitySourceIndex, iri: string): EntitySourceResult {
  if (index.unavailableReason) return { status: "unavailable", reason: index.unavailableReason };
  const excerpts = index.statements.get(iri)?.map(({ start, end, startLine }) => ({
    text: index.source.slice(start, end), startLine,
  })) ?? [];
  return excerpts.length
    ? { status: "available", excerpts }
    : { status: "unavailable", reason: "No directly stated subject statements were found in this file." };
}

/** Synchronous convenience API; interactive previews should build and reuse an index. */
export function extractEntitySource(source: string, iri: string): EntitySourceResult {
  const scan = scanEntitySource(source);
  let step = scan.next();
  while (!step.done) step = scan.next();
  return lookupEntitySource(step.value, iri);
}
