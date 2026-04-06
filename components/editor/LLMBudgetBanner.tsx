"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";

interface LLMBudgetBannerProps {
  budgetExhausted: boolean;
  monthlySpentUsd: number;
  monthlyBudgetUsd: number | null;
}

export function LLMBudgetBanner({
  budgetExhausted,
  monthlySpentUsd,
  monthlyBudgetUsd,
}: LLMBudgetBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { announce } = useAnnounce();

  // Reset dismissed when exhaustion state changes (new exhaustion events re-show the banner)
  useEffect(() => {
    setDismissed(false);
  }, [budgetExhausted]);

  // Assertive announcement when transitioning to exhausted state
  useEffect(() => {
    if (budgetExhausted && !dismissed) {
      announce(
        "AI budget exhausted for this month. LLM features are disabled.",
        "assertive"
      );
    }
  }, [budgetExhausted, dismissed, announce]);

  if (dismissed) return null;

  // Compute whether to show banner
  const pct =
    monthlyBudgetUsd !== null && monthlyBudgetUsd > 0
      ? monthlySpentUsd / monthlyBudgetUsd
      : 0;

  const showWarning = !budgetExhausted && monthlyBudgetUsd !== null && pct >= 0.8 && pct < 1.0;
  const showExhausted = budgetExhausted;

  if (!showWarning && !showExhausted) return null;

  if (showExhausted) {
    return (
      <div
        className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        role="alert"
      >
        <span>
          AI budget exhausted for this month. LLM features are disabled. Manual suggestions continue to work.
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-3 flex-shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:text-red-300"
          aria-label="Dismiss budget warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Warning state (80-99%)
  const pctDisplay = Math.round(pct * 100);
  const remainingUsd =
    monthlyBudgetUsd !== null ? monthlyBudgetUsd - monthlySpentUsd : 0;

  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
      <span>
        AI budget {pctDisplay}% used this month. You have ${remainingUsd.toFixed(2)} remaining.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 flex-shrink-0 rounded p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:hover:text-amber-300"
        aria-label="Dismiss budget warning"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
