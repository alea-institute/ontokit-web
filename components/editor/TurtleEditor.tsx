"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { OnMount, BeforeMount, loader } from "@monaco-editor/react";
import type { editor, languages } from "monaco-editor";
import {
  turtleLanguageConfiguration,
  turtleTokensProvider,
  commonPrefixes,
  commonProperties,
  TURTLE_LANGUAGE_ID,
} from "@/lib/editor/languages/turtle";

// Configure Monaco to load from CDN for faster initial load
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
});

export interface TurtleDiagnostic {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
}

export interface TurtleEditorProps {
  /** The Turtle content to display/edit */
  value: string;
  /** Callback when content changes */
  onChange?: (value: string) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Height of the editor (CSS value) */
  height?: string;
  /** Diagnostics to display as markers */
  diagnostics?: TurtleDiagnostic[];
  /** Callback when user clicks on a diagnostic marker */
  onDiagnosticClick?: (diagnostic: TurtleDiagnostic) => void;
  /** Callback when editor is ready */
  onReady?: (editor: editor.IStandaloneCodeEditor) => void;
  /** Callback when clicking on an internal IRI link (prefixed name) */
  onInternalLinkClick?: (iri: string) => void;
  /** Show minimap */
  minimap?: boolean;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Word wrap mode */
  wordWrap?: "on" | "off" | "wordWrapColumn" | "bounded";
  /** Font size in pixels */
  fontSize?: number;
  /** Theme override (defaults to system preference) */
  theme?: "light" | "dark";
}

// Track if language is already registered to avoid duplicate registration
let languageRegistered = false;

/**
 * Monaco-based Turtle/RDF editor with syntax highlighting
 */
export function TurtleEditor({
  value,
  onChange,
  readOnly = false,
  height = "400px",
  diagnostics = [],
  onDiagnosticClick,
  onReady,
  onInternalLinkClick,
  minimap = false,
  lineNumbers = true,
  wordWrap = "on",
  fontSize = 14,
  theme,
}: TurtleEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const [isReady, setIsReady] = useState(false);
  const onInternalLinkClickRef = useRef(onInternalLinkClick);

  // Keep ref updated
  useEffect(() => {
    onInternalLinkClickRef.current = onInternalLinkClick;
  }, [onInternalLinkClick]);

  // Detect system theme if not overridden
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setSystemTheme(isDark ? "dark" : "light");

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const effectiveTheme = theme || systemTheme;

  // Register Turtle language before editor mounts
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    if (languageRegistered) return;

    // Register the Turtle language
    monaco.languages.register({
      id: TURTLE_LANGUAGE_ID,
      extensions: [".ttl", ".turtle", ".n3"],
      aliases: ["Turtle", "turtle", "ttl", "N3"],
      mimetypes: ["text/turtle", "application/x-turtle"],
    });

    // Set language configuration
    monaco.languages.setLanguageConfiguration(
      TURTLE_LANGUAGE_ID,
      turtleLanguageConfiguration as languages.LanguageConfiguration
    );

    // Set monarch tokenizer
    monaco.languages.setMonarchTokensProvider(
      TURTLE_LANGUAGE_ID,
      turtleTokensProvider as languages.IMonarchLanguage
    );

    // Register completion provider
    monaco.languages.registerCompletionItemProvider(TURTLE_LANGUAGE_ID, {
      provideCompletionItems: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: languages.CompletionItem[] = [
          // Prefix suggestions
          ...commonPrefixes.map((p) => ({
            label: `@prefix ${p.prefix}:`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `@prefix ${p.prefix}: <${p.namespace}> .`,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: p.namespace,
            range,
          })),
          // Property suggestions
          ...commonProperties.map((p) => ({
            label: p.label,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: p.label,
            detail: p.detail,
            range,
          })),
          // Common type shortcuts
          {
            label: "owl:Class",
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: "owl:Class",
            detail: "OWL Class declaration",
            range,
          },
          {
            label: "owl:ObjectProperty",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "owl:ObjectProperty",
            detail: "OWL Object Property",
            range,
          },
          {
            label: "owl:DatatypeProperty",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "owl:DatatypeProperty",
            detail: "OWL Datatype Property",
            range,
          },
        ];

        return { suggestions };
      },
    });

    // Register hover provider for IRIs
    monaco.languages.registerHoverProvider(TURTLE_LANGUAGE_ID, {
      provideHover: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const column = position.column;

        // Get all prefixes and @base defined in the document
        const content = model.getValue();
        const docPrefixes = new Map<string, string>();
        const internalNamespaces = new Set<string>();
        let docBase: string | null = null;
        const baseMatch = content.match(/@?base\s+<([^>]+)>/i);
        if (baseMatch) {
          docBase = baseMatch[1];
        }
        const prefixMatches = content.matchAll(/@?prefix\s+(\w*):\s*<([^>]+)>/gi);
        for (const match of prefixMatches) {
          const prefix = match[1];
          const namespace = match[2];
          docPrefixes.set(prefix, namespace);
          // Check if this is NOT a known external vocabulary
          const isKnownExternal = commonPrefixes.some(p => p.namespace === namespace);
          if (!isKnownExternal) {
            internalNamespaces.add(namespace);
          }
        }
        // Also add common prefixes as fallback
        for (const p of commonPrefixes) {
          if (!docPrefixes.has(p.prefix)) {
            docPrefixes.set(p.prefix, p.namespace);
          }
        }

        // Find IRIs in angle brackets at cursor position: <...>
        const angleBracketMatches = lineContent.matchAll(/<([^>\s]+)>/g);
        for (const match of angleBracketMatches) {
          const iriContent = match[1];
          const matchStart = match.index! + 1;
          const matchEnd = matchStart + match[0].length;

          if (column >= matchStart && column <= matchEnd) {
            const isAbsolute = !!iriContent.match(/^[a-z][a-z0-9+.-]*:/i);
            let fullIri: string;
            if (isAbsolute) {
              fullIri = iriContent;
            } else if (docBase) {
              fullIri = docBase + iriContent;
            } else {
              continue; // Relative IRI with no @base — can't resolve
            }

            // Check if this IRI belongs to an internal namespace or matches @base
            const isInternal = (docBase && fullIri.startsWith(docBase))
              || [...internalNamespaces].some(ns => fullIri.startsWith(ns));

            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: matchStart,
                endColumn: matchEnd,
              },
              contents: [
                { value: `**<${iriContent}>**` },
                ...(isAbsolute ? [] : [{ value: `Full IRI: \`${fullIri}\`` }]),
                { value: isInternal ? `*Ctrl+Click to navigate to class*` : `*Ctrl+Click to open in browser*` },
              ],
            };
          }
        }

        // Find prefixed names at cursor position (including empty prefix :localName)
        const prefixedMatches = lineContent.matchAll(/(\w*):([A-Za-z_][A-Za-z0-9_\-]*)/g);
        for (const match of prefixedMatches) {
          const matchStart = match.index! + 1;
          const matchEnd = matchStart + match[0].length;

          if (column >= matchStart && column <= matchEnd) {
            const prefix = match[1];
            const localName = match[2];
            const namespace = docPrefixes.get(prefix);

            if (namespace) {
              const fullIri = namespace + localName;
              const isInternal = internalNamespaces.has(namespace);

              return {
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: matchStart,
                  endColumn: matchEnd,
                },
                contents: [
                  { value: `**${prefix ? prefix + ':' : ':'}${localName}**` },
                  { value: `Full IRI: \`${fullIri}\`` },
                  { value: isInternal ? `*Ctrl+Click to navigate to class*` : `*Ctrl+Click to open in browser*` },
                ],
              };
            }
          }
        }

        return null;
      },
    });

    // Register link provider for external URLs only
    // Internal links are handled via Ctrl+Click in handleMount
    monaco.languages.registerLinkProvider(TURTLE_LANGUAGE_ID, {
      provideLinks: (model: editor.ITextModel) => {
        const links: languages.ILink[] = [];
        const lineCount = model.getLineCount();

        // Determine internal namespaces to exclude from browser links
        const content = model.getValue();
        const internalNs = new Set<string>();
        const baseMatch = content.match(/@?base\s+<([^>]+)>/i);
        if (baseMatch) {
          internalNs.add(baseMatch[1]);
        }
        const prefixMatches = content.matchAll(/@?prefix\s+(\w*):\s*<([^>]+)>/gi);
        for (const match of prefixMatches) {
          const namespace = match[2];
          const isKnownExternal = commonPrefixes.some(p => p.namespace === namespace);
          if (!isKnownExternal) {
            internalNs.add(namespace);
          }
        }

        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const lineContent = model.getLineContent(lineNum);

          // Find full IRIs <http://...> or <https://...>
          const iriMatches = lineContent.matchAll(/<(https?:\/\/[^>\s]+)>/g);
          for (const match of iriMatches) {
            const url = match[1];
            // Skip internal IRIs — these are handled by Ctrl+Click → tree navigation
            const isInternal = [...internalNs].some(ns => url.startsWith(ns));
            if (isInternal) continue;

            const startCol = match.index! + 2; // After '<'
            const endCol = startCol + url.length;
            links.push({
              range: {
                startLineNumber: lineNum,
                startColumn: startCol,
                endLineNumber: lineNum,
                endColumn: endCol,
              },
              url: url,
              tooltip: `Ctrl+Click to open ${new URL(url).hostname}`,
            });
          }
        }

        return { links };
      },
    });

    languageRegistered = true;
  }, []);

  // Handle editor mount
  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setIsReady(true);
      onReady?.(editor);

      const model = editor.getModel();

      // Get prefixes and @base from the document + common prefixes for resolving links
      const getPrefixInfo = (): { prefixes: Map<string, string>; internalNamespaces: Set<string>; baseUri: string | null } => {
        const prefixes = new Map<string, string>();
        const internalNamespaces = new Set<string>();
        let baseUri: string | null = null;

        // Add common prefixes first (these are external vocabularies)
        for (const p of commonPrefixes) {
          prefixes.set(p.prefix, p.namespace);
        }

        // Document prefixes override common ones
        // Document-defined prefixes (especially empty prefix) are considered internal
        if (model) {
          const content = model.getValue();
          // Extract @base
          const baseMatch = content.match(/@?base\s+<([^>]+)>/i);
          if (baseMatch) {
            baseUri = baseMatch[1];
          }
          const prefixMatches = content.matchAll(/@?prefix\s+(\w*):\s*<([^>]+)>/gi);
          for (const match of prefixMatches) {
            const prefix = match[1];
            const namespace = match[2];
            prefixes.set(prefix, namespace);
            // Empty prefix and any custom prefixes defined in the document are internal
            // (unless they're well-known external vocabularies)
            const isKnownExternal = commonPrefixes.some(p => p.namespace === namespace);
            if (!isKnownExternal) {
              internalNamespaces.add(namespace);
            }
          }
        }

        return { prefixes, internalNamespaces, baseUri };
      };

      // Handle Ctrl+Click for links (relative IRIs and prefixed names)
      editor.onMouseDown((e) => {
        // Check for Ctrl+Click (or Cmd+Click on Mac)
        if ((e.event.ctrlKey || e.event.metaKey) && model) {
          const position = e.target.position;
          if (position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const column = position.column;
            const { prefixes, internalNamespaces, baseUri } = getPrefixInfo();

            // Check for IRIs in angle brackets: <...>
            const angleBracketMatches = lineContent.matchAll(/<([^>\s]+)>/g);
            for (const match of angleBracketMatches) {
              const iriContent = match[1];
              const matchStart = match.index! + 1;
              const matchEnd = matchStart + match[0].length;

              if (column >= matchStart && column <= matchEnd) {
                const isAbsolute = !!iriContent.match(/^[a-z][a-z0-9+.-]*:/i);
                let fullIri: string;
                if (isAbsolute) {
                  fullIri = iriContent;
                } else if (baseUri) {
                  fullIri = baseUri + iriContent;
                } else {
                  continue; // Can't resolve relative IRI
                }

                // Check if internal (matches @base or internal namespace)
                const isInternal = (baseUri && fullIri.startsWith(baseUri))
                  || [...internalNamespaces].some(ns => fullIri.startsWith(ns));

                e.event.preventDefault();
                e.event.stopPropagation();

                if (isInternal && onInternalLinkClickRef.current) {
                  onInternalLinkClickRef.current(fullIri);
                } else if (fullIri.startsWith('http://') || fullIri.startsWith('https://')) {
                  window.open(fullIri, '_blank', 'noopener,noreferrer');
                }
                return;
              }
            }

            // Find if we're clicking on a prefixed name pattern
            // Look for prefix:localName where cursor is within the match
            const prefixedMatches = lineContent.matchAll(/(\w*):([A-Za-z_][A-Za-z0-9_\-]*)/g);
            for (const match of prefixedMatches) {
              const matchStart = match.index! + 1;
              const matchEnd = matchStart + match[0].length;

              if (column >= matchStart && column <= matchEnd) {
                const prefix = match[1];
                const localName = match[2];
                const namespace = prefixes.get(prefix);

                if (namespace) {
                  const fullIri = namespace + localName;
                  e.event.preventDefault();
                  e.event.stopPropagation();

                  // Check if this is an internal namespace (defined in document, not a known external vocabulary)
                  const isInternal = internalNamespaces.has(namespace);

                  if (isInternal && onInternalLinkClickRef.current) {
                    // Navigate to internal class
                    onInternalLinkClickRef.current(fullIri);
                  } else if (fullIri.startsWith('http://') || fullIri.startsWith('https://')) {
                    // Open external link in new tab
                    window.open(fullIri, '_blank', 'noopener,noreferrer');
                  }
                  return;
                }
              }
            }
          }
        }

        // Handle diagnostic gutter click
        if (onDiagnosticClick && e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const lineNumber = e.target.position?.lineNumber;
          if (lineNumber) {
            const diagnostic = diagnostics.find(
              (d) =>
                d.startLineNumber <= lineNumber &&
                d.endLineNumber >= lineNumber
            );
            if (diagnostic) {
              onDiagnosticClick(diagnostic);
            }
          }
        }
      });
    },
    [onReady, onDiagnosticClick, diagnostics]
  );

  // Update diagnostics as markers (deferred to not block rendering)
  useEffect(() => {
    if (!isReady || !editorRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    // Defer marker updates to avoid blocking the main thread
    const timeoutId = setTimeout(() => {
      if (model.isDisposed()) return;

      const markers: editor.IMarkerData[] = diagnostics.map((d) => ({
        startLineNumber: d.startLineNumber,
        startColumn: d.startColumn,
        endLineNumber: d.endLineNumber,
        endColumn: d.endColumn,
        message: d.message,
        severity:
          d.severity === "error"
            ? monaco.MarkerSeverity.Error
            : d.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : d.severity === "hint"
            ? monaco.MarkerSeverity.Hint
            : monaco.MarkerSeverity.Info,
      }));

      monaco.editor.setModelMarkers(model, "turtle-linter", markers);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (model && !model.isDisposed()) {
        monaco.editor.setModelMarkers(model, "turtle-linter", []);
      }
    };
  }, [diagnostics, isReady]);

  // Handle value changes
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (newValue !== undefined) {
        onChange?.(newValue);
      }
    },
    [onChange]
  );

  return (
    <div className="turtle-editor-container" style={{ height }}>
      <Editor
        height="100%"
        defaultLanguage={TURTLE_LANGUAGE_ID}
        value={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        theme={effectiveTheme === "dark" ? "vs-dark" : "vs"}
        options={{
          readOnly,
          minimap: { enabled: minimap },
          lineNumbers: lineNumbers ? "on" : "off",
          wordWrap,
          fontSize,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          padding: { top: 8, bottom: 8 },
          // Performance optimizations
          folding: false,
          foldingStrategy: "indentation",
          renderWhitespace: "none",
          bracketPairColorization: { enabled: false },
          guides: {
            bracketPairs: false,
            indentation: false,
          },
          renderLineHighlight: "none",
          occurrencesHighlight: "off",
          selectionHighlight: false,
          links: true, // Enable clickable links
          colorDecorators: false,
          smoothScrolling: false,
          cursorBlinking: "solid",
          cursorSmoothCaretAnimation: "off",
          // Large file handling
          largeFileOptimizations: true,
          maxTokenizationLineLength: 5000,
          // Suggestions (keep minimal for performance)
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnCommitCharacter: false,
          parameterHints: { enabled: false },
          hover: { enabled: true, delay: 500 },
        }}
        loading={
          <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        }
      />
    </div>
  );
}

export default TurtleEditor;
