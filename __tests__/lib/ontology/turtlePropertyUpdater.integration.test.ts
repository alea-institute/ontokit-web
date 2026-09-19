import { describe, expect, it } from "vitest";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { TURTLE_FIXTURE } from "./fixtures";

const iri = "http://example.org/ont#hasPart";
const original = extractPropertyDetail(TURTLE_FIXTURE, iri)!;

describe("property updates through the real writer, parser and detail extractor", () => {
  it.each(["labels", "comments", "definitions"] as const)("omits blank %s while preserving meaningful lexical whitespace and languages", field => {
    const value = { value: "  meaningful text  ", lang: "fr" };
    const updated = updatePropertyInTurtle(TURTLE_FIXTURE, iri, {
      ...original, [field]: [{ value: " \t\n", lang: "en" }, value, { value: "", lang: "" }],
    });
    const parsed = extractPropertyDetail(updated, iri)!;
    expect(parsed[field]).toEqual([value]);
    expect(parsed.domainIris).toEqual(original.domainIris);
    expect(parsed.rangeIris).toEqual(original.rangeIris);
    expect(extractPropertyDetail(updated, "http://example.org/ont#hasAge")).toEqual(extractPropertyDetail(TURTLE_FIXTURE, "http://example.org/ont#hasAge"));
  });

  it("omits blank annotation values while retaining a language-tagged IRI as a literal", () => {
    const property = "http://www.w3.org/2004/02/skos/core#editorialNote";
    const updated = updatePropertyInTurtle(TURTLE_FIXTURE, iri, {
      ...original,
      annotations: [{ property_iri: property, values: [
        { value: "  ", lang: "en" },
        { value: "https://example.test/reference", lang: "en" },
        { value: "", lang: "" },
      ] }],
    });
    expect(extractPropertyDetail(updated, iri)?.annotations).toEqual([
      { property_iri: property, values: [{ value: "https://example.test/reference", lang: "en" }] },
    ]);
    expect(parseBlockTriples(updated, iri)?.find(triple => triple.predicate === property)?.object).toEqual({ type: "literal", value: "https://example.test/reference", lang: "en" });
  });

  it("ignores unknown characteristics while retaining recognized OWL types", () => {
    const functional = "http://www.w3.org/2002/07/owl#FunctionalProperty";
    const updated = updatePropertyInTurtle(TURTLE_FIXTURE, iri, {
      ...original, characteristics: ["https://example.test/UnknownCharacteristic", functional],
    });
    expect(extractPropertyDetail(updated, iri)?.characteristics).toEqual([functional]);
    expect(extractPropertyDetail(updated, iri)?.propertyType).toBe("object");
    expect(updated).not.toContain("UnknownCharacteristic");
    expect(updated).not.toContain("undefined");
  });
});
