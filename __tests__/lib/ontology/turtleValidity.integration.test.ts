import { describe, expect, it } from "vitest";
import { findBlock, parseDeclarations } from "@/lib/ontology/turtleUtils";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { updateIndividualInTurtle } from "@/lib/ontology/turtleIndividualUpdater";

const ex = "https://example.test/#";
const owl = "http://www.w3.org/2002/07/owl#";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const skos = "http://www.w3.org/2004/02/skos/core#";
const common = {
  labels: [{ value: "Updated", lang: "en" }],
  comments: [{ value: "Comment", lang: "" }],
  deprecated: true,
};
const writers = [
  {
    name: "class", type: "Class",
    write: (source: string) => updateClassInTurtle(source, ex + "item", {
      ...common,
      parent_iris: [ex + "parent"],
      equivalent_iris: [ex + "equivalent"],
      disjoint_iris: [ex + "disjoint"],
    }),
    predicates: [rdfs + "subClassOf", owl + "equivalentClass", owl + "disjointWith"],
  },
  {
    name: "property", type: "ObjectProperty",
    write: (source: string) => updatePropertyInTurtle(source, ex + "item", {
      ...common,
      propertyType: "object",
      definitions: [{ value: "Definition", lang: "" }],
      domainIris: [ex + "domain"], rangeIris: [ex + "range"],
      parentIris: [ex + "parent"], inverseOf: ex + "inverse",
      characteristics: [owl + "FunctionalProperty"],
      equivalentIris: [ex + "equivalent"], disjointIris: [ex + "disjoint"],
      seeAlsoIris: [ex + "see"], isDefinedByIris: [ex + "defined"],
    }),
    predicates: [
      skos + "definition", rdfs + "domain", rdfs + "range", rdfs + "subPropertyOf",
      owl + "inverseOf", owl + "equivalentProperty", owl + "propertyDisjointWith",
      rdfs + "seeAlso", rdfs + "isDefinedBy",
    ],
  },
  {
    name: "individual", type: "NamedIndividual",
    write: (source: string) => updateIndividualInTurtle(source, ex + "item", {
      ...common,
      definitions: [{ value: "Definition", lang: "" }],
      typeIris: [ex + "type"], sameAsIris: [ex + "same"],
      differentFromIris: [ex + "different"],
      objectPropertyAssertions: [], dataPropertyAssertions: [],
      seeAlsoIris: [ex + "see"], isDefinedByIris: [ex + "defined"],
    }),
    predicates: [
      skos + "definition", owl + "sameAs", owl + "differentFrom",
      rdfs + "seeAlso", rdfs + "isDefinedBy",
    ],
  },
];

describe("Turtle writer namespace and subject integrity", () => {
  it.each(writers)("rejects an object-only $name target without overwriting its neighbor", ({ write, type }) => {
    const source = `@prefix ex: <${ex}> .\nex:neighbor a <${owl}${type}> ; ex:pointsTo <${ex}item> .`;
    expect(() => write(source)).toThrow("Could not find");
  });

  it("never substitutes a same-local-name subject from another namespace", () => {
    const source = `@prefix other: <https://other.test/#> .\nother:item a <${owl}Class> .`;
    expect(findBlock(source.split("\n"), ex + "item", parseDeclarations(source).prefixes)).toBeNull();
  });

  it("ignores object continuation after intervening comments and blank lines", () => {
    const source = `@prefix ex: <${ex}> .\nex:neighbor ex:pointsTo\n# continuation\n\n<${ex}item> .`;
    expect(parseBlockTriples(source, ex + "item")).toBeNull();
  });

  describe.each(["absent", "conflicting", "alternate"])("%s standard prefixes", (binding) => {
    it.each(writers)("writes resolved $name predicates and types and preserves neighbors", ({ write, type, predicates, name }) => {
      const declarations = binding === "absent" ? "" : [
        ["owl", owl], ["rdfs", rdfs], ["skos", skos],
      ].map(([alias, namespace]) => {
        const prefix = binding === "alternate" ? alias + "2" : alias;
        const iri = binding === "conflicting" ? "https://wrong.test/" + alias + "#" : namespace;
        return `@prefix ${prefix}: <${iri}> .\n`;
      }).join("");
      const neighbor = `ex:neighbor a <${owl}Class> .`;
      const source = `@prefix ex: <${ex}> .\n${declarations}<${ex}item> a <${owl}${type}> .\n${neighbor}`;
      const result = write(source);
      expect(result).toContain(neighbor);
      expect(result).toContain(declarations);
      const triples = parseBlockTriples(result, ex + "item")!;
      expect(triples).toContainEqual({
        predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        object: { type: "iri", value: owl + type },
      });
      expect(triples.map(t => t.predicate)).toEqual(expect.arrayContaining([rdfs + "label", rdfs + "comment", owl + "deprecated", ...predicates]));
      expect(result).not.toMatch(/(?:^|\s)(?:owl|rdfs|skos):[A-Za-z]/m);
      if (name === "property") expect(triples).toContainEqual({
        predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        object: { type: "iri", value: owl + "FunctionalProperty" },
      });
    });
  });
});

describe("Turtle Unicode literal decoding", () => {
  it("round-trips Unicode labels through extraction and editing while retaining unknown annotations", () => {
    const neighbor = `ex:neighbor a <${owl}Class> .`;
    const annotation = 'ex:unknown "untouched"';
    const source = `@prefix ex: <${ex}> .\nex:item a <${owl}ObjectProperty> ;
      <${rdfs}label> "\\u0041\\U0001F642"@en ; ${annotation} .\n${neighbor}`;
    const detail = extractPropertyDetail(source, ex + "item")!;
    expect(detail.labels).toEqual([{ value: "A🙂", lang: "en" }]);
    const result = updatePropertyInTurtle(source, ex + "item", {
      ...detail,
      labels: detail.labels.map(label => ({ ...label, value: label.value + " edited" })),
      annotations: undefined,
    });
    expect(extractPropertyDetail(result, ex + "item")?.labels).toEqual([
      { value: "A🙂 edited", lang: "en" },
    ]);
    expect(result).toContain(annotation);
    expect(result).toContain(neighbor);
  });

  it.each([
    [String.raw`"\u0041\u00e9"@fr`, "Aé", { lang: "fr" }],
    [String.raw`"\U0001F642"^^<http://www.w3.org/2001/XMLSchema#string>`, "🙂", { datatype: "http://www.w3.org/2001/XMLSchema#string" }],
    [String.raw`'''\u0041\U0001F642'''`, "A🙂", {}],
    [String.raw`"\\u0041"`, String.raw`\u0041`, {}],
  ])("decodes %s without damaging suffixes or adjacent triples", (token, value, suffix) => {
    const source = `@prefix ex: <${ex}> .\nex:item ex:value ${token} ; ex:after "unchanged" .`;
    expect(parseBlockTriples(source, ex + "item")).toEqual([
      { predicate: ex + "value", object: { type: "literal", value, ...suffix } },
      { predicate: ex + "after", object: { type: "literal", value: "unchanged" } },
    ]);
  });

  it.each([String.raw`\u00GG`, String.raw`\u123`, String.raw`\U00110000`, String.raw`\uD800`])("rejects invalid Unicode escape %s before an edit can corrupt it", (escape) => {
    expect(() => parseBlockTriples(`@prefix ex: <${ex}> .\nex:item ex:value "${escape}" .`, ex + "item")).toThrow("Invalid Unicode escape");
  });
});
