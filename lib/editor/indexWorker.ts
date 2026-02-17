// Web Worker for building IRI index from Turtle content
// This runs in a separate thread to avoid blocking the main UI

export interface IriPosition {
  line: number;
  col: number;
  len: number;
}

export interface IndexWorkerMessage {
  type: 'index';
  content: string;
  issues: Array<{ id: string; subject_iri: string | null; rule_id: string; message: string; issue_type: string }>;
}

export interface IndexWorkerResult {
  type: 'result';
  positions: Array<[string, IriPosition]>; // Issue ID to position (for lint diagnostics)
  iriIndex: Array<[string, IriPosition]>; // Full IRI to position index (for "View in Source")
  diagnostics: Array<{
    issueId: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    message: string;
    severity: string;
  }>;
  stats: {
    linesProcessed: number;
    irisIndexed: number;
    localNamesIndexed: number;
    issuesMatched: number;
    timeMs: number;
  };
}

// Build IRI index from content - only indexes IRIs in SUBJECT position (definitions)
// This ensures we find where entities are defined, not where they're referenced
function buildIriIndex(content: string): Map<string, IriPosition> {
  const index = new Map<string, IriPosition>();
  const lines = content.split("\n");

  // Extract @base and prefixes first (single pass)
  // Support both @base and BASE, @prefix and PREFIX
  let baseUri: string | null = null;
  const prefixes = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match @base or BASE declaration
    if (!baseUri) {
      const baseMatch = line.match(/@?base\s+<([^>]+)>/i);
      if (baseMatch) {
        baseUri = baseMatch[1];
      }
    }
    // Match @prefix or PREFIX declarations - prefix name can be empty
    const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
    if (prefixMatch) {
      prefixes.set(prefixMatch[1], prefixMatch[2]);
    }
  }

  // Index IRIs that appear in SUBJECT position only
  // A subject starts a new triple block - it's NOT a continuation of a previous line
  // Lines ending with , or ; indicate the next line is a continuation (object or predicate-object)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments, empty lines, and prefix declarations
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("@") || trimmed.toUpperCase().startsWith("PREFIX")) continue;

    // Check if previous non-empty line ends with , or ; (meaning this is a continuation)
    let isContinuation = false;
    for (let j = i - 1; j >= 0; j--) {
      const prevTrimmed = lines[j].trim();
      if (!prevTrimmed || prevTrimmed.startsWith("#")) continue; // Skip empty/comment lines
      // If previous line ends with , or ; this is a continuation
      if (prevTrimmed.endsWith(",") || prevTrimmed.endsWith(";")) {
        isContinuation = true;
      }
      break; // Only check the immediately preceding non-empty line
    }

    if (isContinuation) continue; // Skip - this is not a subject

    // Match full IRI or relative IRI at start of line: <...>
    const fullIriMatch = trimmed.match(/^<([^>\s]+)>/);
    if (fullIriMatch) {
      let iri = fullIriMatch[1];
      // Resolve relative IRIs against @base
      if (baseUri && !iri.match(/^[a-z][a-z0-9+.-]*:/i)) {
        iri = baseUri + iri;
      }
      if (!index.has(iri)) {
        const col = line.indexOf('<') + 1;
        index.set(iri, { line: i + 1, col, len: fullIriMatch[0].length });
      }
    }

    // Match prefixed name at start of line: prefix:local or :local
    const prefixedMatch = trimmed.match(/^(\w*):([A-Za-z_][A-Za-z0-9_\-]*)/);
    if (prefixedMatch) {
      const prefix = prefixedMatch[1];
      const localName = prefixedMatch[2];
      const namespace = prefixes.get(prefix);
      if (namespace) {
        const fullIri = namespace + localName;
        if (!index.has(fullIri)) {
          const prefixedName = `${prefix}:${localName}`;
          const col = line.indexOf(prefixedName) + 1;
          index.set(fullIri, {
            line: i + 1,
            col,
            len: prefixedName.length
          });
        }
      }
    }
  }

  return index;
}

// Try to find an IRI in the index with flexible matching
function findIriInIndex(
  iri: string,
  index: Map<string, IriPosition>,
  localNameIndex: Map<string, IriPosition>
): IriPosition | null {
  // 1. Exact match
  if (index.has(iri)) {
    return index.get(iri)!;
  }

  // 2. Try without trailing slash/hash differences
  const normalized = iri.replace(/[/#]$/, '');
  if (index.has(normalized)) {
    return index.get(normalized)!;
  }

  // 3. Try matching by local name (fragment or last path segment)
  const localName = iri.includes('#')
    ? iri.split('#').pop()
    : iri.split('/').pop();

  if (localName && localNameIndex.has(localName)) {
    return localNameIndex.get(localName)!;
  }

  return null;
}

// Worker message handler
self.onmessage = (event: MessageEvent<IndexWorkerMessage>) => {
  const startTime = performance.now();
  const { content, issues } = event.data;

  // Build the index
  try {
    const iriIndex = buildIriIndex(content);

  // Also build a local name index for fallback matching
  const localNameIndex = new Map<string, IriPosition>();
  for (const [iri, pos] of iriIndex) {
    const localName = iri.includes('#')
      ? iri.split('#').pop()
      : iri.split('/').pop();
    if (localName && !localNameIndex.has(localName)) {
      localNameIndex.set(localName, pos);
    }
  }

  // Match issues to positions
  const positions: Array<[string, IriPosition]> = [];
  const diagnostics: IndexWorkerResult['diagnostics'] = [];
  let issuesMatched = 0;
  const unmatchedIris: string[] = [];

  for (const issue of issues) {
    if (!issue.subject_iri) continue;

    const pos = findIriInIndex(issue.subject_iri, iriIndex, localNameIndex);
    if (pos) {
      issuesMatched++;
      positions.push([issue.id, pos]);
      diagnostics.push({
        issueId: issue.id,
        startLineNumber: pos.line,
        startColumn: pos.col,
        endLineNumber: pos.line,
        endColumn: pos.col + pos.len,
        message: `[${issue.rule_id}] ${issue.message}`,
        severity: issue.issue_type,
      });
    } else {
      unmatchedIris.push(issue.subject_iri);
      // Still add the diagnostic but without position
      diagnostics.push({
        issueId: issue.id,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: `[${issue.rule_id}] ${issue.message}`,
        severity: issue.issue_type,
      });
    }
  }

  const endTime = performance.now();

  // Log debugging info
  if (unmatchedIris.length > 0) {
    console.log(`[IndexWorker] ${unmatchedIris.length} unmatched IRIs. Examples:`, unmatchedIris.slice(0, 5));

    // Log what's in the index that might be similar
    const sampleIri = unmatchedIris[0];
    if (sampleIri) {
      const localName = sampleIri.split('/').pop() || sampleIri.split('#').pop();
      console.log(`[IndexWorker] Looking for local name "${localName}" in index...`);

      // Check if local name exists in any indexed IRI
      for (const [iri] of iriIndex) {
        if (iri.includes(localName || '')) {
          console.log(`[IndexWorker] Found similar in index: ${iri}`);
          break;
        }
      }
    }
  }

  const result: IndexWorkerResult = {
    type: 'result',
    positions,
    iriIndex: Array.from(iriIndex.entries()), // Full IRI index for "View in Source"
    diagnostics,
    stats: {
      linesProcessed: content.split("\n").length,
      irisIndexed: iriIndex.size,
      localNamesIndexed: localNameIndex.size,
      issuesMatched,
      timeMs: Math.round(endTime - startTime),
    },
  };

  self.postMessage(result);
  } catch (error) {
    console.error('[IndexWorker] Error during indexing:', error);
    // Send empty result on error
    self.postMessage({
      type: 'result',
      positions: [],
      iriIndex: [],
      diagnostics: [],
      stats: {
        linesProcessed: 0,
        irisIndexed: 0,
        localNamesIndexed: 0,
        issuesMatched: 0,
        timeMs: 0,
      },
    } as IndexWorkerResult);
  }
};

export {};
