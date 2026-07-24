"use client";

import { Check, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  /** Count of rows the current filter shows, for the select-all affordance. */
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAccept: () => void;
  onBulkDismiss: () => void;
  isBusy?: boolean;
  /** Server cap on one batch (KTD/U5: 100). Over it, the request is refused. */
  maxBatchSize?: number;
}

/**
 * The bar that makes junk dismissible in seconds (R9).
 *
 * Appears only once something is selected — an always-present action bar for
 * an empty selection is a row of dead buttons — and announces itself politely
 * so a screen-reader user learns the selection count changed without losing
 * their place in the list.
 */
export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onClearSelection,
  onBulkAccept,
  onBulkDismiss,
  isBusy = false,
  maxBatchSize = 100,
}: BulkActionBarProps) {
  const overCap = selectedCount > maxBatchSize;

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-900/50 dark:bg-primary-900/20"
      role="region"
      aria-label="Bulk actions"
    >
      <p className="text-sm font-medium text-primary-800 dark:text-primary-200" aria-live="polite">
        {selectedCount} selected
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          disabled={isBusy || totalCount === 0}
          className="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
        />
        Select all {totalCount}
      </label>

      <div className="ml-auto flex items-center gap-2">
        {overCap && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Up to {maxBatchSize} at a time
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onClearSelection}
          disabled={isBusy}
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={onBulkDismiss}
          disabled={isBusy || overCap}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Dismiss
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
          onClick={onBulkAccept}
          disabled={isBusy || overCap}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Accept
        </Button>
      </div>
    </div>
  );
}
