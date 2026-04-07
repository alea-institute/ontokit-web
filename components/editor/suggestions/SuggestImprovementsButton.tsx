"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestImprovementsButtonProps {
  onRequest: () => void;
  isLoading: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function SuggestImprovementsButton({
  onRequest,
  isLoading,
  disabled,
  disabledReason,
}: SuggestImprovementsButtonProps) {
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={disabled || isLoading}
      title={disabled ? disabledReason : "Get LLM suggestions for this section"}
      aria-label="Get LLM suggestions for this section"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
        "text-primary-600 hover:bg-primary-50",
        "dark:text-primary-400 dark:hover:bg-primary-900/20",
        (disabled || isLoading) && "opacity-50 cursor-not-allowed"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      Suggest improvements
    </button>
  );
}
