"use client";

import { useId } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestImprovementsButtonProps {
  onRequest: () => void;
  isLoading: boolean;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function SuggestImprovementsButton({
  onRequest,
  isLoading,
  disabled,
  disabledReason,
  label,
  ref,
}: SuggestImprovementsButtonProps) {
  const reasonId = useId();
  const reason = disabled ? disabledReason : undefined;
  const button = (
    <button
      ref={ref}
      type="button"
      onClick={() => { if (!disabled && !isLoading) onRequest(); }}
      disabled={isLoading || (disabled && !reason)}
      aria-disabled={disabled || isLoading || undefined}
      title={disabled ? disabledReason : "Get LLM suggestions for this section"}
      aria-label={label ?? "Get LLM suggestions for this section"}
      aria-describedby={reason ? reasonId : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
        "text-primary-600 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-600",
        "dark:text-primary-400 dark:hover:bg-primary-900/20 dark:focus-visible:outline-primary-400",
        (disabled || isLoading) && "opacity-50 cursor-not-allowed"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="h-3 w-3" aria-hidden="true" />
      )}
      {label ?? "Suggest improvements"}
    </button>
  );

  return reason ? (
    <>
      {button}
      <span id={reasonId} className="sr-only">{reason}</span>
    </>
  ) : button;
}
