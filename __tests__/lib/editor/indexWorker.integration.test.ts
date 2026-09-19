import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadIndexWorker } from "../../fixtures/index-worker-harness";
import type { IndexWorkerMessage } from "@/lib/editor/indexWorker";

let processMessage: Awaited<ReturnType<typeof loadIndexWorker>>;
beforeAll(async () => { processMessage = await loadIndexWorker(); });
const issue = (id: string, subject_iri: string | null, issue_type = "warning") => ({ id, subject_iri, issue_type, rule_id: "label", message: `Issue ${id}` });
const source = [
  '@prefix ex: <https://example.org/> .',
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
  'ex:First a ex:Class ;',
  '  # a comment within the subject block',
  '',
  '  rdfs:label "First label"@en ;',
  '  ex:related ex:Reference .',
  '  ex:Second a ex:Class .',
].join("\n");

describe("real index worker message processing", () => {
  it("indexes subjects rather than referenced objects and maps issues to their source spans", () => {
    const result = processMessage({ type: "index", content: source, issues: [issue("second", "https://example.org/Second", "error"), issue("first", "https://example.org/First"), issue("reference", "https://example.org/Reference"), issue("global", null)] });
    expect(result.iriIndex).toEqual([["https://example.org/First", { line: 3, col: 1, len: 8 }], ["https://example.org/Second", { line: 8, col: 3, len: 9 }]]);
    expect(result.iriLabels).toEqual([["https://example.org/First", "First label"]]);
    expect(result.positions.map(([id]) => id)).toEqual(["second", "first"]);
    expect(result.diagnostics).toContainEqual({ issueId: "second", startLineNumber: 8, startColumn: 3, endLineNumber: 8, endColumn: 12, message: "[label] Issue second", severity: "error" });
    expect(result.diagnostics.find(item => item.issueId === "reference")).toMatchObject({ startLineNumber: 1, endColumn: 1 });
    expect(result.diagnostics.some(item => item.issueId === "global")).toBe(false);
    expect(result.stats).toMatchObject({ linesProcessed: 8, irisIndexed: 2, issuesMatched: 2 });
  });

  it.each(["https://example.org/First#", "https://different.org/First", "https://different.org/#First"])("resolves the supported normalized or local-name fallback %s", subject => {
    const result = processMessage({ type: "index", content: source, issues: [issue("fallback", subject)] });
    expect(result.positions).toEqual([["fallback", { line: 3, col: 1, len: 8 }]]);
  });

  it("resolves base-relative and default-prefix subjects and retains their first definition", () => {
    const content = 'BASE <https://example.org/>\nPREFIX : <https://vocab.org/#>\n<Thing> a :Class .\n:Local a :Class .\n<Thing> rdfs:label "Repeated" .';
    const result = processMessage({ type: "index", content, issues: [] });
    expect(result.iriIndex).toEqual([["https://example.org/Thing", { line: 3, col: 1, len: 7 }], ["https://vocab.org/#Local", { line: 4, col: 1, len: 6 }]]);
    expect(result.iriLabels).toEqual([["https://example.org/Thing", "Repeated"]]);
  });

  it("returns an empty index for empty content and does not retain prior message state", () => {
    processMessage({ type: "index", content: source, issues: [] });
    const result = processMessage({ type: "index", content: "", issues: [] });
    expect(result).toMatchObject({ positions: [], iriIndex: [], iriLabels: [], diagnostics: [], stats: { irisIndexed: 0, issuesMatched: 0 } });
  });

  it("reports a malformed message and remains usable for the next valid request", () => {
    const logged = vi.spyOn(console, "error");
    try {
      const result = processMessage({ type: "index", content: null, issues: [] } as unknown as IndexWorkerMessage);
      expect(result).toMatchObject({ positions: [], iriIndex: [], diagnostics: [], stats: { linesProcessed: 0 } });
      expect(logged).toHaveBeenCalledWith("[IndexWorker] Error during indexing:", expect.any(TypeError));
      expect(processMessage({ type: "index", content: source, issues: [] }).iriIndex).toHaveLength(2);
    } finally { logged.mockRestore(); }
  });
});
