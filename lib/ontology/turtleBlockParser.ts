/**
 * Turtle block parser — extracts predicate-object pairs from a subject block.
 *
 * Given the full Turtle source and an entity IRI, finds the subject block and
 * parses all predicate-object pairs into structured data.
 */

import {
  parseDeclarations,
  findBlock,
  type PrefixMap,
} from "@/lib/ontology/turtleUtils";

// ── Types ─────────────────────────────────────────────────────────────

export type ParsedObject =
  | { type: "iri"; value: string }
  | { type: "literal"; value: string; lang?: string; datatype?: string }
  | { type: "boolean"; value: boolean };

export interface ParsedTriple {
  predicate: string; // Full IRI
  object: ParsedObject;
}

// ── Well-known IRI mappings ───────────────────────────────────────────

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

// ── Internal helpers ──────────────────────────────────────────────────

/** Resolve a prefixed name or full IRI to a full IRI */
function resolveIri(token: string, prefixes: PrefixMap, base?: string): string {
  // Full IRI: <...>
  if (token.startsWith("<") && token.endsWith(">")) {
    const inner = token.slice(1, -1);
    // Relative IRI
    if (base && !inner.includes("://") && !inner.startsWith("urn:")) {
      return base + inner;
    }
    return inner;
  }

  // Prefixed name: prefix:local or :local
  const colonIdx = token.indexOf(":");
  if (colonIdx >= 0) {
    const prefix = token.slice(0, colonIdx);
    const local = token.slice(colonIdx + 1);
    const ns = prefixes[prefix];
    if (ns !== undefined) {
      return ns + local;
    }
  }

  return token;
}

/** Parse a Turtle literal token into value/lang/datatype */
function parseLiteral(raw: string): ParsedObject {
  // Boolean literals
  if (raw === "true" || raw === "false") {
    return { type: "boolean", value: raw === "true" };
  }

  // Must start with a quote
  if (!raw.startsWith('"') && !raw.startsWith("'")) {
    // Bare number or unrecognized — treat as literal
    return { type: "literal", value: raw };
  }

  // Long strings (""" or ''')
  const isLong = raw.startsWith('"""') || raw.startsWith("'''");
  const quoteChar = raw[0];
  const quoteLen = isLong ? 3 : 1;
  const quoteStr = isLong ? quoteChar.repeat(3) : quoteChar;

  // Find the closing quote
  let i = quoteLen;
  let value = "";
  while (i < raw.length) {
    if (raw[i] === "\\") {
      const next = raw[i + 1];
      switch (next) {
        case "n": value += "\n"; break;
        case "r": value += "\r"; break;
        case "t": value += "\t"; break;
        case "\\": value += "\\"; break;
        case '"': value += '"'; break;
        case "'": value += "'"; break;
        default: value += next || ""; break;
      }
      i += 2;
      continue;
    }

    if (raw.slice(i, i + quoteLen) === quoteStr) {
      i += quoteLen;
      break;
    }

    value += raw[i];
    i++;
  }

  // After closing quote: check for @lang or ^^datatype
  const suffix = raw.slice(i);
  if (suffix.startsWith("@")) {
    return { type: "literal", value, lang: suffix.slice(1) };
  }
  if (suffix.startsWith("^^")) {
    const dtToken = suffix.slice(2);
    return { type: "literal", value, datatype: dtToken };
  }

  return { type: "literal", value };
}

/**
 * Tokenize a Turtle block body (everything after the subject) into
 * predicate-object groups separated by ; and objects separated by ,.
 *
 * Returns a flat array of tokens with special markers for ; and , and .
 */
function tokenizeBlock(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    // Skip whitespace
    if (/\s/.test(c)) { i++; continue; }

    // Comment
    if (c === "#") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    // Statement terminators
    if (c === ";") { tokens.push(";"); i++; continue; }
    if (c === ",") { tokens.push(","); i++; continue; }
    if (c === ".") {
      // Check it's not inside an IRI (shouldn't be since we handle <...>)
      tokens.push(".");
      i++;
      continue;
    }

    // Full IRI
    if (c === "<") {
      let end = i + 1;
      while (end < text.length && text[end] !== ">") end++;
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }

    // String literals
    if (c === '"' || c === "'") {
      const isLong = text.slice(i, i + 3) === c.repeat(3);
      const quoteLen = isLong ? 3 : 1;
      const quoteStr = isLong ? c.repeat(3) : c;
      let end = i + quoteLen;

      while (end < text.length) {
        if (text[end] === "\\") { end += 2; continue; }
        if (text.slice(end, end + quoteLen) === quoteStr) {
          end += quoteLen;
          break;
        }
        end++;
      }

      // Consume @lang or ^^datatype
      if (end < text.length && text[end] === "@") {
        end++;
        while (end < text.length && /[a-zA-Z0-9-]/.test(text[end])) end++;
      } else if (text.slice(end, end + 2) === "^^") {
        end += 2;
        if (end < text.length && text[end] === "<") {
          while (end < text.length && text[end] !== ">") end++;
          end++; // past >
        } else {
          while (end < text.length && /[A-Za-z0-9_:.-]/.test(text[end])) end++;
        }
      }

      tokens.push(text.slice(i, end));
      i = end;
      continue;
    }

    // Blank node []
    if (c === "[") {
      let depth = 1;
      let end = i + 1;
      while (end < text.length && depth > 0) {
        if (text[end] === "[") depth++;
        if (text[end] === "]") depth--;
        end++;
      }
      tokens.push(text.slice(i, end));
      i = end;
      continue;
    }

    // Collection ()
    if (c === "(") {
      let depth = 1;
      let end = i + 1;
      while (end < text.length && depth > 0) {
        if (text[end] === "(") depth++;
        if (text[end] === ")") depth--;
        end++;
      }
      tokens.push(text.slice(i, end));
      i = end;
      continue;
    }

    // Prefixed name, keyword, or bare value
    let end = i;
    while (end < text.length && !/[\s;,.#"'<[\](]/.test(text[end])) end++;
    if (end > i) {
      tokens.push(text.slice(i, end));
      i = end;
    } else {
      i++;
    }
  }

  return tokens;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Parse all predicate-object pairs from a subject block in Turtle source.
 *
 * Returns null if the entity block cannot be found.
 */
export function parseBlockTriples(
  source: string,
  entityIri: string,
): ParsedTriple[] | null {
  const { prefixes, base } = parseDeclarations(source);
  const lines = source.split("\n");

  const block = findBlock(lines, entityIri, prefixes, base);
  if (!block) return null;

  // Extract block text (everything from subject line to terminal .)
  const blockLines = lines.slice(block.startLine, block.endLine + 1);
  const blockText = blockLines.join("\n");

  // Remove the subject token(s) — find the first predicate position
  // The subject is the first token, so skip past it
  const tokens = tokenizeBlock(blockText);
  if (tokens.length === 0) return null;

  // Skip the subject token (first non-separator token)
  let startIdx = 0;
  if (tokens[startIdx] !== ";" && tokens[startIdx] !== "," && tokens[startIdx] !== ".") {
    startIdx = 1;
  }

  // Parse predicate-object pairs
  const triples: ParsedTriple[] = [];
  let currentPredicate: string | null = null;
  let expectPredicate = true;

  for (let ti = startIdx; ti < tokens.length; ti++) {
    const tok = tokens[ti];

    if (tok === ".") break;

    if (tok === ";") {
      expectPredicate = true;
      continue;
    }

    if (tok === ",") {
      // Next token is another object for the current predicate
      expectPredicate = false;
      continue;
    }

    if (expectPredicate) {
      // This token is a predicate
      if (tok === "a") {
        currentPredicate = RDF_TYPE;
      } else {
        currentPredicate = resolveIri(tok, prefixes, base);
      }
      expectPredicate = false;
    } else if (currentPredicate) {
      // This token is an object
      let obj: ParsedObject;

      if (tok === "true" || tok === "false") {
        obj = { type: "boolean", value: tok === "true" };
      } else if (tok.startsWith('"') || tok.startsWith("'")) {
        obj = parseLiteral(tok);
        // Resolve datatype IRI if present
        if (obj.type === "literal" && obj.datatype) {
          obj = { ...obj, datatype: resolveIri(obj.datatype, prefixes, base) };
        }
      } else if (tok.startsWith("<") || tok.includes(":")) {
        obj = { type: "iri", value: resolveIri(tok, prefixes, base) };
      } else {
        // Bare number or unrecognized
        obj = { type: "literal", value: tok };
      }

      triples.push({ predicate: currentPredicate, object: obj });
    }
  }

  return triples;
}
