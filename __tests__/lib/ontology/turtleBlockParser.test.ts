import { describe, it, expect } from "vitest";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import {
  TURTLE_FIXTURE,
  TURTLE_WITH_BASE,
  TURTLE_DEFAULT_PREFIX,
  TURTLE_COMPLEX,
  TURTLE_LONG_STRINGS,
} from "./fixtures";

// ── parseBlockTriples ──────────────────────────────────────────────────

describe("parseBlockTriples", () => {
  it("returns null when entity is not found", () => {
    expect(
      parseBlockTriples(TURTLE_FIXTURE, "http://example.org/ont#NonExistent"),
    ).toBeNull();
  });

  it("parses a simple class block", () => {
    const triples = parseBlockTriples(
      TURTLE_FIXTURE,
      "http://example.org/ont#Animal",
    );
    expect(triples).not.toBeNull();

    // rdf:type owl:Class
    const typeTriple = triples!.find(
      (t) =>
        t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    expect(typeTriple).toBeDefined();
    expect(typeTriple!.object).toEqual({
      type: "iri",
      value: "http://www.w3.org/2002/07/owl#Class",
    });

    // rdfs:label
    const labelTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#label",
    );
    expect(labelTriple).toBeDefined();
    expect(labelTriple!.object).toEqual({
      type: "literal",
      value: "Animal",
      lang: "en",
    });

    // rdfs:comment
    const commentTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#comment",
    );
    expect(commentTriple).toBeDefined();
    expect(commentTriple!.object).toEqual({
      type: "literal",
      value: "A living organism",
      lang: "en",
    });
  });

  it("parses a class with subClassOf", () => {
    const triples = parseBlockTriples(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
    );
    expect(triples).not.toBeNull();

    const subClassTriple = triples!.find(
      (t) =>
        t.predicate ===
        "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    );
    expect(subClassTriple).toBeDefined();
    expect(subClassTriple!.object).toEqual({
      type: "iri",
      value: "http://example.org/ont#Animal",
    });
  });

  it("parses an object property block with domain and range", () => {
    const triples = parseBlockTriples(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
    );
    expect(triples).not.toBeNull();

    const domainTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#domain",
    );
    expect(domainTriple).toBeDefined();
    expect(domainTriple!.object).toEqual({
      type: "iri",
      value: "http://example.org/ont#Animal",
    });

    const rangeTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#range",
    );
    expect(rangeTriple).toBeDefined();
    expect(rangeTriple!.object).toEqual({
      type: "iri",
      value: "http://example.org/ont#Animal",
    });
  });

  it("parses a datatype property", () => {
    const triples = parseBlockTriples(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasAge",
    );
    expect(triples).not.toBeNull();

    const typeTriple = triples!.find(
      (t) =>
        t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    expect(typeTriple!.object).toEqual({
      type: "iri",
      value: "http://www.w3.org/2002/07/owl#DatatypeProperty",
    });

    const rangeTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#range",
    );
    expect(rangeTriple!.object).toEqual({
      type: "iri",
      value: "http://www.w3.org/2001/XMLSchema#integer",
    });
  });

  it("parses an individual with typed literal", () => {
    const triples = parseBlockTriples(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
    );
    expect(triples).not.toBeNull();

    // Should have NamedIndividual type and Dog type
    const typeTriples = triples!.filter(
      (t) =>
        t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    const typeIris = typeTriples.map(
      (t) => (t.object as { type: "iri"; value: string }).value,
    );
    expect(typeIris).toContain("http://www.w3.org/2002/07/owl#NamedIndividual");
    expect(typeIris).toContain("http://example.org/ont#Dog");

    // hasAge with datatype
    const ageTriple = triples!.find(
      (t) => t.predicate === "http://example.org/ont#hasAge",
    );
    expect(ageTriple).toBeDefined();
    expect(ageTriple!.object.type).toBe("literal");
    const obj = ageTriple!.object as {
      type: "literal";
      value: string;
      datatype?: string;
    };
    expect(obj.value).toBe("5");
    expect(obj.datatype).toBe("http://www.w3.org/2001/XMLSchema#integer");
  });

  it("parses multi-value predicates (comma-separated objects)", () => {
    const triples = parseBlockTriples(
      TURTLE_COMPLEX,
      "http://example.org/ont#Person",
    );
    expect(triples).not.toBeNull();

    const labelTriples = triples!.filter(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#label",
    );
    expect(labelTriples).toHaveLength(2);
    const langs = labelTriples.map(
      (t) => (t.object as { type: "literal"; lang?: string }).lang,
    );
    expect(langs).toContain("en");
    expect(langs).toContain("es");
  });

  it("parses a block found via @base", () => {
    const triples = parseBlockTriples(
      TURTLE_WITH_BASE,
      "http://example.org/ont#Animal",
    );
    expect(triples).not.toBeNull();

    const typeTriple = triples!.find(
      (t) =>
        t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    expect(typeTriple!.object).toEqual({
      type: "iri",
      value: "http://www.w3.org/2002/07/owl#Class",
    });
  });

  it("parses a block using default prefix", () => {
    const triples = parseBlockTriples(
      TURTLE_DEFAULT_PREFIX,
      "http://example.org/ont#Bird",
    );
    expect(triples).not.toBeNull();

    const labelTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#label",
    );
    expect(labelTriple!.object).toEqual({
      type: "literal",
      value: "Bird",
      lang: "en",
    });
  });

  it("handles boolean literals", () => {
    const source = [
      "@prefix ex: <http://example.org/ont#> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "ex:old a owl:Class ;",
      "    owl:deprecated true .",
    ].join("\n");

    const triples = parseBlockTriples(source, "http://example.org/ont#old");
    expect(triples).not.toBeNull();

    const deprecatedTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2002/07/owl#deprecated",
    );
    expect(deprecatedTriple).toBeDefined();
    expect(deprecatedTriple!.object).toEqual({
      type: "boolean",
      value: true,
    });
  });

  it("handles false boolean literal", () => {
    const source = [
      "@prefix ex: <http://example.org/ont#> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "ex:current a owl:Class ;",
      "    owl:deprecated false .",
    ].join("\n");

    const triples = parseBlockTriples(
      source,
      "http://example.org/ont#current",
    );
    const deprecatedTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2002/07/owl#deprecated",
    );
    expect(deprecatedTriple!.object).toEqual({
      type: "boolean",
      value: false,
    });
  });

  it("handles multi-line (triple-quoted) strings", () => {
    const triples = parseBlockTriples(
      TURTLE_LONG_STRINGS,
      "http://example.org/ont#DocClass",
    );
    expect(triples).not.toBeNull();

    const commentTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/2000/01/rdf-schema#comment",
    );
    expect(commentTriple).toBeDefined();
    expect(commentTriple!.object.type).toBe("literal");
    const obj = commentTriple!.object as { type: "literal"; value: string };
    expect(obj.value).toContain("multi-line comment");
  });

  it("resolves the 'a' keyword to rdf:type", () => {
    const source = [
      "@prefix ex: <http://example.org/ont#> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "ex:Foo a owl:Class .",
    ].join("\n");

    const triples = parseBlockTriples(source, "http://example.org/ont#Foo");
    expect(triples).not.toBeNull();
    const typeTriple = triples!.find(
      (t) => t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    expect(typeTriple).not.toBeNull();
  });

  it("resolves relative IRIs using @base", () => {
    const source = [
      "@base <http://example.org/ont#> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
      "<Cat> a owl:Class ;",
      "    rdfs:subClassOf <Animal> .",
    ].join("\n");

    const triples = parseBlockTriples(source, "http://example.org/ont#Cat");
    expect(triples).not.toBeNull();

    const subClassTriple = triples!.find(
      (t) =>
        t.predicate ===
        "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    );
    expect(subClassTriple!.object).toEqual({
      type: "iri",
      value: "http://example.org/ont#Animal",
    });
  });

  it("handles property with multiple types (comma-separated)", () => {
    const triples = parseBlockTriples(
      TURTLE_COMPLEX,
      "http://example.org/ont#isPartOf",
    );
    expect(triples).not.toBeNull();

    const typeTriples = triples!.filter(
      (t) =>
        t.predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
    const typeIris = typeTriples.map(
      (t) => (t.object as { type: "iri"; value: string }).value,
    );
    expect(typeIris).toContain("http://www.w3.org/2002/07/owl#ObjectProperty");
    expect(typeIris).toContain(
      "http://www.w3.org/2002/07/owl#TransitiveProperty",
    );
  });
});
