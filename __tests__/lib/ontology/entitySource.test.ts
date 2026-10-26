import { describe, expect, it } from "vitest";
import { extractEntitySource } from "@/lib/ontology/entitySource";

const ns = "https://example.org/ontology/";
const prefixes = `@prefix ex: <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;

describe("extractEntitySource", () => {
  it.each(["Class", "ObjectProperty", "DatatypeProperty", "AnnotationProperty", "NamedIndividual"])(
    "extracts a direct %s declaration without interpreting entity type",
    (type) => {
      const text = `ex:Selected a owl:${type} .`;
      expect(extractEntitySource(prefixes + text, ns + "Selected")).toEqual({
        status: "available", excerpts: [{ text, startLine: 4 }],
      });
    },
  );

  it("preserves repeated full, prefixed and default-prefix statements in source order", () => {
    const source = `@prefix ex: <${ns}> .\r\n@prefix : <${ns}> .\r\n` +
      `ex:Other a ex:Class . <${ns}Selected> a ex:Class .\r\n` +
      `:Selected ex:label\r\n  "Original whitespace" .\r\nex:Selected ex:value 3.14 .`;
    expect(extractEntitySource(source, ns + "Selected")).toEqual({
      status: "available",
      excerpts: [
        { text: `<${ns}Selected> a ex:Class .`, startLine: 3 },
        { text: ':Selected ex:label\r\n  "Original whitespace" .', startLine: 4 },
        { text: "ex:Selected ex:value 3.14 .", startLine: 6 },
      ],
    });
    expect(source).toContain('\r\n  "Original whitespace"');
  });

  it("resolves base-relative IRIs using the current base", () => {
    const source = `BASE <${ns}file.ttl>\n<Selected> <urn:label> "Selected" .\n` +
      `@base <https://other.example/file.ttl> .\n<Selected> <urn:label> "Other" .`;
    expect(extractEntitySource(source, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text: '<Selected> <urn:label> "Selected" .', startLine: 2 }],
    });
  });

  it("resolves relative prefix declarations and an empty relative subject", () => {
    const source = `@base <${ns}file.ttl> .\nPREFIX ex: <./>\nex:Selected <urn:p> <> .\n<> <urn:p> ex:Selected .`;
    expect(extractEntitySource(source, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text: "ex:Selected <urn:p> <> .", startLine: 3 }],
    });
    expect(extractEntitySource(source, ns + "file.ttl")).toEqual({
      status: "available", excerpts: [{ text: "<> <urn:p> ex:Selected .", startLine: 4 }],
    });
  });

  it("honors prefix rebindings without relabeling earlier statements", () => {
    const source = `PREFIX ex: <${ns}>\nex:Selected <urn:p> "first" .\n` +
      `PREFIX ex: <https://other.example/>\nex:Selected <urn:p> "other" .`;
    expect(extractEntitySource(source, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text: 'ex:Selected <urn:p> "first" .', startLine: 2 }],
    });
  });

  it("excludes object references, comments, literal mentions and other namespaces", () => {
    const source = prefixes + `# ex:Selected a owl:Class .
ex:Other ex:reference ex:Selected ; ex:label "ex:Selected" .
<https://other.example/Selected> a owl:Class .
ex:SelectedMore a owl:Class .`;
    expect(extractEntitySource(source, ns + "Selected").status).toBe("unavailable");
  });

  it("keeps inline structures and long strings intact without expanding linked blank nodes", () => {
    const text = `ex:Selected a owl:Class ;
  ex:restriction [ ex:values (ex:A [ ex:text "A. B; # C" ]) ] ;
  ex:note """A multiline string.
@prefix ex: <https://misleading.example/> .
Escaped quote: \\". Still inside.""" ;
  ex:linked _:external .`;
    const source = prefixes + text + '\n_:external ex:label "Separate statement" .';
    expect(extractEntitySource(source, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text, startLine: 4 }],
    });
  });

  it("does not treat declarations in comments or strings as bindings", () => {
    const source = `# @prefix ex: <${ns}> .\n<urn:other> <urn:p> """\n@prefix ex: <${ns}> .\n""" .\nex:Selected <urn:p> "unresolved" .`;
    expect(extractEntitySource(source, ns + "Selected").status).toBe("unavailable");
  });

  it.each([
    "",
    "# An imported entity has no local subject statements.",
    prefixes + "ex:Selected a owl:Class",
    prefixes + "ex:Selected a owl:Class .\nex:Selected ex:label \"unfinished",
    prefixes + "ex:Selected ex:items (ex:First ex:Second .",
  ])("does not report incomplete or absent source as a definition", (source) => {
    expect(extractEntitySource(source, ns + "Selected").status).toBe("unavailable");
  });

  it.each([
    `@prefix ex: <${ns}> . ex:Selected <urn:p> "inline" .`,
    `@prefix ex:\n  <${ns}> .\nex:Selected <urn:p> "multiline" .`,
    `@prefix ex: <relative/> .\nex:Selected <urn:p> "no base" .`,
    `@prefix ex: <${ns}> .\nex:Selected <urn:p> "first" . @prefix ex: <https://other.example/> .`,
    `@unknown ex: <${ns}> .\n<${ns}Selected> <urn:p> "unknown" .`,
    prefixes + 'ex:Selected <urn:p> "supported" .\nex:Selected\\~ <urn:p> "escaped spelling" .',
  ])("reports unsupported attribution rather than silently omitting statements", (source) => {
    expect(extractEntitySource(source, ns + "Selected").status).toBe("unavailable");
  });

  it("accepts whitespace and comments after standalone directives", () => {
    const text = 'ex:Selected <urn:p> "value" .';
    expect(extractEntitySource(`  @prefix ex: <${ns}> . # namespace\n\n${text}`, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text, startLine: 3 }],
    });
  });
});
