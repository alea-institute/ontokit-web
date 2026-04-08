import { describe, it, expect } from "vitest";
import { attributeLinesToEntities } from "@/lib/editor/entityLineAttribution";
import type { EntityReviewMetadata } from "@/lib/api/suggestions";

const meta1: EntityReviewMetadata = {
  entity_iri: "http://example.org/Foo",
  entity_label: "Foo",
  shard_id: "s1",
  shard_label: "Shard 1",
  provenance: "llm-proposed",
  confidence: 0.9,
  duplicate_candidates: [],
};

const meta2: EntityReviewMetadata = {
  entity_iri: "http://example.org/Bar",
  entity_label: "Bar",
  shard_id: "s2",
  shard_label: "Shard 2",
  provenance: "user-written",
  confidence: null,
  duplicate_candidates: [],
};

const map = new Map<string, EntityReviewMetadata>([
  ["http://example.org/Foo", meta1],
  ["http://example.org/Bar", meta2],
]);

describe("attributeLinesToEntities", () => {
  it("Test 1: returns null entity for context lines and hunk headers", () => {
    const lines = ["@@ -1,5 +1,8 @@", " context line"];
    const result = attributeLinesToEntities(lines, map);
    expect(result[0].entityIri).toBeNull();
    expect(result[0].metadata).toBeNull();
    expect(result[1].entityIri).toBeNull();
    expect(result[1].metadata).toBeNull();
  });

  it("Test 2: detects full IRI subject declaration and attributes continuation lines", () => {
    const lines = [
      '+ <http://example.org/Foo> a owl:Class ;',
      '+   rdfs:label "Foo"@en ;',
    ];
    const result = attributeLinesToEntities(lines, map);
    expect(result[0].entityIri).toBe("http://example.org/Foo");
    expect(result[0].metadata).toEqual(meta1);
    expect(result[1].entityIri).toBe("http://example.org/Foo");
    expect(result[1].metadata).toEqual(meta1);
  });

  it("Test 3: prefixed subject declaration retains previous context (best-effort)", () => {
    const lines = ["+ ex:Bar a owl:Class ;"];
    const result = attributeLinesToEntities(lines, map);
    // Prefix match is best-effort; no prior context so entityIri is null
    expect(result[0].entityIri).toBeNull();
  });

  it("Test 4: resets entity context when a new subject IRI appears", () => {
    const lines = [
      '+ <http://example.org/Foo> a owl:Class ;',
      '+ <http://example.org/Bar> a owl:Class ;',
    ];
    const result = attributeLinesToEntities(lines, map);
    expect(result[0].entityIri).toBe("http://example.org/Foo");
    expect(result[1].entityIri).toBe("http://example.org/Bar");
    expect(result[1].metadata).toEqual(meta2);
  });

  it("Test 5: returns null for deletion lines (lines starting with -)", () => {
    const lines = ['- <http://example.org/Foo> a owl:Class ;'];
    const result = attributeLinesToEntities(lines, map);
    expect(result[0].entityIri).toBeNull();
    expect(result[0].metadata).toBeNull();
  });
});
