"use client";

import { type PullRequest } from "@/lib/api/pullRequests";
import { cn } from "@/lib/utils";
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  MessageSquare,
  Check,
  Clock,
  User,
} from "lucide-react";
import Link from "next/link";

interface PRListItemProps {
  pr: PullRequest;
  projectId: string;
  className?: string;
}

export function PRListItem({ pr, projectId, className }: PRListItemProps) {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "today";
    } else if (diffDays === 1) {
      return "yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getStatusIcon = () => {
    switch (pr.status) {
      case "merged":
        return <GitMerge className="h-5 w-5 text-purple-600" />;
      case "closed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <GitPullRequest className="h-5 w-5 text-green-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (pr.status) {
      case "merged":
        return (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Merged
          </span>
        );
      case "closed":
        return (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Closed
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Open
          </span>
        );
    }
  };

  return (
    <Link
      href={`/projects/${projectId}/pull-requests/${pr.pr_number}`}
      className={cn(
        "block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/50",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="mt-0.5">{getStatusIcon()}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title and number */}
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-slate-900 dark:text-slate-100">
              {pr.title}
            </h3>
            <span className="text-sm text-slate-500">#{pr.pr_number}</span>
            {getStatusBadge()}
          </div>

          {/* Branch info */}
          <div className="mt-1 text-sm text-slate-500">
            <span className="font-mono text-xs">{pr.source_branch}</span>
            <span className="mx-2">into</span>
            <span className="font-mono text-xs">{pr.target_branch}</span>
          </div>

          {/* Meta info */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {/* Author */}
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {pr.author?.name || pr.author_id}
            </span>

            {/* Opened date */}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {pr.status === "merged" && pr.merged_at
                ? `merged ${formatDate(pr.merged_at)}`
                : `opened ${formatDate(pr.created_at)}`}
            </span>

            {/* Comments */}
            {pr.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {pr.comment_count}
              </span>
            )}

            {/* Approvals */}
            {pr.approval_count > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" />
                {pr.approval_count} approved
              </span>
            )}

            {/* GitHub link */}
            {pr.github_pr_url && (
              <a
                href={pr.github_pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary-600"
                onClick={(e) => e.stopPropagation()}
              >
                View on GitHub
              </a>
            )}
          </div>
        </div>

        {/* Commits ahead */}
        {pr.commits_ahead > 0 && (
          <div className="text-right">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {pr.commits_ahead}
            </span>
            <p className="text-xs text-slate-400">
              commit{pr.commits_ahead > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
