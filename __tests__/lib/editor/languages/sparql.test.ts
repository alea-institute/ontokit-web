import { describe, expect, it, vi } from "vitest";
import {
  SPARQL_LANGUAGE_ID,
  SPARQL_EXTENSIONS,
  sparqlLanguageConfiguration,
  sparqlTokensProvider,
  sparqlKeywords,
  sparqlFunctions,
  sparqlTemplates,
  registerSparqlLanguage,
} from "@/lib/editor/languages/sparql";

describe("SPARQL language constants", () => {
  it("SPARQL_LANGUAGE_ID is 'sparql'", () => {
    expect(SPARQL_LANGUAGE_ID).toBe("sparql");
  });

  it("SPARQL_EXTENSIONS includes .rq, .sparql, .sq", () => {
    expect(SPARQL_EXTENSIONS).toContain(".rq");
    expect(SPARQL_EXTENSIONS).toContain(".sparql");
    expect(SPARQL_EXTENSIONS).toContain(".sq");
  });

  it("sparqlKeywords contains core SPARQL keywords", () => {
    expect(sparqlKeywords).toContain("SELECT");
    expect(sparqlKeywords).toContain("WHERE");
    expect(sparqlKeywords).toContain("FILTER");
    expect(sparqlKeywords).toContain("PREFIX");
  });

  it("sparqlFunctions contains built-in functions", () => {
    expect(sparqlFunctions).toContain("STR");
    expect(sparqlFunctions).toContain("REGEX");
    expect(sparqlFunctions).toContain("BOUND");
  });

  it("sparqlTemplates is a non-empty array", () => {
    expect(sparqlTemplates.length).toBeGreaterThan(0);
    for (const t of sparqlTemplates) {
      expect(t.label).toBeTruthy();
      expect(t.insertText).toBeTruthy();
    }
  });

  it("sparqlLanguageConfiguration has comment and bracket config", () => {
    expect(sparqlLanguageConfiguration.comments.lineComment).toBe("#");
    expect(sparqlLanguageConfiguration.brackets.length).toBeGreaterThan(0);
  });

  it("sparqlTokensProvider has root tokenizer rules", () => {
    expect(sparqlTokensProvider.tokenizer.root.length).toBeGreaterThan(0);
    expect(sparqlTokensProvider.ignoreCase).toBe(true);
  });
});

describe("registerSparqlLanguage", () => {
  it("registers language, configuration, tokens, and completions", () => {
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerCompletionItemProvider: vi.fn(),
        CompletionItemKind: { Keyword: 17, Function: 1, Snippet: 27 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };

    registerSparqlLanguage(mockMonaco as unknown as typeof import("monaco-editor"));

    expect(mockMonaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sparql",
        extensions: SPARQL_EXTENSIONS,
      })
    );
    expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalledWith(
      "sparql",
      sparqlLanguageConfiguration
    );
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      "sparql",
      expect.anything()
    );
    expect(
      mockMonaco.languages.registerCompletionItemProvider
    ).toHaveBeenCalledWith("sparql", expect.objectContaining({
      provideCompletionItems: expect.any(Function),
    }));
  });

  it("completion provider returns keyword, function, and template suggestions", () => {
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerCompletionItemProvider: vi.fn(),
        CompletionItemKind: { Keyword: 17, Function: 1, Snippet: 27 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };

    registerSparqlLanguage(mockMonaco as unknown as typeof import("monaco-editor"));

    const provider =
      mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
    };
    const position = { lineNumber: 1 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions.length).toBe(
      sparqlKeywords.length + sparqlFunctions.length + sparqlTemplates.length
    );
  });
});
