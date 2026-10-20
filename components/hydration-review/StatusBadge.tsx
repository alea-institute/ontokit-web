"use client";

import type { Review } from "@/lib/hydration-review/reviews";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  SAME: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  MINOR: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  MATERIAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  draft: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  unreviewed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/** A row's review state. Unreviewed rows say so; nothing defaults to approved. */
export function reviewLabel(review: Review | undefined): { text: string; tone: string } {
  if (!review || (review.disposition === null && review.classification === null)) {
    return { text: "Unreviewed", tone: "unreviewed" };
  }
  if (review.disposition === null) return { text: `${review.classification} · draft`, tone: "draft" };
  const cls = review.classification ?? "unclassified";
  const disp = { accept: "accepted", correct: "corrected", reject: "rejected" }[review.disposition];
  return { text: `${cls} · ${disp}`, tone: review.classification ?? "draft" };
}

export function StatusBadge({ review }: { review: Review | undefined }) {
  const { text, tone } = reviewLabel(review);
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium", TONE[tone])}>
      {text}
    </span>
  );
}

export function PartitionBadge({ partition }: { partition: string }) {
  return (
    <span
      title={
        partition === "keep"
          ? "Passed the 2026-08-05 write-back gates"
          : "Failed at least one write-back gate; queued for regeneration"
      }
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        partition === "keep"
          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
      )}
    >
      {partition}
    </span>
  );
}
