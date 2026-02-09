"use client";

import { useBranch } from "@/lib/context/BranchContext";
import { cn } from "@/lib/utils";
import { GitBranch, ArrowUp, AlertCircle } from "lucide-react";

interface BranchBadgeProps {
  className?: string;
  showCommitCount?: boolean;
}

export function BranchBadge({
  className,
  showCommitCount = true,
}: BranchBadgeProps) {
  const { currentBranch, defaultBranch, branches, isFeatureBranch } = useBranch();

  const currentBranchInfo = branches.find((b) => b.name === currentBranch);
  const commitsAhead = currentBranchInfo?.commits_ahead || 0;
  const commitsBehind = currentBranchInfo?.commits_behind || 0;

  if (!isFeatureBranch) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
        "border-amber-300 bg-amber-50 text-amber-700",
        "dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
        className
      )}
    >
      <GitBranch className="h-3.5 w-3.5" />
      <span className="font-medium">{currentBranch}</span>

      {showCommitCount && commitsAhead > 0 && (
        <span className="flex items-center gap-0.5 text-xs">
          <ArrowUp className="h-3 w-3" />
          {commitsAhead}
        </span>
      )}

      {commitsBehind > 0 && (
        <span
          className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-500"
          title={`${commitsBehind} commit${commitsBehind > 1 ? "s" : ""} behind ${defaultBranch}`}
        >
          <AlertCircle className="h-3 w-3" />
          {commitsBehind} behind
        </span>
      )}
    </div>
  );
}
