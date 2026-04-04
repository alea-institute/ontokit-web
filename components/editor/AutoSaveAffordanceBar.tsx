"use client";

import { Cloud, Loader2, Check, AlertTriangle, Save, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { Tooltip } from "@/components/ui/tooltip";
import Link from "next/link";
import type { SaveStatus } from "@/lib/hooks/useAutoSave";

interface AutoSaveAffordanceBarProps {
  status: SaveStatus;
  error?: string | null;
  validationError?: string | null;
  onRetry?: () => void;
  onManualSave?: () => void;
  onCancel?: () => void;
}

export function AutoSaveAffordanceBar({
  status,
  error,
  validationError,
  onRetry,
  onManualSave,
  onCancel,
}: AutoSaveAffordanceBarProps) {
  const hideSaveButton = useEditorModeStore((s) => s.hideSaveButton);

  const effectiveStatus = validationError ? "validationError" : status;

  const saveEnabled = !hideSaveButton && effectiveStatus === "draft" && !!onManualSave;
  const saveSpinning = !hideSaveButton && effectiveStatus === "saving";

  return (
    <div
      className={cn(
        "border-b px-4 py-2 transition-colors",
        effectiveStatus === "error" || effectiveStatus === "validationError"
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
          : effectiveStatus === "draft"
            ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10"
            : effectiveStatus === "saved"
              ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/10"
              : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50",
      )}
      role="status"
      aria-live={effectiveStatus === "error" || effectiveStatus === "validationError" ? "assertive" : "polite"}
    >
      <div className="flex items-center justify-between gap-3 min-h-5">
        {/* Left side — status */}
        <div className="flex items-center gap-2 min-w-0">
          {effectiveStatus === "validationError" && (
            <span className="text-xs text-red-600 dark:text-red-400">{validationError}</span>
          )}

          {effectiveStatus === "error" && (
            <>
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
            </>
          )}

          {effectiveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Saving...</span>
            </>
          )}

          {effectiveStatus === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
            </>
          )}

          {effectiveStatus === "draft" && (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-600 dark:text-amber-400">Draft saved</span>
            </>
          )}

          {effectiveStatus === "idle" && (
            <>
              <Cloud className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span
                className="text-xs text-slate-400 dark:text-slate-500"
                title="Changes save as a local draft on blur, and commit to git when you navigate away"
              >
                Auto-save on
              </span>
            </>
          )}
        </div>

        {/* Right side — save + cancel buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {!hideSaveButton && (
            <>
              <button
                onClick={saveEnabled ? onManualSave : undefined}
                disabled={!saveEnabled}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  saveEnabled
                    ? "bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
                    : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500",
                )}
              >
                {saveSpinning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
              <Tooltip
                side="bottom"
                content={
                  <span>
                    You can hide this button in{" "}
                    <Link href="/settings#save-button" className="underline hover:text-slate-300 dark:hover:text-slate-600">
                      Settings
                    </Link>
                    . Changes still auto-save when you navigate away.
                  </span>
                }
              >
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              title="Discard changes"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
