"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  History,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
} from "lucide-react";
import { useEntityHistory } from "@/lib/hooks/useEntityHistory";
import { cn } from "@/lib/utils";
import type { ChangeEventType } from "@/lib/api/analytics";

const EVENT_ICONS: Record<ChangeEventType, React.ReactNode> = {
  create: <Plus className="h-3.5 w-3.5 text-green-500" />,
  update: <Pencil className="h-3.5 w-3.5 text-blue-500" />,
  delete: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
  rename: <ArrowRight className="h-3.5 w-3.5 text-purple-500" />,
  reparent: <ArrowUp className="h-3.5 w-3.5 text-amber-500" />,
  deprecate: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
};

const EVENT_LABELS: Record<ChangeEventType, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  rename: "renamed",
  reparent: "reparented",
  deprecate: "deprecated",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface EntityHistoryTabProps {
  projectId: string;
  entityIri: string | null;
  accessToken?: string;
  branch?: string;
}

export function EntityHistoryTab({
  projectId,
  entityIri,
  accessToken,
  branch,
}: EntityHistoryTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = useEntityHistory(
    projectId,
    entityIri,
    accessToken,
    branch
  );

  if (!entityIri) return null;

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  if (!isLoading && total === 0) return null;

  return (
    <div className="flex gap-4">
      <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
        <span className="text-slate-400 dark:text-slate-500">
          <History className="h-4 w-4" />
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          History ({isLoading ? "..." : total})
        </button>
      </div>
      <div className="min-w-0 flex-1">
        {isLoading && (
          <div className="py-1">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        )}
        {isExpanded && events.length > 0 && (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />

            {events.map((event) => {
              const icon =
                EVENT_ICONS[event.event_type as ChangeEventType] || EVENT_ICONS.update;
              const label =
                EVENT_LABELS[event.event_type as ChangeEventType] || event.event_type;

              return (
                <div
                  key={event.id}
                  className="relative flex items-start gap-2.5 py-1.5 pl-0"
                >
                  <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {event.user_name || "Unknown"}
                    </span>{" "}
                    {label}
                    {event.changed_fields.length > 0 && (
                      <span className="text-slate-400 dark:text-slate-500">
                        {" "}
                        ({event.changed_fields.join(", ")})
                      </span>
                    )}
                    <span
                      className={cn(
                        "ml-1.5 text-[10px] text-slate-400 dark:text-slate-500"
                      )}
                      title={new Date(event.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
