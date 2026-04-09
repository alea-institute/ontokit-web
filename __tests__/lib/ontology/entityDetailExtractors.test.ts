import { describe, it, expect } from "vitest";
import {
  extractPropertyDetail,
  extractIndividualDetail,
} from "@/lib/ontology/entityDetailExtractors";
import {
  TURTLE_FIXTURE,
  TURTLE_PROPERTY_RICH,
  TURTLE_INDIVIDUAL_RICH,
  TURTLE_COMPLEX,
} from "./fixtures";

// ── extractPropertyDetail ──────────────────────────────────────────────

describe("extractPropertyDetail", () => {
  it("returns null when property is not found", () => {
    expect(
      extractPropertyDetail(
        TURTLE_FIXTURE,
        "http://example.org/ont#NonExistent",
      ),
    ).toBeNull();
  });

  it("extracts an object property", () => {
    const detail = extractPropertyDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
    );
    expect(detail).not.toBeNull();
    expect(detail!.propertyType).toBe("object");
    expect(detail!.labels).toEqual([{ value: "has part", lang: "en" }]);
    expect(detail!.domainIris).toEqual(["http://example.org/ont#Animal"]);
    expect(detail!.rangeIris).toEqual(["http://example.org/ont#Animal"]);
  });

  it("extracts a data property", () => {
    const detail = extractPropertyDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasAge",
    );
    expect(detail).not.toBeNull();
    expect(detail!.propertyType).toBe("data");
    expect(detail!.labels).toEqual([{ value: "has age", lang: "en" }]);
    expect(detail!.rangeIris).toEqual([
      "http://www.w3.org/2001/XMLSchema#integer",
    ]);
  });

  it("extracts an annotation property", () => {
    const detail = extractPropertyDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#note",
    );
    expect(detail).not.toBeNull();
    expect(detail!.propertyType).toBe("annotation");
    expect(detail!.labels).toEqual([{ value: "note", lang: "en" }]);
  });

  it("extracts characteristics from type line", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail).not.toBeNull();
    expect(detail!.characteristics).toContain(
      "http://www.w3.org/2002/07/owl#SymmetricProperty",
    );
  });

  it("extracts deprecated flag", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.deprecated).toBe(true);
  });

  it("extracts non-deprecated property", () => {
    const detail = extractPropertyDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
    );
    expect(detail!.deprecated).toBe(false);
  });

  it("extracts domain and range", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.domainIris).toContain("http://example.org/ont#Person");
    expect(detail!.rangeIris).toContain("http://example.org/ont#Person");
  });

  it("extracts subPropertyOf", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.parentIris).toContain("http://example.org/ont#knows");
  });

  it("extracts inverseOf", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.inverseOf).toBe("http://example.org/ont#friendOf");
  });

  it("extracts equivalentProperty", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.equivalentIris).toContain(
      "http://example.org/ont#hasBuddy",
    );
  });

  it("extracts propertyDisjointWith", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.disjointIris).toContain(
      "http://example.org/ont#hasEnemy",
    );
  });

  it("extracts seeAlso", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.seeAlsoIris).toContain(
      "http://example.org/ont#socialRelation",
    );
  });

  it("extracts isDefinedBy", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.isDefinedByIris).toContain("http://example.org/ont");
  });

  it("extracts definitions", () => {
    const detail = extractPropertyDetail(
      TURTLE_PROPERTY_RICH,
      "http://example.org/ont#hasFriend",
    );
    expect(detail!.definitions).toEqual([
      { value: "Relates a person to a friend", lang: "en" },
    ]);
  });

  it("returns null inverseOf when not present", () => {
    const detail = extractPropertyDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#hasPart",
    );
    expect(detail!.inverseOf).toBeNull();
  });

  it("extracts a transitive property characteristic", () => {
    const detail = extractPropertyDetail(
      TURTLE_COMPLEX,
      "http://example.org/ont#isPartOf",
    );
    expect(detail).not.toBeNull();
    expect(detail!.characteristics).toContain(
      "http://www.w3.org/2002/07/owl#TransitiveProperty",
    );
  });
});

// ── extractIndividualDetail ────────────────────────────────────────────

describe("extractIndividualDetail", () => {
  it("returns null when individual is not found", () => {
    expect(
      extractIndividualDetail(
        TURTLE_FIXTURE,
        "http://example.org/ont#NonExistent",
      ),
    ).toBeNull();
  });

  it("extracts a simple individual", () => {
    const detail = extractIndividualDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
    );
    expect(detail).not.toBeNull();
    expect(detail!.labels).toEqual([{ value: "Fido", lang: "en" }]);
    expect(detail!.comments).toEqual([
      { value: "A specific dog", lang: "en" },
    ]);
    expect(detail!.typeIris).toContain("http://example.org/ont#Dog");
  });

  it("excludes owl:NamedIndividual from typeIris", () => {
    const detail = extractIndividualDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
    );
    expect(detail!.typeIris).not.toContain(
      "http://www.w3.org/2002/07/owl#NamedIndividual",
    );
  });

  it("extracts multiple types", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail).not.toBeNull();
    expect(detail!.typeIris).toContain("http://example.org/ont#Person");
    expect(detail!.typeIris).toContain("http://example.org/ont#Employee");
  });

  it("extracts sameAs", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.sameAsIris).toContain("http://example.org/ont#johnDoe");
  });

  it("extracts differentFrom", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.differentFromIris).toContain(
      "http://example.org/ont#janeDoe",
    );
  });

  it("extracts deprecated flag", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.deprecated).toBe(true);
  });

  it("extracts non-deprecated individual", () => {
    const detail = extractIndividualDetail(
      TURTLE_FIXTURE,
      "http://example.org/ont#fido",
    );
    expect(detail!.deprecated).toBe(false);
  });

  it("extracts object property assertions", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    const friendAssertion = detail!.objectPropertyAssertions.find(
      (a) => a.propertyIri === "http://example.org/ont#hasFriend",
    );
    expect(friendAssertion).toBeDefined();
    expect(friendAssertion!.targetIri).toBe("http://example.org/ont#jane");
  });

  it("extracts seeAlso and isDefinedBy", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.seeAlsoIris).toContain(
      "http://example.org/ont#employees",
    );
    expect(detail!.isDefinedByIris).toContain("http://example.org/ont");
  });

  it("extracts definitions", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.definitions).toEqual([{ value: "John Doe", lang: "en" }]);
  });

  it("extracts labels and comments", () => {
    const detail = extractIndividualDetail(
      TURTLE_INDIVIDUAL_RICH,
      "http://example.org/ont#john",
    );
    expect(detail!.labels).toEqual([{ value: "John", lang: "en" }]);
    expect(detail!.comments).toEqual([
      { value: "An employee", lang: "en" },
    ]);
  });
});
