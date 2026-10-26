import {
  iriTurtleForms,
  isSubjectOfStatement,
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

const unsupported = (): EntitySourceResult => ({
  status: "unavailable",
  reason: "This source uses syntax the preview cannot safely attribute. Open full source to inspect it.",
});

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
 * Exact, read-only excerpts of direct subject statements. This is not an RDF
 * parser: unsupported declarations/subject spellings fail closed so an omitted
 * statement cannot make an incomplete excerpt look like a complete definition.
 */
export function extractEntitySource(source: string, iri: string): EntitySourceResult {
  const prefixes: PrefixMap = {};
  let base: string | undefined;
  let previousEnd = 0;
  const excerpts: EntitySourceExcerpt[] = [];

  // The shared scanner skips standalone directives line-wise. Read declarations
  // only in its gaps, never by searching inside comments or literal bodies.
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
    if (!readDeclarations(source.slice(previousEnd, statement.start))) return unsupported();
    previousEnd = statement.end + 1;
    if (!statement.terminated) {
      return { status: "unavailable", reason: "Source is incomplete. Open full source to inspect it." };
    }

    // Anonymous subjects cannot be the selected named entity. Keep their inline
    // structures inside a matching statement, but never expand linked nodes.
    if (/^(?:\[|\(|_:)/.test(statement.text)) continue;

    const subject = statement.text.match(/^(<[^>]*>|[^\s]+)\s/)?.[1];
    if (!subject) return unsupported();
    if (subject.startsWith("<")) {
      const resolved = resolveIri(subject.slice(1, -1), base);
      if (resolved === undefined) return unsupported();
      if (resolved !== iri) continue;
    } else {
      const colon = subject.indexOf(":");
      const namespace = prefixes[subject.slice(0, colon)];
      if (colon < 0 || namespace === undefined) return unsupported();
      const resolved = namespace + subject.slice(colon + 1);
      const forms = iriTurtleForms(resolved, prefixes);
      if (!forms.includes(subject)) return unsupported();
      if (!isSubjectOfStatement(statement.text, iriTurtleForms(iri, prefixes))) continue;
    }

    excerpts.push({ text: statement.text, startLine: statement.startLine + 1 });
  }

  if (!readDeclarations(source.slice(previousEnd))) return unsupported();
  return excerpts.length
    ? { status: "available", excerpts }
    : { status: "unavailable", reason: "No directly stated subject statements were found in this file." };
}
