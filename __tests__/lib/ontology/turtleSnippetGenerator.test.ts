import { describe, it, expect } from "vitest";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";

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
});
