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

  it("keeps absolute subjects unchanged while resolving relative subjects against the base", () => {
    const content = '@base <https://base.example/> .\n<https://other.example/Thing> a <urn:Class> .\n<Local> a <urn:Class> .';
    const result = processMessage({ type: "index", content, issues: [issue("absolute", "https://other.example/Thing"), issue("relative", "https://base.example/Local")] });
    expect(result.iriIndex).toEqual([
      ["https://other.example/Thing", { line: 2, col: 1, len: 29 }],
      ["https://base.example/Local", { line: 3, col: 1, len: 7 }],
    ]);
    expect(result.positions.map(([id]) => id)).toEqual(["absolute", "relative"]);
    expect(result.stats.issuesMatched).toBe(2);
  });

  it("ignores an undeclared prefix without assigning its label to the preceding subject", () => {
    const content = '@prefix ex: <https://example.org/> .\nex:First a ex:Class .\nmissing:Other rdfs:label "Not First" .\nex:Last rdfs:label "Last" .';
    const result = processMessage({ type: "index", content, issues: [issue("missing", "missing:Other"), issue("last", "https://example.org/Last")] });
    expect(result.iriIndex.map(([iri]) => iri)).toEqual(["https://example.org/First", "https://example.org/Last"]);
    expect(result.iriLabels).toEqual([["https://example.org/Last", "Last"]]);
    expect(result.positions.map(([id]) => id)).toEqual(["last"]);
    expect(result.diagnostics.find(item => item.issueId === "missing")).toMatchObject({ startLineNumber: 1, endColumn: 1 });
  });

  it("keeps the first location and label when a prefixed subject is defined again", () => {
    const content = '@prefix ex: <https://example.org/> .\nex:Thing rdfs:label "First" .\nex:Thing rdfs:label "Second" .';
    const result = processMessage({ type: "index", content, issues: [issue("thing", "https://example.org/Thing")] });
    expect(result.iriIndex).toEqual([["https://example.org/Thing", { line: 2, col: 1, len: 8 }]]);
    expect(result.iriLabels).toEqual([["https://example.org/Thing", "First"]]);
    expect(result.positions).toEqual([["thing", { line: 2, col: 1, len: 8 }]]);
  });

  it("leaves an unmatched issue at the document start when an indexed name only contains its local name", () => {
    const result = processMessage({ type: "index", content: '<https://example.org/ThingExtra> a <urn:Class> .', issues: [issue("missing", "https://other.example/Thing")] });
    expect(result.positions).toEqual([]);
    expect(result.iriIndex.map(([iri]) => iri)).toEqual(["https://example.org/ThingExtra"]);
    expect(result.diagnostics).toEqual([{ issueId: "missing", startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1, message: "[label] Issue missing", severity: "warning" }]);
    expect(result.stats.issuesMatched).toBe(0);
  });

  it.each(["#", "/"])("indexes a namespace ending %s exactly without making an empty local-name fallback", ending => {
    const result = processMessage({ type: "index", content: `<https://example.org${ending}> a <urn:Ontology> .`, issues: [issue("exact", `https://example.org${ending}`), issue("other", `https://other.example${ending}`)] });
    expect(result.positions.map(([id]) => id)).toEqual(["exact"]);
    expect(result.stats).toMatchObject({ irisIndexed: 1, localNamesIndexed: 0, issuesMatched: 1 });
    expect(result.diagnostics.find(item => item.issueId === "other")).toMatchObject({ startLineNumber: 1, endColumn: 1 });
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
