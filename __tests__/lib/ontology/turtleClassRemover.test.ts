import { describe, expect, it } from "vitest";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { removeClassFromTurtle } from "@/lib/ontology/turtleClassRemover";

const PREFIXES = [
  "@prefix : <http://example.org/ont#> .",
  "@prefix ex: <http://example.org/ont#> .",
  "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
  "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
].join("\n");

const FOO = "http://example.org/ont#Foo";
const OWL = "http://www.w3.org/2002/07/owl#";

// Any Turtle spelling of :Foo used as a term (never :FooBar or a literal).
const FOO_TERM = /(?:^|[\s;,[(])(?:ex:Foo|:Foo|<http:\/\/example\.org\/ont#Foo>)(?=[\s;,.\])]|$)/mu;

const SIBLING = [
  ":FooBar a owl:Class ;",
  '  rdfs:label "Foo bar"@en ;',
  "  rdfs:subClassOf :Base .",
].join("\n");

describe("removeClassFromTurtle", () => {
  it.each([
    ["full IRI", `<${FOO}>`],
    ["prefixed", "ex:Foo"],
    ["default-prefix", ":Foo"],
  ])("removes a %s subject block and keeps its neighbours byte-identical", (_form, subject) => {
    const before = `${PREFIXES}\n\n:Base a owl:Class .\n\n`;
    const after = `\n\n${SIBLING}\n`;
    const source = `${before}${subject} a owl:Class ;\n  rdfs:label "Foo"@en ;\n  rdfs:subClassOf :Base .${after}`;

    const result = removeClassFromTurtle(source, FOO);

    expect(result).toBe(`${PREFIXES}\n\n:Base a owl:Class .\n\n${SIBLING}\n`);
    expect(result).not.toMatch(FOO_TERM);
  });

  it("removes a @base-relative subject", () => {
    const source = `@base <http://example.org/ont#> .\n@prefix owl: <${OWL}> .\n\n<Foo> a owl:Class .\n\n<Kept> a owl:Class .\n`;
    expect(removeClassFromTurtle(source, FOO)).toBe(
      `@base <http://example.org/ont#> .\n@prefix owl: <${OWL}> .\n\n<Kept> a owl:Class .\n`,
    );
  });

  it("does not touch a sibling whose IRI shares the class's prefix", () => {
    const source = `${PREFIXES}\n\n${SIBLING}\n\n:Foo a owl:Class .\n`;
    const result = removeClassFromTurtle(source, FOO);

    expect(result).toBe(`${PREFIXES}\n\n${SIBLING}\n`);
    expect(result).toContain(SIBLING);
  });

  it("removes every annotation axiom about the class, in bracket and named-node forms", () => {
    const axiomAboutSibling = [
      "[] a owl:Axiom ;",
      "  owl:annotatedSource :FooBar ;",
      "  owl:annotatedProperty rdfs:label ;",
      '  owl:annotatedTarget "Foo bar"@en ;',
      '  rdfs:comment "keep me" .',
    ].join("\n");
    const source = [
      PREFIXES,
      "",
      ':Foo a owl:Class ; rdfs:label "Foo"@en .',
      "",
      "[] a owl:Axiom ;",
      "  owl:annotatedSource :Foo ;",
      "  owl:annotatedProperty rdfs:label ;",
      '  owl:annotatedTarget "Foo"@en ;',
      '  rdfs:comment "source note" .',
      "",
      "[ rdf:type owl:Axiom ;",
      "  owl:annotatedSource <http://example.org/ont#Foo> ;",
      "  owl:annotatedProperty rdfs:label ;",
      '  owl:annotatedTarget "Foo"@en',
      "] .",
      "",
      "_:ax3 a <http://www.w3.org/2002/07/owl#Axiom> ;",
      "  <http://www.w3.org/2002/07/owl#annotatedSource> ex:Foo ;",
      "  owl:annotatedProperty rdfs:label ;",
      '  owl:annotatedTarget "Foo"@en .',
      "",
      axiomAboutSibling,
      "",
      SIBLING,
      "",
    ].join("\n");

    const result = removeClassFromTurtle(source, FOO);

    expect(result).toBe(`${PREFIXES}\n\n${axiomAboutSibling}\n\n${SIBLING}\n`);
    expect(result).not.toMatch(FOO_TERM);
    expect(result.match(/owl:Axiom/gu)).toHaveLength(1);
  });

  it("removes the class when it is the last block in the file", () => {
    const withNewline = `${PREFIXES}\n\n${SIBLING}\n\n:Foo a owl:Class .\n`;
    const withoutNewline = `${PREFIXES}\n\n${SIBLING}\n\n:Foo a owl:Class .`;

    expect(removeClassFromTurtle(withNewline, FOO)).toBe(`${PREFIXES}\n\n${SIBLING}\n`);
    expect(removeClassFromTurtle(withoutNewline, FOO)).toBe(`${PREFIXES}\n\n${SIBLING}`);
    expect(removeClassFromTurtle(`${PREFIXES}\n${SIBLING}\n:Foo a owl:Class .\n`, FOO)).toBe(
      `${PREFIXES}\n${SIBLING}\n`,
    );
  });

  it("returns the source unchanged when the class is absent", () => {
    const source = `${PREFIXES}\n\n${SIBLING}\n\n:Other rdfs:seeAlso :Foo .\n`;
    expect(removeClassFromTurtle(source, FOO)).toBe(source);
  });

  it("leaves other entities' references to the class in place", () => {
    const reference = ":Child a owl:Class ;\n  rdfs:subClassOf :Foo .";
    const source = `${PREFIXES}\n\n:Foo a owl:Class .\n\n${reference}\n`;
    expect(removeClassFromTurtle(source, FOO)).toBe(`${PREFIXES}\n\n${reference}\n`);
  });

  it("drops the serializer header comment that names the removed class", () => {
    const source = [
      PREFIXES,
      "",
      "###  http://example.org/ont#Foo",
      ":Foo a owl:Class .",
      "",
      "###  http://example.org/ont#FooBar",
      SIBLING,
      "",
    ].join("\n");
    expect(removeClassFromTurtle(source, FOO)).toBe(
      `${PREFIXES}\n\n###  http://example.org/ont#FooBar\n${SIBLING}\n`,
    );
  });

  it("removes an altLabel-rich class and its annotated axiom completely (AE1)", () => {
    const languages = ["de", "es", "fr", "it", "ja", "nl", "pt", "ru", "zh"];
    const classBlock = [
      "ex:Foo a owl:Class ;",
      '  rdfs:label "Foo"@en ;',
      ...languages.map((lang, index) =>
        `  skos:altLabel "Foo ${lang} \\"quoted\\" ; ."@${lang}${index === languages.length - 1 ? " ;" : " ,"}`,
      ),
      "  rdfs:comment \"\"\"A long comment\nwith a line ending in a dot.\n\"\"\" ;",
      "  rdfs:subClassOf [ a owl:Restriction ; owl:onProperty :p ; owl:someValuesFrom :Base ] .",
    ].join("\n");
    const axiom = [
      "[] a owl:Axiom ;",
      "  owl:annotatedSource ex:Foo ;",
      "  owl:annotatedProperty skos:altLabel ;",
      '  owl:annotatedTarget "Foo de \\"quoted\\" ; ."@de ;',
      '  rdfs:comment "translator note" .',
    ].join("\n");
    const source = `${PREFIXES}\n\n:Base a owl:Class .\n\n${classBlock}\n\n${axiom}\n\n${SIBLING}\n`;
    expect(parseBlockTriples(source, FOO)?.length ?? 0).toBeGreaterThan(languages.length);
    expect(source).toMatch(FOO_TERM);

    const result = removeClassFromTurtle(source, FOO);

    expect(result).toBe(`${PREFIXES}\n\n:Base a owl:Class .\n\n${SIBLING}\n`);
    expect(result).not.toMatch(FOO_TERM);
    expect(parseBlockTriples(result, FOO)).toBeNull();
    expect(result).not.toContain("annotatedSource");
  });

  it("rejects an IRI that could escape a Turtle IRI reference", () => {
    expect(() => removeClassFromTurtle(PREFIXES, "http://example.org/ont#Foo> .")).toThrow(/unsafe/);
  });
});
