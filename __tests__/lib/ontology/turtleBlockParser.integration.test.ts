import { describe, expect, it } from "vitest";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { TURTLE_FIXTURE } from "./fixtures";

const namespace = "http://example.org/ont#";
const declarations = `@prefix ex: <${namespace}> .\n`;
const parseObject = (token: string) =>
  parseBlockTriples(`${declarations}ex:item ex:value ${token} .`, `${namespace}item`)?.[0].object;

describe("Turtle literal and declaration integration", () => {
  it.each([
    ['"line\\nnext"', "line\nnext"],
    ['"line\\rnext"', "line\rnext"],
    ['"left\\tright"', "left\tright"],
    ['"a\\\\b"', "a\\b"],
    ['"say \\"yes\\""', 'say "yes"'],
    ["'it\\'s'", "it's"],
  ])("decodes escaped literal %s without splitting the statement", (token, value) => {
    expect(parseObject(token)).toEqual({ type: "literal", value });
  });

  it("resolves a full datatype IRI and preserves its lexical value", () => {
    expect(parseObject('"007"^^<http://www.w3.org/2001/XMLSchema#integer>')).toEqual({
      type: "literal", value: "007", datatype: "http://www.w3.org/2001/XMLSchema#integer",
    });
  });

  it("preserves a language tag on a single-quoted literal", () => {
    expect(parseObject("'bonjour'@fr-CA")).toEqual({ type: "literal", value: "bonjour", lang: "fr-CA" });
  });

  it("reads bare integers with their lexical value and implicit datatype", () => {
    expect(parseObject("42")).toEqual({ type: "literal", value: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" });
  });

  it("ignores comments between predicates while retaining hash characters in literals", () => {
    const source = `${declarations}ex:item ex:first "# not a comment" ;\n# ignored ; ex:fake ex:no .\n ex:second "real" .`;
    expect(parseBlockTriples(source, `${namespace}item`)).toEqual([
      { predicate: `${namespace}first`, object: { type: "literal", value: "# not a comment" } },
      { predicate: `${namespace}second`, object: { type: "literal", value: "real" } },
    ]);
  });

  it("returns null for empty source and a missing subject instead of fabricating triples", () => {
    expect(parseBlockTriples("", `${namespace}missing`)).toBeNull();
    expect(parseBlockTriples(declarations, `${namespace}missing`)).toBeNull();
  });

  it("round-trips property edits through the writer, block scanner, tokenizer and detail extractor", () => {
    const original = extractPropertyDetail(TURTLE_FIXTURE, `${namespace}hasPart`)!;
    const labels = [{ value: 'part "A"\\B\nnext', lang: "en" }];
    const source = updatePropertyInTurtle(TURTLE_FIXTURE, `${namespace}hasPart`, {
      ...original,
      labels,
      comments: [{ value: "line\twith\rcontrols", lang: "" }],
    });
    const restored = extractPropertyDetail(source, `${namespace}hasPart`);
    expect(restored?.labels).toEqual(labels);
    expect(restored?.comments).toEqual([{ value: "line\twith\rcontrols", lang: "" }]);
    expect(restored?.domainIris).toEqual([`${namespace}Animal`]);
    expect(restored?.rangeIris).toEqual([`${namespace}Animal`]);
    expect(extractPropertyDetail(source, `${namespace}hasAge`)).toEqual(
      extractPropertyDetail(TURTLE_FIXTURE, `${namespace}hasAge`),
    );
  });

  it.each([
    '(ex:first (ex:second ex:third))',
    '[ ex:nested [ ex:value "nested value" ] ]',
    '()',
  ])("keeps the following predicate aligned after nested object %s", (object) => {
    const source = `${declarations}ex:item ex:complex ${object} ; ex:after "preserved" .`;
    const triples = parseBlockTriples(source, `${namespace}item`)!;
    expect(triples.map(triple => triple.predicate)).toEqual([`${namespace}complex`, `${namespace}after`]);
    expect(triples[1].object).toEqual({ type: "literal", value: "preserved" });
  });

});
