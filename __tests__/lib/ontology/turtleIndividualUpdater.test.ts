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

  describe("preserves predicates the payload does not describe (#361)", () => {
    const IRI = "http://example.org/ont#player";
    const PREAMBLE = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ontokit: <https://ontokit.org/ns#> .

ex:hasScore a owl:DatatypeProperty .

ex:knows a owl:ObjectProperty .
`;
    const SOURCE = `${PREAMBLE}
ex:player a owl:NamedIndividual, ex:Person ;
    rdfs:label "Player"@en ;
    skos:altLabel "Spieler"@de, "Joueur"@fr, "Jugador"@es ;
    skos:altLabel "Giocatore"@it ;
    ex:customNote "kept verbatim" ;
    ex:flag true ;
    ex:origin [ a ex:Place ; rdfs:label "Somewhere"@en ] ;
    ex:knows ex:coach ;
    ex:hasScore "7"^^xsd:integer .

ex:coach a owl:NamedIndividual ;
    rdfs:label "Coach"@en .

[] a owl:Axiom ;
    owl:annotatedSource ex:player ;
    owl:annotatedProperty skos:altLabel ;
    owl:annotatedTarget "Spieler"@de ;
    ontokit:recordDigest "alt-digest" .

[] a owl:Axiom ;
    owl:annotatedSource ex:player ;
    owl:annotatedProperty rdfs:label ;
    owl:annotatedTarget "Player"@en ;
    ontokit:recordDigest "label-digest" .
`;
    const formData = {
      labels: [{ value: "Player (renamed)", lang: "en" }],
      comments: [],
      definitions: [],
      typeIris: ["http://example.org/ont#Person"],
      sameAsIris: [],
      differentFromIris: [],
      objectPropertyAssertions: [
        { propertyIri: "http://example.org/ont#knows", targetIri: "http://example.org/ont#coach" },
      ],
      dataPropertyAssertions: [
        {
          propertyIri: "http://example.org/ont#hasScore",
          value: "7",
          datatype: "http://www.w3.org/2001/XMLSchema#integer",
        },
      ],
    };
    const playerBlock = (source: string) => {
      const start = source.indexOf("ex:player a");
      return source.slice(start, source.indexOf(" .\n", start) + 2);
    };

    it("keeps altLabels in every language when only the label changes (AE3)", () => {
      const result = updateIndividualInTurtle(SOURCE, IRI, formData);
      const block = playerBlock(result);
      expect(block).toContain('rdfs:label "Player (renamed)"@en');
      expect(block).not.toContain('"Player"@en');
      expect(block).toContain('skos:altLabel "Spieler"@de, "Joueur"@fr, "Jugador"@es');
      expect(block).toContain('skos:altLabel "Giocatore"@it');
    });

    it("keeps an unknown custom predicate and an undeclared boolean", () => {
      const block = playerBlock(updateIndividualInTurtle(SOURCE, IRI, formData));
      expect(block).toContain('ex:customNote "kept verbatim"');
      expect(block).toContain("ex:flag true");
    });

    it("keeps a blank-node object on a carried predicate", () => {
      const block = playerBlock(updateIndividualInTurtle(SOURCE, IRI, formData));
      expect(block).toContain('ex:origin [ a ex:Place ; rdfs:label "Somewhere"@en ]');
    });

    it("does not choke on the blank-node pseudo-assertion the extractor surfaces", () => {
      const result = updateIndividualInTurtle(SOURCE, IRI, {
        ...formData,
        objectPropertyAssertions: [
          ...formData.objectPropertyAssertions,
          { propertyIri: "http://example.org/ont#origin", targetIri: '[ a ex:Place ; rdfs:label "Somewhere"@en ]' },
        ],
      });
      const block = playerBlock(result);
      expect(block.match(/ex:origin/g)).toHaveLength(1);
      expect(block).toContain('ex:origin [ a ex:Place ; rdfs:label "Somewhere"@en ]');
    });

    it("replaces a described predicate instead of duplicating it", () => {
      const block = playerBlock(updateIndividualInTurtle(SOURCE, IRI, {
        ...formData,
        annotations: [{
          property_iri: "http://www.w3.org/2004/02/skos/core#altLabel",
          values: [{ value: "Spielerin", lang: "de" }],
        }],
        objectPropertyAssertions: [
          { propertyIri: "http://example.org/ont#knows", targetIri: "http://example.org/ont#referee" },
        ],
      }));
      expect(block.match(/skos:altLabel/g)).toHaveLength(1);
      expect(block).toContain('skos:altLabel "Spielerin"@de');
      expect(block).not.toContain("Spieler\"@de");
      expect(block).not.toContain("Giocatore");
      expect(block.match(/ex:knows/g)).toHaveLength(1);
      expect(block).toContain("ex:knows ex:referee");
      expect(block.match(/ex:hasScore/g)).toHaveLength(1);
      expect(block.match(/rdfs:label/g)).toHaveLength(2); // own label + blank-node label
    });

    it("honours removal of every assertion for a property the form shows", () => {
      const block = playerBlock(updateIndividualInTurtle(SOURCE, IRI, {
        ...formData,
        objectPropertyAssertions: [],
        dataPropertyAssertions: [],
      }));
      expect(block).not.toContain("ex:knows");
      expect(block).not.toContain("ex:hasScore");
      expect(block).toContain('ex:customNote "kept verbatim"');
    });

    it("works for full-IRI and :local subject forms and keeps the subject spelling", () => {
      const fullSource = SOURCE.replace("ex:player a", "<http://example.org/ont#player> a");
      const fullResult = updateIndividualInTurtle(fullSource, IRI, formData);
      expect(fullResult).toContain("<http://example.org/ont#player> a owl:NamedIndividual, ex:Person ;");
      expect(fullResult).toContain('skos:altLabel "Giocatore"@it');
      expect(fullResult).toContain('ex:customNote "kept verbatim"');

      const localSource = SOURCE
        .replace("@prefix ex: <http://example.org/ont#> .", "@prefix : <http://example.org/ont#> .\n@prefix ex: <http://example.org/ont#> .")
        .replace("ex:player a", ":player a");
      const localResult = updateIndividualInTurtle(localSource, IRI, formData);
      expect(localResult).toContain(":player a owl:NamedIndividual");
      expect(localResult).toContain('skos:altLabel "Giocatore"@it');
      expect(localResult).toContain('ex:customNote "kept verbatim"');
    });

    it("is idempotent: saving the same payload twice is byte-identical", () => {
      const once = updateIndividualInTurtle(SOURCE, IRI, formData);
      const twice = updateIndividualInTurtle(once, IRI, formData);
      expect(twice).toBe(once);
    });

    it("leaves sibling blocks byte-identical", () => {
      const result = updateIndividualInTurtle(SOURCE, IRI, formData);
      expect(result.startsWith(PREAMBLE)).toBe(true);
      expect(result).toContain('ex:coach a owl:NamedIndividual ;\n    rdfs:label "Coach"@en .\n');
    });

    it("keeps provenance for carried literals and drops it only for deleted described literals", () => {
      const result = updateIndividualInTurtle(SOURCE, IRI, formData);
      expect(result).toContain('ontokit:recordDigest "alt-digest"');
      expect(result).not.toContain('ontokit:recordDigest "label-digest"');

      const kept = updateIndividualInTurtle(SOURCE, IRI, {
        ...formData,
        labels: [{ value: "Player", lang: "en" }],
      });
      expect(kept).toContain('ontokit:recordDigest "label-digest"');
    });
  });
});
