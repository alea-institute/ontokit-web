import { describe, it, expect } from "vitest";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

describe("updatePropertyInTurtle", () => {
  const baseData = {
    propertyType: "object" as const,
    labels: [{ value: "has part", lang: "en" }],
    comments: [],
    definitions: [],
    domainIris: ["http://example.org/ont#Animal"],
    rangeIris: ["http://example.org/ont#Animal"],
    parentIris: [],
    inverseOf: null,
    characteristics: [],
  };

  it("updates an object property", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      baseData,
    );
    expect(result).toContain("a owl:ObjectProperty");
    expect(result).toContain('rdfs:label "has part"@en');
    expect(result).toContain("rdfs:domain ex:Animal");
    expect(result).toContain("rdfs:range ex:Animal");
  });

  it("throws when property IRI is not found", () => {
    expect(() =>
      updatePropertyInTurtle(
        TURTLE_FIXTURE,
        "http://example.org/ont#NonExistent",
        baseData,
      ),
    ).toThrow(/Could not find property/);
  });

  it("generates a data property block", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasAge",
      {
        ...baseData,
        propertyType: "data",
        labels: [{ value: "has age", lang: "en" }],
        rangeIris: ["http://www.w3.org/2001/XMLSchema#integer"],
      },
    );
    expect(result).toContain("a owl:DatatypeProperty");
  });

  it("generates an annotation property block", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#note",
      {
        ...baseData,
        propertyType: "annotation",
        labels: [{ value: "note", lang: "en" }],
        domainIris: [],
        rangeIris: [],
      },
    );
    expect(result).toContain("a owl:AnnotationProperty");
  });

  it("adds characteristics to type line", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        characteristics: [
          "http://www.w3.org/2002/07/owl#FunctionalProperty",
          "http://www.w3.org/2002/07/owl#TransitiveProperty",
        ],
      },
    );
    expect(result).toContain(
      "a owl:ObjectProperty, owl:FunctionalProperty, owl:TransitiveProperty",
    );
  });

  it("adds inverseOf", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        inverseOf: "http://example.org/ont#isPartOf",
      },
    );
    expect(result).toContain("owl:inverseOf ex:isPartOf");
  });

  it("adds parent properties", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        parentIris: ["http://example.org/ont#relatedTo"],
      },
    );
    expect(result).toContain("rdfs:subPropertyOf");
  });

  it("adds deprecated flag", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        deprecated: true,
      },
    );
    expect(result).toContain("owl:deprecated true");
  });

  it("adds equivalent properties", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        equivalentIris: ["http://example.org/ont#hasPiece"],
      },
    );
    expect(result).toContain("owl:equivalentProperty");
  });

  it("adds disjoint properties", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        disjointIris: ["http://example.org/ont#hasWhole"],
      },
    );
    expect(result).toContain("owl:propertyDisjointWith");
  });

  it("adds seeAlso and isDefinedBy", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        seeAlsoIris: ["http://example.org/ont#composition"],
        isDefinedByIris: ["http://example.org/ont"],
      },
    );
    expect(result).toContain("rdfs:seeAlso");
    expect(result).toContain("rdfs:isDefinedBy");
  });

  it("adds definitions", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        definitions: [{ value: "Relates a whole to its parts", lang: "en" }],
      },
    );
    expect(result).toContain("skos:definition");
  });

  it("adds annotations with literal values", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        ...baseData,
        annotations: [
          {
            property_iri:
              "http://www.w3.org/2004/02/skos/core#editorialNote",
            values: [{ value: "Review needed", lang: "en" }],
          },
        ],
      },
    );
    expect(result).toContain("skos:editorialNote");
  });

  it("preserves other blocks when updating a property", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      baseData,
    );
    // Other blocks should remain
    expect(result).toContain("ex:Animal a owl:Class");
    expect(result).toContain("ex:Dog a owl:Class");
    expect(result).toContain("ex:fido a owl:NamedIndividual");
  });

  it("generates single-line block when only type present", () => {
    const result = updatePropertyInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
      {
        propertyType: "object",
        labels: [],
        comments: [],
        definitions: [],
        domainIris: [],
        rangeIris: [],
        parentIris: [],
        inverseOf: null,
        characteristics: [],
      },
    );
    expect(result).toContain("ex:hasPart a owl:ObjectProperty .");
  });
});
