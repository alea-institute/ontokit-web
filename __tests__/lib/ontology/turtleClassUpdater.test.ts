import { describe, it, expect } from "vitest";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

describe("updateClassInTurtle", () => {
  const baseData = {
    labels: [{ value: "Dog", lang: "en" }],
    comments: [{ value: "A domesticated canine", lang: "en" }],
    parent_iris: ["http://example.org/ont#Animal"],
  };

  describe("characterization: class block regeneration", () => {
    it("preserves 13 alt labels across nine languages when only the label is edited", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Actor a owl:Class ;
    rdfs:label "Actor / Player" ;
    skos:altLabel "Actor", "Player", "Player Role",
        "Schauspieler / Spieler"@de-de, "Actor / Player"@en-gb,
        "Actor / Jugador"@es-es, "Actor / Jugador"@es-mx,
        "Acteur / Joueur"@fr-fr, "שחקן"@he,
        "अभिनेता / खिलाड़ी"@hi, "アクター / プレイヤー"@ja,
        "Ator / Jogador"@pt-br, "演员 / 参与者"@zh-cn ;
    rdfs:subClassOf owl:Thing .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Actor", {
        labels: [{ value: "Actor and Player", lang: "" }],
        comments: [],
        parent_iris: ["http://www.w3.org/2002/07/owl#Thing"],
      });

      expect(result).toContain(`skos:altLabel "Actor", "Player", "Player Role",
        "Schauspieler / Spieler"@de-de, "Actor / Player"@en-gb,
        "Actor / Jugador"@es-es, "Actor / Jugador"@es-mx,
        "Acteur / Joueur"@fr-fr, "שחקן"@he,
        "अभिनेता / खिलाड़ी"@hi, "アクター / プレイヤー"@ja,
        "Ator / Jogador"@pt-br, "演员 / 参与者"@zh-cn`);
      expect(result.match(/skos:altLabel/g)).toHaveLength(1);
    });

    it("removes a payload-described annotation when its values are emptied", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    skos:altLabel "Hound"@en .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Dog", {
        labels: [{ value: "Dog", lang: "en" }],
        comments: [],
        parent_iris: [],
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#altLabel",
            values: [],
          },
        ],
      });

      expect(result).not.toContain("skos:altLabel");
    });

    it("preserves datatyped literals and IRI-valued objects absent from the payload", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    ex:rank "7"^^xsd:integer ;
    rdfs:seeAlso <https://example.net/dogs> .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Dog", {
        labels: [{ value: "Canine", lang: "en" }],
        comments: [],
        parent_iris: [],
      });

      expect(result).toContain('ex:rank "7"^^xsd:integer');
      expect(result).toContain("rdfs:seeAlso <https://example.net/dogs>");
    });

    it("keeps canonical output byte-identical when the class has no extra predicates", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:comment "A canine"@en ;
    rdfs:subClassOf ex:Animal .`;

      expect(
        updateClassInTurtle(source, "http://example.org/ont#Dog", {
          labels: [{ value: "Dog", lang: "en" }],
          comments: [{ value: "A canine", lang: "en" }],
          parent_iris: ["http://example.org/ont#Animal"],
        }),
      ).toBe(source);
    });

    it("changes only the edited field's line when other predicates are present", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    skos:altLabel "Hound"@en ;
    rdfs:seeAlso ex:Canine .`;
      const expected = source.replace('rdfs:label "Dog"@en', 'rdfs:label "Canine"@en');

      const result = updateClassInTurtle(source, "http://example.org/ont#Dog", {
        labels: [{ value: "Canine", lang: "en" }],
        comments: [],
        parent_iris: [],
      });

      expect(result).toBe(expected);
    });

    it("regenerates the target block in the existing canonical order and indentation", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:comment "old comment"@en ;
    rdfs:label "old label"@en .

ex:Cat a owl:Class .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Dog", {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Hund", lang: "de" },
        ],
        comments: [{ value: "A canine", lang: "en" }],
        parent_iris: ["http://example.org/ont#Animal"],
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#altLabel",
            values: [{ value: "Hound", lang: "en" }],
          },
        ],
      });

      expect(result).toBe(`@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:label "Hund"@de ;
    rdfs:comment "A canine"@en ;
    rdfs:subClassOf ex:Animal ;
    skos:altLabel "Hound"@en .

ex:Cat a owl:Class .`);
    });

    it("replaces all continuation lines without consuming the following block", () => {
      const source = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Dog
    a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:comment "line one"@en ;
    rdfs:subClassOf
        ex:Animal .
ex:Cat a owl:Class ;
    rdfs:label "Cat"@en .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Dog", {
        labels: [{ value: "Updated dog", lang: "en" }],
        comments: [],
        parent_iris: [],
      });

      expect(result).toContain(`ex:Dog a owl:Class ;
    rdfs:label "Updated dog"@en .`);
      expect(result).not.toContain("line one");
      expect(result).toContain(`ex:Cat a owl:Class ;
    rdfs:label "Cat"@en .`);
    });
  });

  describe("translation provenance axiom blocks", () => {
    const sourceWithAxioms = `@prefix ex: <http://example.org/ont#> .
@prefix ontokit: <https://ontokit.org/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:label "Chien"@fr ;
    skos:altLabel "Toutou"@fr .

[] a owl:Axiom ;
    owl:annotatedSource ex:Dog ;
    owl:annotatedProperty rdfs:label ;
    owl:annotatedTarget "Chien"@fr ;
    ontokit:translationState "verified" ;
    ontokit:recordDigest "label-digest" .

[] a owl:Axiom ;
    owl:annotatedSource ex:Dog ;
    owl:annotatedProperty skos:altLabel ;
    owl:annotatedTarget "Toutou"@fr ;
    ontokit:translationState "provisional" ;
    ontokit:recordDigest "alt-digest" .

[] a owl:Axiom ;
    owl:annotatedSource ex:Cat ;
    owl:annotatedProperty rdfs:label ;
    owl:annotatedTarget "Chat"@fr ;
    ontokit:recordDigest "cat-digest" .`;

    it("retains every matching axiom block when an unrelated annotation changes", () => {
      const result = updateClassInTurtle(sourceWithAxioms, "http://example.org/ont#Dog", {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Chien", lang: "fr" },
        ],
        comments: [{ value: "A domesticated canine", lang: "en" }],
        parent_iris: [],
        annotations: [
          {
            property_iri: "http://www.w3.org/2004/02/skos/core#altLabel",
            values: [{ value: "Toutou", lang: "fr" }],
          },
        ],
      });

      expect(result).toContain('ontokit:recordDigest "label-digest"');
      expect(result).toContain('ontokit:recordDigest "alt-digest"');
      expect(result).toContain('ontokit:recordDigest "cat-digest"');
    });

    it("drops the deleted translated literal's axiom and retains the others", () => {
      const result = updateClassInTurtle(sourceWithAxioms, "http://example.org/ont#Dog", {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Chien", lang: "fr" },
        ],
        comments: [],
        parent_iris: [],
        annotations: [],
      });

      expect(result).toContain('ontokit:recordDigest "label-digest"');
      expect(result).not.toContain('ontokit:recordDigest "alt-digest"');
      expect(result).toContain('ontokit:recordDigest "cat-digest"');
    });
  });

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
