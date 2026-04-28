import { describe, expect, it } from "vitest";

import {
  buildSelectionQuery,
  readSelectionFromSearchParams,
  SELECTION_PARAM_BY_TYPE,
} from "@/lib/utils/selectionUrl";

describe("readSelectionFromSearchParams", () => {
  it("reads a class IRI", () => {
    const params = new URLSearchParams("classIri=http%3A%2F%2Fexample.org%2FPerson");
    expect(readSelectionFromSearchParams(params)).toEqual({
      iri: "http://example.org/Person",
      type: "class",
    });
  });

  it("reads a property IRI", () => {
    const params = new URLSearchParams("propertyIri=http%3A%2F%2Fexample.org%2FhasName");
    expect(readSelectionFromSearchParams(params)).toEqual({
      iri: "http://example.org/hasName",
      type: "property",
    });
  });

  it("reads an individual IRI", () => {
    const params = new URLSearchParams("individualIri=http%3A%2F%2Fexample.org%2Falice");
    expect(readSelectionFromSearchParams(params)).toEqual({
      iri: "http://example.org/alice",
      type: "individual",
    });
  });

  it("returns null when no selection key is present", () => {
    expect(readSelectionFromSearchParams(new URLSearchParams(""))).toBeNull();
    expect(readSelectionFromSearchParams(new URLSearchParams("foo=bar"))).toBeNull();
  });

  it("honors the class > property > individual priority when more than one is set", () => {
    const params = new URLSearchParams(
      "individualIri=ex%3Aalice&propertyIri=ex%3AhasName&classIri=ex%3APerson",
    );
    expect(readSelectionFromSearchParams(params)).toEqual({
      iri: "ex:Person",
      type: "class",
    });

    const params2 = new URLSearchParams("individualIri=ex%3Aalice&propertyIri=ex%3AhasName");
    expect(readSelectionFromSearchParams(params2)).toEqual({
      iri: "ex:hasName",
      type: "property",
    });
  });
});

describe("buildSelectionQuery", () => {
  it("returns an empty string when selection is null", () => {
    expect(buildSelectionQuery(null)).toBe("");
  });

  it("returns an empty string when the IRI is empty", () => {
    expect(buildSelectionQuery({ iri: "", type: "class" })).toBe("");
  });

  it("encodes the IRI under the matching key", () => {
    expect(buildSelectionQuery({ iri: "http://example.org/Person", type: "class" })).toBe(
      "?classIri=http%3A%2F%2Fexample.org%2FPerson",
    );
    expect(buildSelectionQuery({ iri: "http://example.org/hasName", type: "property" })).toBe(
      "?propertyIri=http%3A%2F%2Fexample.org%2FhasName",
    );
    expect(buildSelectionQuery({ iri: "http://example.org/alice", type: "individual" })).toBe(
      "?individualIri=http%3A%2F%2Fexample.org%2Falice",
    );
  });

  it("round-trips through readSelectionFromSearchParams", () => {
    const selection = { iri: "http://example.org/Person", type: "class" } as const;
    const params = new URLSearchParams(buildSelectionQuery(selection).slice(1));
    expect(readSelectionFromSearchParams(params)).toEqual(selection);
  });
});

describe("SELECTION_PARAM_BY_TYPE", () => {
  it("maps each entity type to its expected key", () => {
    expect(SELECTION_PARAM_BY_TYPE.class).toBe("classIri");
    expect(SELECTION_PARAM_BY_TYPE.property).toBe("propertyIri");
    expect(SELECTION_PARAM_BY_TYPE.individual).toBe("individualIri");
  });
});
