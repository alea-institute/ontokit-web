"use client";

import { Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/lib/hooks/useAutoSave";

interface AutoSaveStatusBarProps {
  status: SaveStatus;
  error?: string | null;
  validationError?: string | null;
  onRetry?: () => void;
}

export function AutoSaveStatusBar({ status, error, validationError, onRetry }: AutoSaveStatusBarProps) {
  // Show validation error inline regardless of status
  if (validationError) {
    return (
      <div className="border-t border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-900/10" role="status" aria-live="polite">
        <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-t border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-900/10" role="status" aria-live="assertive">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
          <span className="flex-1 truncate text-xs text-red-600 dark:text-red-400">
            {error || "Failed to save"}
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

  if (status === "saving") {
    return (
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50" role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Committing...</span>
        </div>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div className={cn(
        "border-t border-green-200 bg-green-50 px-4 py-2 transition-opacity duration-500 dark:border-green-900/50 dark:bg-green-900/10",
      )} role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
        </div>
      </div>
    );
  }

  if (status === "draft") {
    return (
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved draft</span>
        </div>
      </div>
    );
  }

  // idle — no bar
  return null;
}
