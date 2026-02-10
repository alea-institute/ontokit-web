"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import { Save, RotateCcw, AlertCircle, CheckCircle, Loader2, FileText, GitBranch } from "lucide-react";
import { TurtleEditor, type TurtleDiagnostic } from "./TurtleEditor";
import { Button } from "@/components/ui/button";
import { lintApi, type LintIssue } from "@/lib/api/lint";
import type { IndexWorkerResult } from "@/lib/editor/indexWorker";

export interface OntologySourceEditorProps {
  /** Project ID for lint integration */
  projectId: string;
  /** Initial Turtle content */
  initialValue: string;
  /** Access token for API calls */
  accessToken?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Callback when content is saved */
  onSave?: (value: string) => Promise<void>;
  /** Callback when navigating to a class IRI */
  onNavigateToClass?: (iri: string) => void;
  /** Height of the editor */
  height?: string;
}

/**
 * Full-featured ontology source editor with linting integration
 */
export function OntologySourceEditor({
  projectId,
  initialValue,
  accessToken,
  readOnly = false,
  onSave,
  onNavigateToClass,
  height = "calc(100vh - 200px)",
}: OntologySourceEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [originalValue, setOriginalValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [isLoadingLint, setIsLoadingLint] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const hasChanges = value !== originalValue;

  // Diagnostics state - computed in Web Worker
  const [diagnostics, setDiagnostics] = useState<TurtleDiagnostic[]>([]);
  const [issuePositions, setIssuePositions] = useState<Map<string, { line: number; startCol: number; endCol: number }>>(new Map());
  const [diagnosticsReady, setDiagnosticsReady] = useState(false);
  const [indexStats, setIndexStats] = useState<{ linesProcessed: number; irisIndexed: number; localNamesIndexed: number; issuesMatched: number; timeMs: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Handle editor ready
  const handleEditorReady = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
  }, []);

  // Scroll to a specific line in the editor
  const scrollToLine = useCallback((lineNumber: number, column = 1) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column });
      editorRef.current.focus();
    }
  }, []);

  // Fetch lint issues on mount and when projectId changes
  useEffect(() => {
    const fetchLintIssues = async () => {
      if (!projectId) return;

      setIsLoadingLint(true);
      try {
        const response = await lintApi.getIssues(projectId, accessToken, {
          include_resolved: false,
          limit: 100, // Limit to avoid performance issues
        });
        setLintIssues(response.items);
      } catch (error) {
        console.error("Failed to fetch lint issues:", error);
      } finally {
        setIsLoadingLint(false);
      }
    };

    fetchLintIssues();
  }, [projectId, accessToken]);

  // Compute diagnostics in Web Worker
  useEffect(() => {
    if (!lintIssues.length || !value) {
      setDiagnostics([]);
      setIssuePositions(new Map());
      setDiagnosticsReady(true);
      setIndexStats(null);
      return;
    }

    // Reset state
    setDiagnosticsReady(false);
    setIndexStats(null);

    // Create Web Worker for indexing
    const worker = new Worker(
      new URL('@/lib/editor/indexWorker.ts', import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<IndexWorkerResult>) => {
      const result = event.data;

      // Convert positions array back to Map
      const positions = new Map<string, { line: number; startCol: number; endCol: number }>();
      for (const [id, pos] of result.positions) {
        positions.set(id, { line: pos.line, startCol: pos.col, endCol: pos.col + pos.len });
      }

      // Convert diagnostics
      const diags: TurtleDiagnostic[] = result.diagnostics.map((d) => ({
        startLineNumber: d.startLineNumber,
        startColumn: d.startColumn,
        endLineNumber: d.endLineNumber,
        endColumn: d.endColumn,
        message: d.message,
        severity: d.severity as "error" | "warning" | "info",
      }));

      setDiagnostics(diags);
      setIssuePositions(positions);
      setIndexStats(result.stats);
      setDiagnosticsReady(true);

      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = (error) => {
      console.error("Index worker error:", error);
      // Fallback: set diagnostics without positions
      const diags: TurtleDiagnostic[] = lintIssues
        .filter((issue) => issue.subject_iri)
        .map((issue) => ({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: `[${issue.rule_id}] ${issue.message}`,
          severity: issue.issue_type as "error" | "warning" | "info",
        }));
      setDiagnostics(diags);
      setDiagnosticsReady(true);
      worker.terminate();
      workerRef.current = null;
    };

    // Send data to worker
    worker.postMessage({
      type: 'index',
      content: value,
      issues: lintIssues.map((i) => ({
        id: i.id,
        subject_iri: i.subject_iri,
        rule_id: i.rule_id,
        message: i.message,
        issue_type: i.issue_type,
      })),
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [lintIssues, value]);

  // Handle clicking on an issue in the Problems panel
  const handleProblemClick = useCallback((issue: LintIssue) => {
    const position = issuePositions.get(issue.id);
    if (position) {
      scrollToLine(position.line, position.startCol);
    }
  }, [issuePositions, scrollToLine]);

  // Handle content changes
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setSaveError(null);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || !hasChanges) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(value);
      setOriginalValue(value);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [onSave, value, hasChanges]);

  // Handle revert
  const handleRevert = useCallback(() => {
    setValue(originalValue);
    setSaveError(null);
  }, [originalValue]);

  // Handle diagnostic click
  const handleDiagnosticClick = useCallback(
    (diagnostic: TurtleDiagnostic) => {
      // Try to extract IRI from the message or find the related lint issue
      const issue = lintIssues.find((i) =>
        diagnostic.message.includes(i.rule_id)
      );
      if (issue?.subject_iri && onNavigateToClass) {
        onNavigateToClass(issue.subject_iri);
      }
    },
    [lintIssues, onNavigateToClass]
  );

  // Count issues by severity
  const errorCount = lintIssues.filter((i) => i.issue_type === "error").length;
  const warningCount = lintIssues.filter((i) => i.issue_type === "warning").length;
  const infoCount = lintIssues.filter((i) => i.issue_type === "info").length;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Source Editor
          </h3>

          {/* Status indicators */}
          <div className="flex items-center gap-3 text-sm">
            {isLoadingLint ? (
              <span className="flex items-center gap-1 text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading issues...
              </span>
            ) : !diagnosticsReady && lintIssues.length > 0 ? (
              <span className="flex items-center gap-1 text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Indexing...
              </span>
            ) : lintIssues.length === 0 ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                No issues
              </span>
            ) : (
              <>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {errorCount} error{errorCount !== 1 ? "s" : ""}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    {warningCount} warning{warningCount !== 1 ? "s" : ""}
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    {infoCount} info
                  </span>
                )}
              </>
            )}
          </div>

          {hasChanges && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              disabled={!hasChanges || isSaving}
              className="gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              Revert
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-1"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Error message */}
      {saveError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {saveError}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <TurtleEditor
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          height={height}
          diagnostics={diagnostics}
          onDiagnosticClick={handleDiagnosticClick}
          onReady={handleEditorReady}
          onInternalLinkClick={onNavigateToClass}
          minimap={false}
          lineNumbers={true}
          wordWrap="off"
          fontSize={13}
        />
      </div>

      {/* Problems panel (optional - shows when there are issues) */}
      {lintIssues.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Problems ({lintIssues.length})
            {issuePositions.size > 0 && issuePositions.size < lintIssues.length && (
              <span className="ml-2 text-slate-400">• {issuePositions.size} with line numbers</span>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* Sort issues: those with positions first, then by line number */}
            {[...lintIssues]
              .sort((a, b) => {
                const posA = issuePositions.get(a.id);
                const posB = issuePositions.get(b.id);
                // Issues with positions come first
                if (posA && !posB) return -1;
                if (!posA && posB) return 1;
                // If both have positions, sort by line number
                if (posA && posB) return posA.line - posB.line;
                return 0;
              })
              .slice(0, 20)
              .map((issue) => (
              <button
                key={issue.id}
                onClick={() => handleProblemClick(issue)}
                className="flex w-full items-start gap-3 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span
                  className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                    issue.issue_type === "error"
                      ? "bg-red-500"
                      : issue.issue_type === "warning"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-slate-700 dark:text-slate-300">
                    {issue.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {issuePositions.get(issue.id) && (
                      <span className="font-mono">
                        Ln {issuePositions.get(issue.id)?.line}
                      </span>
                    )}
                    {issue.subject_iri && (
                      <span className="truncate">
                        {issue.subject_iri.includes("#")
                          ? issue.subject_iri.split("#").pop()
                          : issue.subject_iri.split("/").pop()}
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  {issue.rule_id}
                </span>
              </button>
            ))}
            {lintIssues.length > 20 && (
              <div className="px-4 py-2 text-center text-xs text-slate-500">
                And {lintIssues.length - 20} more issues...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-100 px-4 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-4">
          {/* File info */}
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <FileText className="h-3 w-3" />
            {value.split("\n").length.toLocaleString()} lines
          </span>

          {/* Indexing status */}
          {!diagnosticsReady && lintIssues.length > 0 ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Indexing IRIs...
            </span>
          ) : indexStats ? (
            <span className="text-slate-500 dark:text-slate-400">
              Indexed {indexStats.irisIndexed.toLocaleString()} IRIs in {indexStats.timeMs}ms
              {indexStats.issuesMatched > 0 && ` • ${indexStats.issuesMatched} issues mapped`}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {/* Issue summary */}
          {diagnosticsReady && lintIssues.length > 0 && (
            <span className="flex items-center gap-2">
              {errorCount > 0 && (
                <span className="text-red-600 dark:text-red-400">{errorCount} errors</span>
              )}
              {warningCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{warningCount} warnings</span>
              )}
              {infoCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">{infoCount} info</span>
              )}
            </span>
          )}

          {/* Ready indicator */}
          {diagnosticsReady && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default OntologySourceEditor;
