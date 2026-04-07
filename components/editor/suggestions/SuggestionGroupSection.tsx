"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface SuggestionGroupSectionProps {
  entityLabel: string;
  suggestionCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SuggestionGroupSection({
  entityLabel,
  suggestionCount,
  children,
  defaultOpen = false,
}: SuggestionGroupSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 py-1 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>{entityLabel}</span>
        <span className="text-xs text-slate-400">
          ({suggestionCount} suggestion{suggestionCount !== 1 ? "s" : ""})
        </span>
      </button>

      {isOpen && (
        <div className="ml-5 mt-1 space-y-1.5 transition-all duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
