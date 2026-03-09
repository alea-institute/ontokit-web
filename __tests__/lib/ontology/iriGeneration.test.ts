import { describe, it, expect } from "vitest";
import {
  uuidToBase62,
  labelToLocalName,
  detectIriPattern,
  detectPatternFromIriIndex,
  generateEntityIri,
} from "@/lib/ontology/iriGeneration";
import type { IriPosition } from "@/lib/editor/indexWorker";

// ── uuidToBase62 ────────────────────────────────────────────────────

describe("uuidToBase62", () => {
  it("produces a deterministic result for the same UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const a = uuidToBase62(uuid);
    const b = uuidToBase62(uuid);
    expect(a).toBe(b);
  });

  it("starts with 'R' for QName safety", () => {
    expect(uuidToBase62()).toMatch(/^R/);
  });

  it("contains only base62 characters after prefix", () => {
    const result = uuidToBase62();
    expect(result.slice(1)).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("produces unique values for different UUIDs", () => {
    const a = uuidToBase62("550e8400-e29b-41d4-a716-446655440000");
    const b = uuidToBase62("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    expect(a).not.toBe(b);
  });

  it("is approximately 23 characters long", () => {
    const result = uuidToBase62("ffffffff-ffff-ffff-ffff-ffffffffffff");
    // 128 bits in base62 → ceil(128 / log2(62)) ≈ 22 chars + "R" prefix
    expect(result.length).toBeGreaterThanOrEqual(20);
    expect(result.length).toBeLessThanOrEqual(25);
  });

  it("handles the zero UUID", () => {
    const result = uuidToBase62("00000000-0000-0000-0000-000000000000");
    expect(result).toBe("R0");
  });
});

// ── labelToLocalName ─────────────────────────────────────────────────

describe("labelToLocalName", () => {
  it("converts multi-word labels to PascalCase", () => {
    expect(labelToLocalName("Red Blood Cell")).toBe("RedBloodCell");
  });

  it("handles hyphenated labels", () => {
    expect(labelToLocalName("has-part")).toBe("HasPart");
  });

  it("strips leading/trailing whitespace", () => {
    expect(labelToLocalName("  foo  bar  ")).toBe("FooBar");
  });

  it("handles single-word labels", () => {
    expect(labelToLocalName("Person")).toBe("Person");
  });

  it("handles empty string", () => {
    expect(labelToLocalName("")).toBe("");
  });

  it("strips non-alphanumeric characters", () => {
    expect(labelToLocalName("thing (version 2)")).toBe("ThingVersion2");
  });
});

// ── detectIriPattern ─────────────────────────────────────────────────

describe("detectIriPattern", () => {
  it("detects UUID pattern when majority are long alphanumeric", () => {
    const names = [
      "R2xK9mNpQ4vW7cLsA1bF3dG",
      "R8yJ5hTrE6nU0wXzI4oP2qS",
      "R1a2B3c4D5e6F7g8H9i0J1k",
      "Person",
    ];
    const result = detectIriPattern(names);
    expect(result.pattern).toBe("uuid");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("detects numeric pattern when majority have numeric suffixes", () => {
    const names = ["Class_001", "Class_002", "Class_003", "Person"];
    const result = detectIriPattern(names);
    expect(result.pattern).toBe("numeric");
    expect(result.nextNumeric).toBe(4);
  });

  it("returns next numeric value correctly", () => {
    const names = ["Item_10", "Item_20", "Item_15"];
    const result = detectIriPattern(names);
    expect(result.pattern).toBe("numeric");
    expect(result.nextNumeric).toBe(21);
  });

  it("detects named pattern when mostly human-readable", () => {
    const names = ["Person", "Animal", "Vehicle", "Building"];
    const result = detectIriPattern(names);
    expect(result.pattern).toBe("named");
  });

  it("returns uuid with confidence 0 for empty input", () => {
    const result = detectIriPattern([]);
    expect(result.pattern).toBe("uuid");
    expect(result.confidence).toBe(0);
  });
});

// ── detectPatternFromIriIndex ────────────────────────────────────────

describe("detectPatternFromIriIndex", () => {
  it("filters to internal namespaces", () => {
    const index = new Map<string, IriPosition>([
      ["http://example.org/ont#Person", { line: 1, col: 1, len: 10 }],
      ["http://example.org/ont#Animal", { line: 2, col: 1, len: 10 }],
      ["http://www.w3.org/2002/07/owl#Class", { line: 3, col: 1, len: 10 }],
    ]);
    const internal = new Set(["http://example.org/ont#"]);
    const result = detectPatternFromIriIndex(index, internal);
    expect(result.pattern).toBe("named");
  });

  it("handles empty index", () => {
    const result = detectPatternFromIriIndex(new Map(), new Set());
    expect(result.pattern).toBe("uuid");
    expect(result.confidence).toBe(0);
  });
});

// ── generateEntityIri ────────────────────────────────────────────────

describe("generateEntityIri", () => {
  it("generates a UUID-based IRI", () => {
    const iri = generateEntityIri({
      baseNamespace: "http://example.org/ont#",
      pattern: "uuid",
    });
    expect(iri).toMatch(/^http:\/\/example\.org\/ont#R[0-9A-Za-z]+$/);
  });

  it("generates a numeric-based IRI", () => {
    const iri = generateEntityIri({
      baseNamespace: "http://example.org/ont#",
      pattern: "numeric",
      nextNumeric: 42,
    });
    expect(iri).toBe("http://example.org/ont#42");
  });

  it("generates a named IRI from label", () => {
    const iri = generateEntityIri({
      baseNamespace: "http://example.org/ont#",
      pattern: "named",
      label: "Red Blood Cell",
    });
    expect(iri).toBe("http://example.org/ont#RedBloodCell");
  });

  it("falls back to UUID when named pattern has no label", () => {
    const iri = generateEntityIri({
      baseNamespace: "http://example.org/ont#",
      pattern: "named",
    });
    expect(iri).toMatch(/^http:\/\/example\.org\/ont#R[0-9A-Za-z]+$/);
  });

  it("uses default nextNumeric of 1 when not provided", () => {
    const iri = generateEntityIri({
      baseNamespace: "http://example.org/ont#",
      pattern: "numeric",
    });
    expect(iri).toBe("http://example.org/ont#1");
  });
});
