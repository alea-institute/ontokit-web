import { describe, expect, it, vi } from "vitest";
import {
  commonPrefixes,
  commonProperties,
  TURTLE_LANGUAGE_ID,
  TURTLE_EXTENSIONS,
  turtleLanguageConfiguration,
  turtleTokensProvider,
  registerTurtleLanguage,
} from "@/lib/editor/languages/turtle";

describe("Turtle language constants", () => {
  it("TURTLE_LANGUAGE_ID is 'turtle'", () => {
    expect(TURTLE_LANGUAGE_ID).toBe("turtle");
  });

  it("TURTLE_EXTENSIONS includes .ttl, .turtle, .n3", () => {
    expect(TURTLE_EXTENSIONS).toContain(".ttl");
    expect(TURTLE_EXTENSIONS).toContain(".turtle");
    expect(TURTLE_EXTENSIONS).toContain(".n3");
  });

  it("commonPrefixes is a non-empty array with prefix and namespace", () => {
    expect(commonPrefixes.length).toBeGreaterThan(0);
    for (const p of commonPrefixes) {
      expect(p.prefix).toBeTruthy();
      expect(p.namespace).toBeTruthy();
      expect(p.namespace).toMatch(/^https?:\/\//);
    }
  });

  it("commonPrefixes includes standard RDF prefixes", () => {
    const prefixNames = commonPrefixes.map((p) => p.prefix);
    expect(prefixNames).toContain("rdf");
    expect(prefixNames).toContain("rdfs");
    expect(prefixNames).toContain("owl");
    expect(prefixNames).toContain("xsd");
  });

  it("commonProperties is a non-empty array with label and detail", () => {
    expect(commonProperties.length).toBeGreaterThan(0);
    for (const p of commonProperties) {
      expect(p.label).toBeTruthy();
      expect(p.detail).toBeTruthy();
    }
  });

  it("turtleLanguageConfiguration has comment and bracket config", () => {
    expect(turtleLanguageConfiguration.comments.lineComment).toBe("#");
    expect(turtleLanguageConfiguration.brackets.length).toBeGreaterThan(0);
  });

  it("turtleTokensProvider has root tokenizer rules", () => {
    expect(turtleTokensProvider.tokenizer.root.length).toBeGreaterThan(0);
    expect(turtleTokensProvider.defaultToken).toBe("");
    expect(turtleTokensProvider.tokenPostfix).toBe(".turtle");
  });
});

describe("registerTurtleLanguage", () => {
  it("registers language, configuration, tokens, and completions with monaco", () => {
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerCompletionItemProvider: vi.fn(),
        CompletionItemKind: { Snippet: 27, Property: 9 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };

    registerTurtleLanguage(mockMonaco as unknown as typeof import("monaco-editor"));

    expect(mockMonaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "turtle",
        extensions: TURTLE_EXTENSIONS,
      })
    );
    expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalledWith(
      "turtle",
      turtleLanguageConfiguration
    );
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      "turtle",
      expect.anything()
    );
    expect(
      mockMonaco.languages.registerCompletionItemProvider
    ).toHaveBeenCalledWith("turtle", expect.objectContaining({
      provideCompletionItems: expect.any(Function),
    }));
  });

  it("completion provider returns prefix and property suggestions", () => {
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerCompletionItemProvider: vi.fn(),
        CompletionItemKind: { Snippet: 27, Property: 9 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };

    registerTurtleLanguage(mockMonaco as unknown as typeof import("monaco-editor"));

    const provider =
      mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
    };
    const position = { lineNumber: 1 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions.length).toBe(
      commonPrefixes.length + commonProperties.length
    );
  });
});
