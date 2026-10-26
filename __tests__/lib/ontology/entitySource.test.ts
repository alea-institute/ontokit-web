import { describe, expect, it, vi } from "vitest";
import { buildEntitySourceIndex, extractEntitySource, lookupEntitySource } from "@/lib/ontology/entitySource";

const ns = "https://example.org/ontology/";
const prefixes = `@prefix ex: <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;

describe("extractEntitySource", () => {
  it.each([
    '<urn:A> <urn:p> <urn:x>.<urn:B> <urn:p> <urn:y> .',
    '@prefix ex: <urn:> .\nex:A ex:p ex:foo\\#bar .\nex:B ex:p ex:other .',
    '@prefix ex: <urn:> .\nex:A ex:p "value".ex:B ex:p ex:other .',
    '@prefix ex: <urn:> .\nex:A ex:p ex:foo\\.bar .\nex:B ex:p ex:other .',
    '@prefix ex: <urn:> .\nex:A ex:p 42.ex:B ex:p ex:y .',
    '@prefix ex: <urn:> .\nex:A ex:p 1.0.ex:B ex:p ex:y .',
    '@prefix ex: <urn:> .\nex:A ex:p true.ex:B ex:p ex:y .',
    '@prefix ex: <urn:> .\nex:A ex:p false.ex:B ex:p ex:y .',
    '@prefix ex: <urn:> .\nex:A ex:p 1.0e2.ex:B ex:p ex:y .',
  ])("never attributes a merged statement to its first subject", (source) => {
    const result = extractEntitySource(source, "urn:A");
    if (result.status === "available") {
      expect(result.excerpts).toHaveLength(1);
      expect(result.excerpts[0].text).not.toMatch(/(?:<urn:B>|ex:B)/);
    } else {
      expect(result.reason).toMatch(/cannot safely attribute/);
    }
  });

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

  it("preserves dotted names, decimals, strings and comments during lexical validation", () => {
    const text = 'ex:Selected ex:dotted.name ex:object.name ; ex:number 3.14 ; ex:text "Escaped quote: \\"; # not a comment" .';
    expect(extractEntitySource(prefixes + '# A comment with \\# and >.<\n' + text, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text, startLine: 5 }],
    });
  });

  it.each(["3.14", "1.0", "1.0e2", "42.e2", "-1.0", "+3.14", "true", "false"])("preserves ordinary literal %s", literal => {
    const text = `ex:Selected ex:value ${literal} .`;
    expect(extractEntitySource(prefixes + text, ns + "Selected")).toEqual({
      status: "available", excerpts: [{ text, startLine: 4 }],
    });
  });
});

describe("entity source index", () => {
  it("indexes exact subjects and declaration order once for repeated lookups", async () => {
    const source = `@prefix ex: <${ns}> .\nex:Selected <urn:p> "first" .\n` +
      `PREFIX ex: <https://other.example/>\nex:Selected <urn:p> "other" .\n` +
      `<${ns}Selected> <urn:p> "last" .`;
    const index = await buildEntitySourceIndex(source);
    expect(index).not.toBeNull();
    expect(index!.statements.size).toBe(2);
    expect(lookupEntitySource(index!, ns + "Selected")).toEqual(extractEntitySource(source, ns + "Selected"));
    expect(lookupEntitySource(index!, "https://other.example/Selected")).toEqual({
      status: "available", excerpts: [{ text: 'ex:Selected <urn:p> "other" .', startLine: 4 }],
    });
    expect(lookupEntitySource(index!, ns + "Selected")).toEqual({
      status: "available", excerpts: [
        { text: 'ex:Selected <urn:p> "first" .', startLine: 2 },
        { text: `<${ns}Selected> <urn:p> "last" .`, startLine: 5 },
      ],
    });
    expect(lookupEntitySource(index!, "urn:missing").status).toBe("unavailable");
  });

  it("yields during large-source work and discards a cancelled partial index", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const source = prefixes + Array.from({ length: 1000 }, (_, i) => `ex:Entity${i} ex:label "${"x".repeat(200)}" .`).join("\n");
      let completed = false;
      const pending = buildEntitySourceIndex(source, controller.signal).then(result => { completed = true; return result; });
      expect(completed).toBe(false);
      await vi.advanceTimersToNextTimerAsync();
      expect(completed).toBe(false);
      expect(vi.getTimerCount()).toBe(1);
      controller.abort();
      await vi.runAllTimersAsync();
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("makes unsupported source unavailable for every indexed subject", async () => {
    const index = await buildEntitySourceIndex('<urn:A> <urn:p> <urn:x>.<urn:B> <urn:p> <urn:y> .');
    for (const iri of ["urn:A", "urn:B"]) {
      expect(lookupEntitySource(index!, iri)).toEqual(expect.objectContaining({
        status: "unavailable", reason: expect.stringMatching(/cannot safely attribute/),
      }));
    }
  });
});
