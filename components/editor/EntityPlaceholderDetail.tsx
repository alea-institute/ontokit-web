"use client";

import { cn, getLocalName } from "@/lib/utils";

export function EntityPlaceholderDetail({
  selectedIri,
  entityType,
}: {
  selectedIri: string | null;
  entityType: string;
}) {
  if (!selectedIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a {entityType.toLowerCase()} to view its details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border",
          entityType === "Property"
            ? "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700"
            : "bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700"
        )}>
          <span className={cn(
            "text-sm font-bold",
            entityType === "Property" ? "text-emerald-700 dark:text-emerald-400" : "text-purple-700 dark:text-purple-400"
          )}>
            {entityType[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {getLocalName(selectedIri)}
          </h2>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={selectedIri}>
            {selectedIri}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {entityType} detail editing will be available in a future update.
        </p>
      </div>
    </div>
  );
}
