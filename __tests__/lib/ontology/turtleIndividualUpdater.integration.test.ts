import { describe, expect, it } from "vitest";
import { updateIndividualInTurtle } from "@/lib/ontology/turtleIndividualUpdater";
import { extractIndividualDetail } from "@/lib/ontology/entityDetailExtractors";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { TURTLE_FIXTURE } from "./fixtures";

const iri = "http://example.org/ont#fido";
const original = extractIndividualDetail(TURTLE_FIXTURE, iri)!;

describe("individual updates through the real writer, parser and detail extractor", () => {
  it.each(["labels", "comments", "definitions"] as const)("omits blank %s while preserving meaningful lexical whitespace and languages", field => {
    const value = { value: "  meaningful text  ", lang: "fr" };
    const updated = updateIndividualInTurtle(TURTLE_FIXTURE, iri, {
      ...original, [field]: [{ value: " \t\n", lang: "en" }, value, { value: "", lang: "" }],
    });
    const parsed = extractIndividualDetail(updated, iri)!;
    expect(parsed[field]).toEqual([value]);
    expect(parsed.typeIris).toEqual(original.typeIris);
    expect(parseBlockTriples(updated, "http://example.org/ont#hasAge")).toEqual(parseBlockTriples(TURTLE_FIXTURE, "http://example.org/ont#hasAge"));
  });

  it("omits blank annotation values while retaining a language-tagged IRI as a literal", () => {
    const property = "http://www.w3.org/2004/02/skos/core#editorialNote";
    const updated = updateIndividualInTurtle(TURTLE_FIXTURE, iri, {
      ...original,
      annotations: [{ property_iri: property, values: [
        { value: "  ", lang: "en" },
        { value: "https://example.test/reference", lang: "en" },
        { value: "", lang: "" },
      ] }],
    });
    expect(extractIndividualDetail(updated, iri)?.annotations).toEqual([
      { property_iri: property, values: [{ value: "https://example.test/reference", lang: "en" }] },
    ]);
    expect(parseBlockTriples(updated, iri)?.find(triple => triple.predicate === property)?.object).toEqual({ type: "literal", value: "https://example.test/reference", lang: "en" });
  });

  it("round-trips a form payload built by the extractor without losing what the form cannot show", () => {
    const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:player a owl:NamedIndividual ;
    rdfs:label "Player"@en ;
    skos:altLabel "Spieler"@de ;
    ex:flag true ;
    ex:origin [ a ex:Place ] .
`;
    const playerIri = "http://example.org/ont#player";
    const detail = extractIndividualDetail(source, playerIri)!;
    const updated = updateIndividualInTurtle(source, playerIri, {
      ...detail,
      labels: [{ value: "Player (renamed)", lang: "en" }],
    });
    expect(updated).toContain("ex:flag true");
    expect(updated).toContain("ex:origin [ a ex:Place ]");
    const reparsed = extractIndividualDetail(updated, playerIri)!;
    expect(reparsed.labels).toEqual([{ value: "Player (renamed)", lang: "en" }]);
    expect(reparsed.annotations).toEqual(detail.annotations);
    expect(updateIndividualInTurtle(updated, playerIri, { ...reparsed })).toBe(updated);
  });

  it("keeps an altLabel the payload omits (AE3)", () => {
    const source = TURTLE_FIXTURE.replace(
      'rdfs:label "Fido"@en ;',
      'rdfs:label "Fido"@en ;\n    skos:altLabel "Spieler"@de ;',
    );
    const updated = updateIndividualInTurtle(source, iri, {
      ...original,
      labels: [{ value: "Fido the Second", lang: "en" }],
      annotations: [],
    });
    expect(extractIndividualDetail(updated, iri)?.annotations).toEqual([
      { property_iri: "http://www.w3.org/2004/02/skos/core#altLabel", values: [{ value: "Spieler", lang: "de" }] },
    ]);
  });
});
