"use client";

import { Loader2, Check, AlertTriangle, Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SuggestionStatus } from "@/lib/hooks/useSuggestionSession";

interface SuggestionStatusBarProps {
  status: SuggestionStatus;
  changesCount: number;
  error?: string | null;
  onSubmit: () => void;
  onDiscard: () => void;
  onRetry?: () => void;
}

export function SuggestionStatusBar({
  status,
  changesCount,
  error,
  onSubmit,
  onDiscard,
  onRetry,
}: SuggestionStatusBarProps) {
  if (status === "idle") return null;

  if (status === "submitted") {
    return (
      <div className="border-t border-green-200 bg-green-50 px-4 py-2 dark:border-green-900/50 dark:bg-green-900/10">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs text-green-600 dark:text-green-400">
            Suggestions submitted for review
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-t border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-900/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
          <span className="flex-1 truncate text-xs text-red-600 dark:text-red-400">
            {error || "Failed to save suggestion"}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "submitting") {
    return (
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Submitting suggestions for review...
          </span>
        </div>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
          <span className="flex-1 text-xs text-amber-600 dark:text-amber-400">
            Saving suggestion...
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={onSubmit}
            disabled
          >
            <Lightbulb className="h-3 w-3" />
            Submit ({changesCount})
          </Button>
        </div>
      </div>
    );
  }

  // status === "active"
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/50 dark:bg-amber-900/10">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="flex-1 text-xs text-amber-600 dark:text-amber-400">
          {changesCount === 0
            ? "Suggestion mode active"
            : `${changesCount} unsaved ${changesCount === 1 ? "change" : "changes"}`}
        </span>
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Discard
        </button>
        {changesCount > 0 && (
          <Button
            variant="primary"
            size="sm"
            className="h-6 gap-1 bg-amber-600 px-2 text-xs hover:bg-amber-700"
            onClick={onSubmit}
          >
            <Lightbulb className="h-3 w-3" />
            Submit ({changesCount})
          </Button>
        )}
      </div>
    </div>
  );
}
