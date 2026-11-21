"use client";

import { Cog, Pencil, Sparkles, User } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { ChangeOrigin } from "@/lib/api/changes";
import { cn } from "@/lib/utils";

export const ORIGIN_LABELS: Record<ChangeOrigin, string> = {
  human: "Human",
  ai: "AI",
  ai_edited: "AI edited",
  system: "System",
};

const originDetails = {
  human: {
    icon: User,
    description: "Saved by a person; not matched to an AI suggestion.",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  ai: {
    icon: Sparkles,
    description: "Created from an AI suggestion accepted with its original label and definition.",
    color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  ai_edited: {
    icon: Sparkles,
    description: "Created from an AI suggestion with edits to the suggested label or definition.",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  system: {
    icon: Cog,
    description: "Recorded by an import, sync, normalization, or history backfill.",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

export function OriginBadge({ origin }: { origin: string }) {
  const knownOrigin = Object.hasOwn(originDetails, origin) ? origin as ChangeOrigin : "human";
  const { icon: Icon, description, color } = originDetails[knownOrigin];

  return (
    <Tooltip content={description}>
      <span
        tabIndex={0}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400",
          color,
        )}
      >
        <Icon aria-hidden="true" className="h-3 w-3" />
        {knownOrigin === "ai_edited" && <Pencil aria-hidden="true" className="h-3 w-3" />}
        {ORIGIN_LABELS[knownOrigin]}
      </span>
    </Tooltip>
  );
}
