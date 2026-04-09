import { describe, it, expect } from "vitest";
import {
  getAnnotationPropertyInfo,
  getAnnotationPropertyLabel,
  getAnnotationPropertiesByVocabulary,
  ANNOTATION_PROPERTIES,
  LABEL_IRI,
  COMMENT_IRI,
  DEFINITION_IRI,
  SEE_ALSO_IRI,
  IS_DEFINED_BY_IRI,
  RELATIONSHIP_PROPERTY_IRIS,
} from "@/lib/ontology/annotationProperties";

// ── getAnnotationPropertyInfo ──────────────────────────────────────────

describe("getAnnotationPropertyInfo", () => {
  it("returns displayLabel and curie for a known SKOS property", () => {
    const info = getAnnotationPropertyInfo(
      "http://www.w3.org/2004/02/skos/core#prefLabel",
    );
    expect(info.displayLabel).toBe("Preferred Label");
    expect(info.curie).toBe("skos:prefLabel");
  });

  it("returns displayLabel and curie for a known DC Elements property", () => {
    const info = getAnnotationPropertyInfo(
      "http://purl.org/dc/elements/1.1/creator",
    );
    expect(info.displayLabel).toBe("Creator");
    expect(info.curie).toBe("dc:creator");
  });

  it("returns displayLabel and curie for a known DC Terms property", () => {
    const info = getAnnotationPropertyInfo(
      "http://purl.org/dc/terms/license",
    );
    expect(info.displayLabel).toBe("License");
    expect(info.curie).toBe("dcterms:license");
  });

  it("returns displayLabel and curie for RDFS seeAlso", () => {
    const info = getAnnotationPropertyInfo(
      "http://www.w3.org/2000/01/rdf-schema#seeAlso",
    );
    expect(info.displayLabel).toBe("See Also");
    expect(info.curie).toBe("rdfs:seeAlso");
  });

  it("falls back to local name for unknown IRI with hash", () => {
    const info = getAnnotationPropertyInfo(
      "http://example.org/ont#customProp",
    );
    expect(info.displayLabel).toBe("customProp");
    expect(info.curie).toBe("customProp");
  });

  it("falls back to last path segment for unknown IRI without hash", () => {
    const info = getAnnotationPropertyInfo(
      "http://example.org/props/myProperty",
    );
    expect(info.displayLabel).toBe("myProperty");
    expect(info.curie).toBe("myProperty");
  });
});

// ── getAnnotationPropertyLabel (deprecated) ────────────────────────────

describe("getAnnotationPropertyLabel", () => {
  it("returns the display label for a known property", () => {
    expect(
      getAnnotationPropertyLabel(
        "http://www.w3.org/2004/02/skos/core#definition",
      ),
    ).toBe("Definition");
  });

  it("falls back to local name for unknown property", () => {
    expect(
      getAnnotationPropertyLabel("http://example.org/ont#unknownProp"),
    ).toBe("unknownProp");
  });
});

// ── getAnnotationPropertiesByVocabulary ─────────────────────────────────

describe("getAnnotationPropertiesByVocabulary", () => {
  it("groups properties by vocabulary", () => {
    const groups = getAnnotationPropertiesByVocabulary();
    expect(groups).toHaveProperty("SKOS");
    expect(groups).toHaveProperty("DC Elements");
    expect(groups).toHaveProperty("DC Terms");
    expect(groups).toHaveProperty("RDFS");
  });

  it("SKOS group contains prefLabel", () => {
    const groups = getAnnotationPropertiesByVocabulary();
    const skosIris = groups["SKOS"].map((p) => p.iri);
    expect(skosIris).toContain(
      "http://www.w3.org/2004/02/skos/core#prefLabel",
    );
  });

  it("DC Elements group contains creator", () => {
    const groups = getAnnotationPropertiesByVocabulary();
    const dcIris = groups["DC Elements"].map((p) => p.iri);
    expect(dcIris).toContain("http://purl.org/dc/elements/1.1/creator");
  });

  it("all properties are included in some group", () => {
    const groups = getAnnotationPropertiesByVocabulary();
    const totalGrouped = Object.values(groups).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalGrouped).toBe(ANNOTATION_PROPERTIES.length);
  });

  it("each property in a group has the correct vocabulary key", () => {
    const groups = getAnnotationPropertiesByVocabulary();
    for (const [vocab, props] of Object.entries(groups)) {
      for (const prop of props) {
        expect(prop.vocabulary).toBe(vocab);
      }
    }
  });
});

// ── Exported constants ─────────────────────────────────────────────────

describe("exported constants", () => {
  it("LABEL_IRI is the rdfs:label IRI", () => {
    expect(LABEL_IRI).toBe("http://www.w3.org/2000/01/rdf-schema#label");
  });

  it("COMMENT_IRI is the rdfs:comment IRI", () => {
    expect(COMMENT_IRI).toBe("http://www.w3.org/2000/01/rdf-schema#comment");
  });

  it("DEFINITION_IRI is the skos:definition IRI", () => {
    expect(DEFINITION_IRI).toBe(
      "http://www.w3.org/2004/02/skos/core#definition",
    );
  });

  it("SEE_ALSO_IRI is the rdfs:seeAlso IRI", () => {
    expect(SEE_ALSO_IRI).toBe(
      "http://www.w3.org/2000/01/rdf-schema#seeAlso",
    );
  });

  it("IS_DEFINED_BY_IRI is the rdfs:isDefinedBy IRI", () => {
    expect(IS_DEFINED_BY_IRI).toBe(
      "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
    );
  });

  it("RELATIONSHIP_PROPERTY_IRIS contains seeAlso and isDefinedBy", () => {
    expect(RELATIONSHIP_PROPERTY_IRIS.has(SEE_ALSO_IRI)).toBe(true);
    expect(RELATIONSHIP_PROPERTY_IRIS.has(IS_DEFINED_BY_IRI)).toBe(true);
    expect(RELATIONSHIP_PROPERTY_IRIS.size).toBe(2);
  });
});
