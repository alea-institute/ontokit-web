"use client";

import { CheckCheck, Inbox, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

export type PRPartyTab = "queue" | "agenda" | "done";

const OPTIONS: {
  value: PRPartyTab;
  label: string;
  hint: string;
  icon: typeof Inbox;
}[] = [
  { value: "queue", label: "Queue", hint: "Pull requests waiting on your verdict", icon: Inbox },
  {
    value: "agenda",
    label: "Agenda",
    hint: "Parked for the party — talk these through live",
    icon: PartyPopper,
  },
  {
    value: "done",
    label: "Done",
    hint: "Concluded reviews; closed and merged pull requests are archived",
    icon: CheckCheck,
  },
];

interface QueueTabsProps {
  value: PRPartyTab;
  onChange: (next: PRPartyTab) => void;
  counts?: Partial<Record<PRPartyTab, number>>;
}

/**
 * Queue / Agenda / Done, on the suggestions QueueFilterTabs model.
 *
 * Buttons with `aria-pressed`, not a tablist: the panel below is the same card
 * list throughout, so a filter being on is what is actually happening — a
 * tablist would promise three panels that do not exist.
 */
export function QueueTabs({ value, onChange, counts }: QueueTabsProps) {
  return (
    <div
      role="group"
      aria-label="Filter the review queue"
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
            title={option.hint}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              "focus:outline-hidden focus:ring-2 focus:ring-primary-500",
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
