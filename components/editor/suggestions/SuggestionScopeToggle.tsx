"use client";

import { cn } from "@/lib/utils";

export type SuggestionScope = "this-class" | "siblings" | "descendants";

interface SuggestionScopeToggleProps {
  value: SuggestionScope;
  onChange: (scope: SuggestionScope) => void;
}

const OPTIONS: { value: SuggestionScope; label: string }[] = [
  { value: "this-class", label: "This class" },
  { value: "siblings", label: "Siblings" },
  { value: "descendants", label: "Descendants" },
];

export function SuggestionScopeToggle({
  value,
  onChange,
}: SuggestionScopeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Suggestion scope"
      className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 text-xs"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1 transition-colors first:rounded-l-md last:rounded-r-md",
              isActive
                ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium"
                : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
