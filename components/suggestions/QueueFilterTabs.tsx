"use client";

import { Inbox, Layers, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** "all" is the pre-ladder behaviour — the server sees no `queue` param. */
export type QueueFilter = "triage" | "review" | "all";

const OPTIONS: {
  value: QueueFilter;
  label: string;
  hint: string;
  icon: typeof Inbox;
}[] = [
  {
    value: "triage",
    label: "Triage",
    hint: "Anonymous and new contributors — skim, dismiss, or accept",
    icon: Inbox,
  },
  {
    value: "review",
    label: "Trusted",
    hint: "Trusted contributors — these can auto-merge after the quiet period",
    icon: ShieldCheck,
  },
  { value: "all", label: "All", hint: "Every pending suggestion", icon: Layers },
];

interface QueueFilterTabsProps {
  value: QueueFilter;
  onChange: (next: QueueFilter) => void;
  /** Per-queue pending counts, when known. */
  counts?: Partial<Record<QueueFilter, number>>;
  disabled?: boolean;
}

/**
 * Segmented control splitting the pending list by submitter tier (R9, KTD13).
 *
 * Buttons rather than tabs: the list below is the same panel throughout, so
 * `aria-pressed` describes what is actually happening — a filter being on —
 * where a tablist would promise panels that do not exist.
 */
export function QueueFilterTabs({ value, onChange, counts, disabled }: QueueFilterTabsProps) {
  return (
    <div
      role="group"
      aria-label="Filter suggestions by contributor tier"
      className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        const count = counts?.[option.value];

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            disabled={disabled}
            title={option.hint}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              "focus:outline-hidden focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
            {typeof count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs",
                  isActive
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
