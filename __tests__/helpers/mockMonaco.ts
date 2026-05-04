/**
 * Shared Monaco Editor mock for component tests.
 *
 * Usage in test files:
 *   vi.mock("@monaco-editor/react", () => monacoMock);
 *   vi.mock("@/lib/editor/languages/turtle", () => ({ registerTurtleLanguage: vi.fn() }));
 */
import { vi } from "vitest";
import React from "react";

export const monacoMock = {
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement("textarea", {
      "data-testid": "monaco-editor",
      "data-language": props.language,
      value: props.value ?? props.defaultValue ?? "",
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (typeof props.onChange === "function") {
          (props.onChange as (value: string | undefined) => void)(e.target.value);
        }
      },
    }),
  DiffEditor: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "diff-editor",
      "data-original": props.original,
      "data-modified": props.modified,
    }),
  loader: {
    init: vi.fn().mockImplementation(() => Promise.resolve(createMockMonacoInstance())),
  },
};

/** Minimal mock for the Monaco instance passed to onMount / beforeMount */
export function createMockMonacoInstance() {
  return {
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      createModel: vi.fn(),
      setModelMarkers: vi.fn(),
    },
    languages: {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      registerHoverProvider: vi.fn(),
      registerLinkProvider: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
    },
    Uri: { parse: vi.fn((s: string) => ({ toString: () => s })) },
    Range: vi.fn((sl: number, sc: number, el: number, ec: number) => ({ startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec })),
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  };
}
