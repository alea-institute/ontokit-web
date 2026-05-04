import { describe, it, expect } from "vitest";
import { updateIndividualInTurtle } from "@/lib/ontology/turtleIndividualUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

describe("updateIndividualInTurtle", () => {
  const baseData = {
    labels: [{ value: "Fido", lang: "en" }],
    comments: [{ value: "A specific dog", lang: "en" }],
    definitions: [],
    typeIris: ["http://example.org/ont#Dog"],
    sameAsIris: [],
    differentFromIris: [],
    objectPropertyAssertions: [],
    dataPropertyAssertions: [],
  };

  it("updates an individual and preserves other blocks", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      baseData,
    );
    expect(result).toContain("a owl:NamedIndividual, ex:Dog");
    expect(result).toContain('rdfs:label "Fido"@en');
    expect(result).toContain('rdfs:comment "A specific dog"@en');

    // Other blocks should be preserved
    expect(result).toContain("ex:Animal a owl:Class");
    expect(result).toContain("ex:Dog a owl:Class");
  });

  it("throws when individual IRI is not found", () => {
    expect(() =>
      updateIndividualInTurtle(
        TURTLE_FIXTURE,
        "http://example.org/ont#NonExistent",
        baseData,
      ),
    ).toThrow(/Could not find individual/);
  });

  it("adds multiple type IRIs", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        typeIris: [
          "http://example.org/ont#Dog",
          "http://example.org/ont#Pet",
        ],
      },
    );
    expect(result).toContain("a owl:NamedIndividual, ex:Dog, ex:Pet");
  });

  it("adds sameAs assertions", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        sameAsIris: ["http://example.org/ont#fidoClone"],
      },
    );
    expect(result).toContain("owl:sameAs");
  });

  it("adds differentFrom assertions", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        differentFromIris: ["http://example.org/ont#rex"],
      },
    );
    expect(result).toContain("owl:differentFrom");
  });

  it("adds object property assertions", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasPart",
            targetIri: "http://example.org/ont#tail",
          },
        ],
      },
    );
    expect(result).toContain("ex:hasPart ex:tail");
  });

  it("adds data property assertions with language tag", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasNickname",
            value: "Buddy",
            lang: "en",
          },
        ],
      },
    );
    expect(result).toContain('"Buddy"@en');
  });

  it("adds data property assertions with datatype", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasAge",
            value: "5",
            datatype: "http://www.w3.org/2001/XMLSchema#integer",
          },
        ],
      },
    );
    expect(result).toContain('"5"^^xsd:integer');
  });

  it("adds data property assertions without lang or datatype", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasCode",
            value: "ABC123",
          },
        ],
      },
    );
    expect(result).toContain('"ABC123"');
  });

  it("adds deprecated flag", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        deprecated: true,
      },
    );
    expect(result).toContain("owl:deprecated true");
  });

  it("adds definitions", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        definitions: [{ value: "A particular dog named Fido", lang: "en" }],
      },
    );
    expect(result).toContain("skos:definition");
  });

  it("adds seeAlso and isDefinedBy", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        seeAlsoIris: ["http://example.org/ont#dogs"],
        isDefinedByIris: ["http://example.org/ont"],
      },
    );
    expect(result).toContain("rdfs:seeAlso");
    expect(result).toContain("rdfs:isDefinedBy");
  });

  it("adds annotations with literal values", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        annotations: [
          {
            property_iri:
              "http://www.w3.org/2004/02/skos/core#editorialNote",
            values: [{ value: "Needs review", lang: "en" }],
          },
        ],
      },
    );
    expect(result).toContain("skos:editorialNote");
  });

  it("adds annotations with IRI values", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        annotations: [
          {
            property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            values: [
              { value: "http://example.org/ont#dogs", lang: "" },
            ],
          },
        ],
      },
    );
    expect(result).toContain("rdfs:seeAlso");
  });

  it("skips object property assertions without targetIri", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        objectPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasPart",
            // no targetIri
          },
        ],
      },
    );
    // hasPart should not appear since targetIri is missing
    const fidoBlock = result.slice(
      result.indexOf("ex:fido"),
      result.indexOf(".", result.indexOf("ex:fido")) + 1,
    );
    expect(fidoBlock).not.toContain("ex:hasPart");
  });

  it("skips data property assertions without value", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        ...baseData,
        dataPropertyAssertions: [
          {
            propertyIri: "http://example.org/ont#hasAge",
            // no value
          },
        ],
      },
    );
    const fidoBlock = result.slice(
      result.indexOf("ex:fido"),
      result.indexOf(".", result.indexOf("ex:fido")) + 1,
    );
    expect(fidoBlock).not.toContain("ex:hasAge");
  });

  it("generates single-line block when only type present", () => {
    const result = updateIndividualInTurtle(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
      {
        labels: [],
        comments: [],
        definitions: [],
        typeIris: [],
        sameAsIris: [],
        differentFromIris: [],
        objectPropertyAssertions: [],
        dataPropertyAssertions: [],
      },
    );
    expect(result).toContain("ex:fido a owl:NamedIndividual .");
  });
});
