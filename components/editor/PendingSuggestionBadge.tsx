"use client";

import { Sparkles } from "lucide-react";

interface PendingSuggestionBadgeProps {
  count: number;
  onClick?: () => void;
}

export function PendingSuggestionBadge({
  count,
  onClick,
}: PendingSuggestionBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="status"
      aria-live="polite"
      title={`${count} pending suggestion${count !== 1 ? "s" : ""} — click to scroll to first`}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
      {count}
    </button>
  );
}
