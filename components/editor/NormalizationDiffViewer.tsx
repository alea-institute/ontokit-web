"use client";

import { useRef, useCallback } from "react";
import { DiffEditor, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerTurtleLanguage } from "@/lib/editor/languages/turtle";

interface NormalizationDiffViewerProps {
  originalContent: string;
  normalizedContent: string;
  onClose: () => void;
}

export function NormalizationDiffViewer({
  originalContent,
  normalizedContent,
  onClose,
}: NormalizationDiffViewerProps) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const isMountedRef = useRef(true);

  // Register turtle language and define custom theme before Monaco mounts
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerTurtleLanguage(monaco);

    // Define a custom theme with visible diff colors
    monaco.editor.defineTheme("diff-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        // Diff background colors for inserted/removed lines
        "diffEditor.insertedTextBackground": "#2ea04326",
        "diffEditor.removedTextBackground": "#f8514926",
        // Line highlighting for changed lines
        "diffEditor.insertedLineBackground": "#23863620",
        "diffEditor.removedLineBackground": "#da363320",
        // Border colors for inline changes
        "diffEditor.insertedTextBorder": "#2ea04350",
        "diffEditor.removedTextBorder": "#f8514950",
        // Gutter indicators
        "diffEditorGutter.insertedLineBackground": "#2ea04340",
        "diffEditorGutter.removedLineBackground": "#f8514940",
        // Overview ruler (scrollbar indicators)
        "diffEditorOverview.insertedForeground": "#2ea043",
        "diffEditorOverview.removedForeground": "#f85149",
      },
    });
  }, []);

  // Store editor reference for cleanup
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      if (isMountedRef.current) {
        editorRef.current = editor;
      }
    },
    []
  );

  // Handle close with proper cleanup
  const handleClose = useCallback(() => {
    isMountedRef.current = false;
    // Dispose editor before closing to prevent "TextModel got disposed" error
    if (editorRef.current) {
      editorRef.current.dispose();
      editorRef.current = null;
    }
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[95vw] max-w-7xl flex-col rounded-lg bg-white shadow-xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Normalization Preview
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review the changes that will be made to your ontology file
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Labels */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Original
          </div>
          <div className="flex-1 bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Normalized
          </div>
        </div>

        {/* Diff Editor */}
        <div className="flex-1">
          <DiffEditor
            original={originalContent}
            modified={normalizedContent}
            language="turtle"
            theme="diff-dark"
            beforeMount={handleBeforeMount}
            onMount={handleEditorDidMount}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: "on",
              wordWrap: "on",
              diffWordWrap: "on",
              renderIndicators: true,
              renderMarginRevertIcon: false,
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">
            Click &quot;Run Normalization&quot; in settings to apply these changes
          </p>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
