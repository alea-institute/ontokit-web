import { describe, it, expect } from "vitest";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

describe("updateClassInTurtle", () => {
  const baseData = {
    labels: [{ value: "Dog", lang: "en" }],
    comments: [{ value: "A domesticated canine", lang: "en" }],
    parent_iris: ["http://example.org/ont#Animal"],
  };

  it("updates a class and preserves other blocks", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      baseData,
    );
    // Dog block should still exist
    expect(result).toContain("ex:Dog");
    expect(result).toContain('rdfs:label "Dog"@en');
    expect(result).toContain("rdfs:subClassOf ex:Animal");

    // Animal block should be untouched
    expect(result).toContain('rdfs:label "Animal"@en');
    expect(result).toContain('rdfs:comment "A living organism"@en');
  });

  it("throws when class IRI is not found", () => {
    expect(() =>
      updateClassInTurtle(
        TURTLE_FIXTURE,
        "http://example.org/ont#NonExistent",
        baseData,
      ),
    ).toThrow(/Could not find class/);
  });

  it("updates labels", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Hund", lang: "de" },
        ],
        comments: [],
        parent_iris: [],
      },
    );
    expect(result).toContain('"Dog"@en');
    expect(result).toContain('"Hund"@de');
  });

  it("removes comments when given empty array", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        labels: [{ value: "Dog", lang: "en" }],
        comments: [],
        parent_iris: ["http://example.org/ont#Animal"],
      },
    );
    // Extract just the Dog block to check it has no comment
    const dogBlockStart = result.indexOf("ex:Dog");
    const dogBlockEnd = result.indexOf(".", dogBlockStart);
    const dogBlock = result.slice(dogBlockStart, dogBlockEnd + 1);
    expect(dogBlock).not.toContain("rdfs:comment");
    // But the Animal block's comment should still be present
    expect(result).toContain("A living organism");
  });

  it("removes parent classes when given empty array", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        labels: [{ value: "Dog", lang: "en" }],
        comments: [],
        parent_iris: [],
      },
    );
    // Dog block should not have subClassOf
    const dogBlockStart = result.indexOf("ex:Dog");
    const dogBlockEnd = result.indexOf(".", dogBlockStart);
    const dogBlock = result.slice(dogBlockStart, dogBlockEnd + 1);
    expect(dogBlock).not.toContain("rdfs:subClassOf");
  });

  it("adds deprecated flag", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        ...baseData,
        deprecated: true,
      },
    );
    expect(result).toContain("owl:deprecated true");
  });

  it("adds equivalent classes", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        ...baseData,
        equivalent_iris: ["http://example.org/ont#Canine"],
      },
    );
    expect(result).toContain("owl:equivalentClass");
  });

  it("adds disjoint classes", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        ...baseData,
        disjoint_iris: ["http://example.org/ont#Cat"],
      },
    );
    expect(result).toContain("owl:disjointWith");
  });

  it("adds annotations", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        ...baseData,
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#prefLabel",
            values: [{ value: "Dog", lang: "en" }],
          },
        ],
      },
    );
    expect(result).toContain("skos:prefLabel");
    expect(result).toContain('"Dog"@en');
  });

  it("handles annotation with IRI value", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        ...baseData,
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            values: [{ value: "http://example.org/ont#Canine", lang: "" }],
          },
        ],
      },
    );
    expect(result).toContain("rdfs:seeAlso");
  });

  it("skips empty label values", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "   ", lang: "de" },
        ],
        comments: [],
        parent_iris: [],
      },
    );
    // The result includes the Animal block's label too
    const dogBlockStart = result.indexOf("ex:Dog");
    const dogBlockEnd = result.indexOf(".", dogBlockStart);
    const dogBlock = result.slice(dogBlockStart, dogBlockEnd + 1);
    expect((dogBlock.match(/rdfs:label/g) || []).length).toBe(1);
  });

  it("generates single-line block when only type is present", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      {
        labels: [],
        comments: [],
        parent_iris: [],
      },
    );
    expect(result).toContain("ex:Dog a owl:Class .");
  });

  it("preserves prefix declarations", () => {
    const result = updateClassInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#Dog",
      baseData,
    );
    expect(result).toContain("@prefix ex:");
    expect(result).toContain("@prefix owl:");
    expect(result).toContain("@prefix rdfs:");
  });
});
