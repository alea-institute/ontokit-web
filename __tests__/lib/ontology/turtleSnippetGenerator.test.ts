import { describe, it, expect } from "vitest";
import {
  generateTurtleSnippet,
  isProvPrefixBoundToProvO,
  PROV_NAMESPACE,
} from "@/lib/ontology/turtleSnippetGenerator";

describe("generateTurtleSnippet", () => {
  // ── Entity types ─────────────────────────────────────────────────

  it("generates a class snippet", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
    });
    expect(snippet).toContain("a owl:Class");
    expect(snippet).toContain('rdfs:label "Foo"@en');
    expect(snippet).toMatch(/\.\s*$/);
  });

  it("generates an object property snippet", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#hasPart",
      label: "has part",
      entityType: "objectProperty",
    });
    expect(snippet).toContain("a owl:ObjectProperty");
    expect(snippet).toContain('rdfs:label "has part"@en');
  });

  it("generates a data property snippet", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#age",
      label: "age",
      entityType: "dataProperty",
    });
    expect(snippet).toContain("a owl:DatatypeProperty");
  });

  it("generates an annotation property snippet", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#note",
      label: "note",
      entityType: "annotationProperty",
    });
    expect(snippet).toContain("a owl:AnnotationProperty");
  });

  it("generates an individual snippet", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#john",
      label: "John",
      entityType: "individual",
    });
    expect(snippet).toContain("a owl:NamedIndividual");
  });

  // ── Parent relationships ─────────────────────────────────────────

  it("adds rdfs:subClassOf for a class with parent", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Dog",
      label: "Dog",
      entityType: "class",
      parentIri: "http://example.org/ont#Animal",
    });
    expect(snippet).toContain("rdfs:subClassOf");
    expect(snippet).toContain("<http://example.org/ont#Animal>");
  });

  it("adds rdfs:subPropertyOf for a property with parent", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#hasDirectPart",
      label: "has direct part",
      entityType: "objectProperty",
      parentIri: "http://example.org/ont#hasPart",
    });
    expect(snippet).toContain("rdfs:subPropertyOf");
  });

  // ── B-1: property suggestions must NEVER emit owl:Class ──────────────

  it("emits owl:ObjectProperty (never owl:Class) for an accepted object sub-property", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#hasSubPart",
      label: "has sub part",
      entityType: "objectProperty",
      parentIri: "http://example.org/ont#hasPart",
    });
    expect(snippet).toContain("a owl:ObjectProperty");
    expect(snippet).not.toContain("owl:Class");
    // The parent link must be rdfs:subPropertyOf, not rdfs:subClassOf
    expect(snippet).toContain("rdfs:subPropertyOf");
    expect(snippet).not.toContain("rdfs:subClassOf");
  });

  it("emits owl:DatatypeProperty (never owl:Class) for an accepted data sub-property", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#birthYear",
      label: "birth year",
      entityType: "dataProperty",
      parentIri: "http://example.org/ont#year",
    });
    expect(snippet).toContain("a owl:DatatypeProperty");
    expect(snippet).not.toContain("owl:Class");
    expect(snippet).toContain("rdfs:subPropertyOf");
  });

  it("adds rdf:type for an individual with parent class", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#fido",
      label: "Fido",
      entityType: "individual",
      parentIri: "http://example.org/ont#Dog",
    });
    expect(snippet).toContain("rdf:type");
  });

  // ── Prefix usage ─────────────────────────────────────────────────

  it("uses prefixed names when prefix and namespace are available", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });
    expect(snippet).toContain("ex:Foo a owl:Class");
    expect(snippet).not.toContain("<http://example.org/ont#Foo>");
  });

  it("uses prefixed names for parent when in same namespace", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Dog",
      label: "Dog",
      entityType: "class",
      parentIri: "http://example.org/ont#Animal",
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });
    expect(snippet).toContain("rdfs:subClassOf ex:Animal");
  });

  it("falls back to full IRI when no prefix is available", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
    });
    expect(snippet).toContain("<http://example.org/ont#Foo>");
  });

  it("falls back to full IRI for parent in different namespace", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Dog",
      label: "Dog",
      entityType: "class",
      parentIri: "http://other.org/ont#Animal",
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });
    expect(snippet).toContain("<http://other.org/ont#Animal>");
  });

  it.each([
    { iri: "http://example.org/Foo> . <http://evil.test/injected" },
    { iri: "http://example.org/Foo", parentIri: "http://example.org/Bad Parent" },
  ])("rejects unsafe subject and parent IRIs", (overrides) => {
    expect(() => generateTurtleSnippet({
      ...overrides,
      label: "Foo",
      entityType: "class",
    })).toThrow("Invalid IRI: unsafe characters are not allowed");
  });

  // ── Label escaping ───────────────────────────────────────────────

  it("escapes double quotes in labels", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Test",
      label: 'He said "hello"',
      entityType: "class",
    });
    expect(snippet).toContain('rdfs:label "He said \\"hello\\""@en');
  });

  it("escapes backslashes in labels", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Test",
      label: "path\\to\\thing",
      entityType: "class",
    });
    expect(snippet).toContain('rdfs:label "path\\\\to\\\\thing"@en');
  });

  // ── Structure ────────────────────────────────────────────────────

  it("starts with a blank line for separation", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
    });
    expect(snippet.startsWith("\n")).toBe(true);
  });

  it("ends with a newline", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
    });
    expect(snippet.endsWith("\n")).toBe(true);
  });

  it("ends the triple block with a period", () => {
    const snippet = generateTurtleSnippet({
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class",
    });
    expect(snippet.trimEnd()).toMatch(/\.$/);
  });

  // ── PROV-O provenance (q9: PROV-O persistence for AI-generated entities) ──

  describe("PROV-O provenance", () => {
    const base = {
      iri: "http://example.org/ont#Foo",
      label: "Foo",
      entityType: "class" as const,
      parentIri: "http://example.org/ont#Bar",
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    };

    it("emits no PROV-O triples when provenance is absent", () => {
      const snippet = generateTurtleSnippet(base);
      expect(snippet).not.toContain("prov:");
    });

    it("persists prov:wasGeneratedBy with a prov:SoftwareAgent carrying the model id", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "openai/gpt-4o" },
      });
      expect(snippet).toContain("prov:wasGeneratedBy [");
      expect(snippet).toContain("a prov:Activity");
      expect(snippet).toContain("prov:wasAssociatedWith [");
      expect(snippet).toContain("a prov:SoftwareAgent");
      expect(snippet).toContain('rdfs:label "openai/gpt-4o"');
    });

    it("persists the prompt template as a prov:Plan via prov:used", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "openai/gpt-4o", promptTemplate: "children-v1" },
      });
      expect(snippet).toContain("prov:used [");
      expect(snippet).toContain("a prov:Plan");
      expect(snippet).toContain('rdfs:label "children-v1"');
    });

    it("omits prov:used when no prompt template is given", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "openai/gpt-4o" },
      });
      expect(snippet).not.toContain("prov:used");
      expect(snippet).not.toContain("prov:Plan");
    });

    it("declares the prov prefix by default", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "m" },
      });
      expect(snippet).toContain("@prefix prov: <http://www.w3.org/ns/prov#> .");
    });

    it("suppresses the prefix declaration when declarePrefix is false", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "m", declarePrefix: false },
      });
      expect(snippet).not.toContain("@prefix");
      expect(snippet).toContain("prov:wasGeneratedBy");
    });

    it("keeps the parent link and label intact alongside provenance", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "m", promptTemplate: "t" },
      });
      expect(snippet).toContain("ex:Foo a owl:Class ;");
      expect(snippet).toContain('rdfs:label "Foo"@en ;');
      expect(snippet).toContain("rdfs:subClassOf ex:Bar ;");
      expect(snippet.trimEnd()).toMatch(/\] \.$/);
    });

    it("escapes quotes and backslashes in model and template ids", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: 'mo"del\\x', promptTemplate: 'te"mpl' },
      });
      expect(snippet).toContain('rdfs:label "mo\\"del\\\\x"');
      expect(snippet).toContain('rdfs:label "te\\"mpl"');
    });

    it("emits provenance correctly when no parent is present", () => {
      const snippet = generateTurtleSnippet({
        iri: "http://example.org/ont#Foo",
        label: "Foo",
        entityType: "class",
        ontologyPrefix: "ex",
        ontologyNamespace: "http://example.org/ont#",
        provenance: { model: "m", promptTemplate: "t" },
      });
      expect(snippet).toContain('rdfs:label "Foo"@en ;');
      expect(snippet).toContain("prov:wasGeneratedBy [");
      expect(snippet.trimEnd()).toMatch(/\] \.$/);
      const opens = (snippet.match(/\[/g) ?? []).length;
      expect(opens).toBe((snippet.match(/\]/g) ?? []).length);
    });

    it("escapes newlines, carriage returns, and tabs in network-sourced ids", () => {
      const snippet = generateTurtleSnippet({
        iri: "http://example.org/ont#Foo",
        label: "line1\nline2",
        entityType: "class",
        provenance: { model: "mo\ndel", promptTemplate: "te\r\tmpl" },
      });
      expect(snippet).toContain('rdfs:label "line1\\nline2"@en');
      expect(snippet).toContain('rdfs:label "mo\\ndel"');
      expect(snippet).toContain('rdfs:label "te\\r\\tmpl"');
      // no raw control characters may survive inside the emitted literals
      const literals = [...snippet.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      expect(literals.length).toBeGreaterThan(0);
      for (const lit of literals) {
        expect(/[\n\r\t]/.test(lit)).toBe(false);
      }
    });

    it("emits a balanced, period-terminated block (well-formed Turtle shape)", () => {
      const snippet = generateTurtleSnippet({
        ...base,
        provenance: { model: "m", promptTemplate: "t" },
      });
      const opens = (snippet.match(/\[/g) ?? []).length;
      const closes = (snippet.match(/\]/g) ?? []).length;
      expect(opens).toBe(closes);
      expect(snippet.trimEnd()).toMatch(/\.$/);
      // exactly one statement terminator after the prefix directive
      const body = snippet.split("\n").filter((l) => !l.startsWith("@prefix"));
      expect(body.join("\n").match(/ \.\s*$/)).toBeTruthy();
    });
  });
});

describe("isProvPrefixBoundToProvO (B1: IRI-aware prefix detection)", () => {
  it("false for an empty or prefix-less document", () => {
    expect(isProvPrefixBoundToProvO("")).toBe(false);
    expect(isProvPrefixBoundToProvO("ex:Foo a owl:Class .")).toBe(false);
  });

  it("true when prov: is bound to the W3C PROV-O namespace", () => {
    expect(
      isProvPrefixBoundToProvO(`@prefix prov: <${PROV_NAMESPACE}> .\nex:Foo a owl:Class .`),
    ).toBe(true);
    expect(
      isProvPrefixBoundToProvO(`PREFIX prov: <${PROV_NAMESPACE}>`),
    ).toBe(true);
  });

  it("FALSE when prov: is bound to a different namespace (collision must not suppress our declaration)", () => {
    expect(
      isProvPrefixBoundToProvO("@prefix prov: <http://example.org/canon-law#province> .\n"),
    ).toBe(false);
  });

  it("uses the LAST declaration — the one governing an appended snippet", () => {
    const provoThenCollision =
      `@prefix prov: <${PROV_NAMESPACE}> .\n` +
      "@prefix prov: <http://example.org/other#> .\n";
    expect(isProvPrefixBoundToProvO(provoThenCollision)).toBe(false);

    const collisionThenProvo =
      "@prefix prov: <http://example.org/other#> .\n" +
      `@prefix prov: <${PROV_NAMESPACE}> .\n`;
    expect(isProvPrefixBoundToProvO(collisionThenProvo)).toBe(true);
  });

  it("does not match prov-prefixed names in triples (only declarations)", () => {
    expect(isProvPrefixBoundToProvO("ex:Foo prov:wasGeneratedBy [] .")).toBe(false);
  });
});
