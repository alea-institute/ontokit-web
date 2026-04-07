"use client";

export function SuggestionSkeleton() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Sparkle placeholder */}
      <div className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-slate-200 mt-0.5 dark:bg-slate-700" />

      {/* Content line placeholder */}
      <div className="h-4 w-3/4 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />

      {/* Badge placeholder */}
      <div className="h-4 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
    </div>
  );
}
