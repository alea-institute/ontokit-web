import { describe, expect, it } from "vitest";
import { parseExistingTurtleBlock, parseDeclarations, findBlock } from "@/lib/ontology/turtleUtils";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

const iri = "http://example.org/ont#hasPart";

describe("Turtle block preservation through source edits", () => {
  it.each(['"""', "'''"])("keeps delimiters inside %s strings in a single predicate", (quote) => {
    const block = `ex:item a owl:Class ; ex:note ${quote}first ; .\nsecond${quote} ; ex:last "end" .`;
    expect(parseExistingTurtleBlock(block)).toEqual({
      subject: "ex:item",
      predicateObjects: [
        { predicate: "a", text: "a owl:Class" },
        { predicate: "ex:note", text: `ex:note ${quote}first ; .\nsecond${quote}` },
        { predicate: "ex:last", text: 'ex:last "end"' },
      ],
    });
  });

  it("keeps nested restrictions and collections intact while splitting outer predicates", () => {
    const restriction = "ex:rule [ ex:members (ex:One [ ex:label 'inside ; .' ]) ; ex:other ex:Two ]";
    expect(parseExistingTurtleBlock(`ex:item a owl:Class ; ${restriction} ; ex:end 'yes' .`).predicateObjects).toEqual([
      { predicate: "a", text: "a owl:Class" },
      { predicate: "ex:rule", text: restriction },
      { predicate: "ex:end", text: "ex:end 'yes'" },
    ]);
  });

  it("does not split a predicate on IRI punctuation", () => {
    expect(parseExistingTurtleBlock('ex:item <https://example.test/p;a> <https://example.test/o;b> ; ex:label "ok" .').predicateObjects).toEqual([
      { predicate: "<https://example.test/p;a>", text: "<https://example.test/p;a> <https://example.test/o;b>" },
      { predicate: "ex:label", text: 'ex:label "ok"' },
    ]);
  });

  it.each(["", "# only a comment", "unqualified a owl:Class ."])("rejects a block without a supported subject: %s", (source) => {
    expect(() => parseExistingTurtleBlock(source)).toThrow("Could not parse the subject");
  });

  it.each([
    { name: "multiline", annotation: 'ex:note """first ; .\nsecond"""', value: "first ; .\nsecond" },
    { name: "escaped double quote", annotation: String.raw`ex:note "quoted \" ; . punctuation"`, value: 'quoted " ; . punctuation' },
    { name: "escaped single quote", annotation: String.raw`ex:note 'quoted \' ; . punctuation'`, value: "quoted ' ; . punctuation" },
  ])("preserves an unedited $name annotation through a real property update", ({ annotation, value }) => {
    const source = TURTLE_FIXTURE.replace('rdfs:label "has part"@en ;', `rdfs:label "has part"@en ;\n    ${annotation} ;`);
    const detail = extractPropertyDetail(source, iri)!;
    const updated = updatePropertyInTurtle(source, iri, {
      ...detail,
      labels: [{ value: "new label", lang: "en" }],
      annotations: undefined,
    });
    expect(updated).toContain(annotation);
    const { prefixes, base } = parseDeclarations(updated);
    const block = findBlock(updated.split("\n"), iri, prefixes, base)!;
    expect(block.endLine).toBeGreaterThan(block.startLine);
    const triples = parseBlockTriples(updated, iri)!;
    expect(triples).toContainEqual({
      predicate: "http://example.org/ont#note",
      object: { type: "literal", value },
    });
    expect(extractPropertyDetail(updated, iri)?.labels).toEqual([{ value: "new label", lang: "en" }]);
    expect(updated).toContain('ex:hasAge a owl:DatatypeProperty ;');
  });
});
