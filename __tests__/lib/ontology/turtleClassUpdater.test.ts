import { describe, it, expect } from "vitest";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { TURTLE_FIXTURE } from "./fixtures";

describe("updateClassInTurtle", () => {
  const baseData = {
    labels: [{ value: "Dog", lang: "en" }],
    comments: [{ value: "A domesticated canine", lang: "en" }],
    parent_iris: ["http://example.org/ont#Animal"],
  };

  it.each(["comments", "annotations"] as const)("omits blank %s in the writer-to-parser chain without losing parents", field => {
    const note = "http://www.w3.org/2004/02/skos/core#editorialNote";
    const values = [{ value: " \t", lang: "en" }, { value: "meaningful", lang: "fr" }];
    const result = updateClassInTurtle(TURTLE_FIXTURE, "http://example.org/ont#Dog", {
      ...baseData,
      ...(field === "comments" ? { comments: values } : { annotations: [{ property_iri: note, values }] }),
    });
    const triples = parseBlockTriples(result, "http://example.org/ont#Dog")!;
    const predicate = field === "comments" ? "http://www.w3.org/2000/01/rdf-schema#comment" : note;
    expect(triples.filter(triple => triple.predicate === predicate)).toEqual([
      { predicate, object: { type: "literal", value: "meaningful", lang: "fr" } },
    ]);
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: "http://example.org/ont#Animal" } });
    expect(parseBlockTriples(result, "http://example.org/ont#Animal")).toEqual(parseBlockTriples(TURTLE_FIXTURE, "http://example.org/ont#Animal"));
  });

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

    it("preserves an untagged label and full-IRI subject when another field changes", () => {
      const source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<http://example.org/ont#Actor> a owl:Class ;
    rdfs:label "Actor" ;
    rdfs:comment "Old comment"@en .`;

      const result = updateClassInTurtle(source, "http://example.org/ont#Actor", {
        labels: [{ value: "Actor", lang: "en" }],
        comments: [{ value: "New comment", lang: "en" }],
        parent_iris: [],
      });

      expect(result).toBe(source.replace("Old comment", "New comment"));
      expect(result).not.toContain('rdfs:label "Actor"@en');
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

    // Corrected 2026-10-09: this test used to send `annotations: []` and
    // assert the altLabel's axiom was dropped, although an omitted altLabel
    // is carried through unchanged; that pinned the provenance-loss bug.
    // Deleting the literal now means describing altLabel with no values.
    it("drops the deleted translated literal's axiom and retains the others", () => {
      const result = updateClassInTurtle(sourceWithAxioms, "http://example.org/ont#Dog", {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Chien", lang: "fr" },
        ],
        comments: [],
        parent_iris: [],
        annotations: [{ property_iri: "http://www.w3.org/2004/02/skos/core#altLabel", values: [] }],
      });

      expect(result).not.toContain('"Toutou"@fr');
      expect(result).toContain('ontokit:recordDigest "label-digest"');
      expect(result).not.toContain('ontokit:recordDigest "alt-digest"');
      expect(result).toContain('ontokit:recordDigest "cat-digest"');
    });

    it("keeps the provenance of a carried altLabel when an unrelated field changes", () => {
      const result = updateClassInTurtle(sourceWithAxioms, "http://example.org/ont#Dog", {
        labels: [
          { value: "Dog", lang: "en" },
          { value: "Chien", lang: "fr" },
        ],
        comments: [{ value: "A new comment", lang: "en" }],
        parent_iris: [],
        annotations: [],
      });

      expect(result).toContain('skos:altLabel "Toutou"@fr');
      expect(result).toContain('rdfs:comment "A new comment"@en');
      expect(result).toContain('ontokit:recordDigest "label-digest"');
      expect(result).toContain('ontokit:recordDigest "alt-digest"');
      expect(result).toContain('ontokit:recordDigest "cat-digest"');
    });

    const OWL_NS = "http://www.w3.org/2002/07/owl#";
    const fullIriSource = `@prefix ex: <http://example.org/ont#> .
@prefix ontokit: <https://ontokit.org/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:subClassOf ex:Animal ;
    skos:altLabel "Toutou"@fr .

[] a <${OWL_NS}Axiom> ;
    <${OWL_NS}annotatedSource> <http://example.org/ont#Dog> ;
    <${OWL_NS}annotatedProperty> <http://www.w3.org/2004/02/skos/core#altLabel> ;
    <${OWL_NS}annotatedTarget> "Toutou"@fr ;
    ontokit:recordDigest "full-iri-alt-digest" .

[] a owl:Axiom ;
    owl:annotatedSource ex:Dog ;
    owl:annotatedProperty rdfs:subClassOf ;
    owl:annotatedTarget ex:Animal ;
    ontokit:recordDigest "parent-digest" .
`;
    const fullIriData = {
      labels: [{ value: "Dog (renamed)", lang: "en" }],
      comments: [],
      parent_iris: ["http://example.org/ont#Animal"],
    };

    it("keeps full-IRI axioms and IRI-valued targets the save did not touch", () => {
      const result = updateClassInTurtle(fullIriSource, "http://example.org/ont#Dog", fullIriData);

      expect(result).toContain('rdfs:label "Dog (renamed)"@en');
      expect(result).toContain('skos:altLabel "Toutou"@fr');
      expect(result).toContain('ontokit:recordDigest "full-iri-alt-digest"');
      expect(result).toContain('ontokit:recordDigest "parent-digest"');
    });

    it("drops a full-IRI axiom once its literal is deleted, keeping the IRI-target axiom", () => {
      const result = updateClassInTurtle(fullIriSource, "http://example.org/ont#Dog", {
        ...fullIriData,
        annotations: [{ property_iri: "http://www.w3.org/2004/02/skos/core#altLabel", values: [] }],
      });

      expect(result).not.toContain('"Toutou"@fr');
      expect(result).not.toContain("full-iri-alt-digest");
      expect(result).toContain('ontokit:recordDigest "parent-digest"');
    });
  });

  describe("blank-node objects on described predicates", () => {
    const restrictionSource = `@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:subClassOf ex:Animal, [ a owl:Restriction ; owl:onProperty ex:hasOwner ; owl:someValuesFrom ex:Person ] ;
    owl:equivalentClass [ a owl:Class ; owl:unionOf ( ex:Hound ex:Pup ) ] .
`;
    const data = {
      labels: [{ value: "Dog (renamed)", lang: "en" }],
      comments: [],
      parent_iris: ["http://example.org/ont#Mammal"],
    };

    it("keeps restrictions and class expressions while replacing the parent IRIs", () => {
      const result = updateClassInTurtle(restrictionSource, "http://example.org/ont#Dog", data);

      expect(result).toContain("rdfs:subClassOf ex:Mammal");
      expect(result).not.toContain("ex:Animal");
      expect(result).toContain(
        "rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:hasOwner ; owl:someValuesFrom ex:Person ]",
      );
      expect(result).toContain("owl:equivalentClass [ a owl:Class ; owl:unionOf ( ex:Hound ex:Pup ) ]");
    });

    it("is idempotent", () => {
      const once = updateClassInTurtle(restrictionSource, "http://example.org/ont#Dog", data);
      expect(updateClassInTurtle(once, "http://example.org/ont#Dog", data)).toBe(once);
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
