"use client";

import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShardMarkStatus = "approved" | "rejected";

export interface ShardMark {
  status: ShardMarkStatus;
  feedback?: string;
}

interface ShardReviewMarkerProps {
  shardId: string;
  shardLabel: string;
  mark?: ShardMark;
  onChange: (shardId: string, mark: ShardMark | undefined) => void;
}

export function ShardReviewMarker({
  shardId,
  shardLabel: _shardLabel,
  mark,
  onChange,
}: ShardReviewMarkerProps) {
  // Local feedback state for the textarea — initialized from existing mark
  const [localFeedback, setLocalFeedback] = useState(mark?.feedback ?? "");

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalFeedback(newValue);
    onChange(shardId, { status: "rejected", feedback: newValue });
  };

  // ── Approved state ─────────────────────────────────────────────────────────
  if (mark?.status === "approved") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800"
      >
        <div className="flex flex-1 items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Shard approved
          </span>
        </div>
        <button
          onClick={() => onChange(shardId, undefined)}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Clear
        </button>
      </div>
    );
  }

  // ── Rejected state ─────────────────────────────────────────────────────────
  if (mark?.status === "rejected") {
    return (
      <div
        className="flex flex-col gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Shard rejected
            </span>
          </div>
          <button
            onClick={() => onChange(shardId, undefined)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Clear
          </button>
        </div>
        <textarea
          value={localFeedback}
          onChange={handleFeedbackChange}
          placeholder="What should the submitter change about this shard?"
          className={cn(
            "w-full resize-none rounded-md border border-slate-200 p-2 text-sm",
            "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            "transition-all duration-100",
            "focus:outline-none focus:ring-1 focus:ring-primary-500"
          )}
          rows={3}
          maxLength={500}
        />
      </div>
    );
  }

  // ── Unmarked state (default) ───────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-green-300 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
        onClick={() => onChange(shardId, { status: "approved" })}
      >
        <CheckCircle className="h-4 w-4" />
        Approve shard
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        onClick={() => onChange(shardId, { status: "rejected", feedback: "" })}
      >
        <XCircle className="h-4 w-4" />
        Reject shard
      </Button>
    </div>
  );
}
