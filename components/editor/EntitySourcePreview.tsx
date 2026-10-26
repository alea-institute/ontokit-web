"use client";

import { useMemo, useState } from "react";
import { Copy, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractEntitySource } from "@/lib/ontology/entitySource";

export interface EntitySourcePreviewProps {
  iri: string | null;
  sourceContent: string;
  filePath?: string;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenFullSource: (iri: string) => void;
}

export function EntitySourcePreview({ iri, sourceContent, filePath, isLoading, isReady, error, onRetry, onOpenFullSource }: EntitySourcePreviewProps) {
  const context = useMemo(() => ({ iri, sourceContent, filePath, isLoading, isReady, error }), [iri, sourceContent, filePath, isLoading, isReady, error]);
  const [feedback, setFeedback] = useState<{ context: object; message: string } | null>(null);
  const result = useMemo(() => iri && isReady && !isLoading && !error
    ? extractEntitySource(sourceContent, iri) : null, [iri, sourceContent, isReady, isLoading, error]);
  const fileLabel = (filePath || "Current ontology file").replace(/[\r\n\u2028\u2029]/g, " ");
  const snippet = result?.status === "available"
    ? result.excerpts.map(({ text, startLine }) => `# File: ${fileLabel}, line ${startLine}\n${text}`).join("\n\n") : null;

  async function copySnippet() {
    if (snippet === null) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setFeedback({ context, message: "Snippet copied" });
    } catch {
      setFeedback({ context, message: "Could not copy. Select the snippet and copy it manually." });
    }
  }

  function renderSourceBody() {
    if (isLoading) return <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading entity source…</p>;
    if (error) return (
      <div role="alert" className="space-y-3 text-sm text-red-700 dark:text-red-300">
        <p>Failed to load source: {error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    );
    if (!isReady) return <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading entity source…</p>;
    if (snippet !== null) return (
      <pre aria-label="Source excerpts" className="w-max min-w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><code>{snippet}</code></pre>
    );
    return (
      <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
        <h3 className="font-medium text-slate-700 dark:text-slate-200">No direct statements available</h3>
        <p>{result?.status === "unavailable" ? result.reason : "Source is unavailable."}</p>
      </div>
    );
  }

  if (!iri) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Select an entity in the tree to inspect its source.</div>;

  return (
    <section aria-label="Entity source preview" className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-700">
        <p className="break-all font-mono text-xs text-slate-700 dark:text-slate-200">{iri}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Direct statements in the current source buffer. Pending detail edits appear after they reach this buffer.</p>
        <div className="flex flex-wrap gap-2">
          {snippet !== null && <Button variant="outline" size="sm" onClick={copySnippet}><Copy className="mr-2 h-4 w-4" />Copy snippet</Button>}
          <Button variant="outline" size="sm" onClick={() => onOpenFullSource(iri)}><FileCode className="mr-2 h-4 w-4" />Open full source</Button>
        </div>
        <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-300">{feedback?.context === context ? feedback.message : ""}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {renderSourceBody()}
      </div>
    </section>
  );
}
