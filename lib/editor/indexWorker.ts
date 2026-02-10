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
  positions: Array<[string, IriPosition]>; // Map entries as array for transfer
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

// Build IRI index from content
function buildIriIndex(content: string): Map<string, IriPosition> {
  const index = new Map<string, IriPosition>();
  const lines = content.split("\n");

  // Extract prefixes first (single pass)
  // Support both @prefix and PREFIX, with optional empty prefix
  const prefixes = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match @prefix or PREFIX declarations - prefix name can be empty
    const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
    if (prefixMatch) {
      prefixes.set(prefixMatch[1], prefixMatch[2]);
    }
  }

  // Index all IRIs and prefixed names
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Find full IRIs <...>
    const fullIriMatches = line.matchAll(/<([^>\s]+)>/g);
    for (const match of fullIriMatches) {
      const iri = match[1];
      if (!index.has(iri)) {
        index.set(iri, { line: i + 1, col: match.index! + 1, len: match[0].length });
      }
    }

    // Find prefixed names - handle both "prefix:local" and ":local" (empty prefix)
    // Local names can contain letters, numbers, underscores, and hyphens
    const prefixedMatches = line.matchAll(/(?:^|[\s;,.\[\(])(\w*):([A-Za-z_][A-Za-z0-9_\-]*)/g);
    for (const match of prefixedMatches) {
      const prefix = match[1]; // Can be empty string for default prefix
      const localName = match[2];
      const namespace = prefixes.get(prefix);
      if (namespace) {
        const fullIri = namespace + localName;
        if (!index.has(fullIri)) {
          // Calculate actual position (account for leading whitespace/delimiter in match)
          const fullMatch = match[0];
          const prefixedName = `${prefix}:${localName}`;
          const offset = fullMatch.indexOf(prefixedName);
          index.set(fullIri, {
            line: i + 1,
            col: match.index! + offset + 1,
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
};

export {};
