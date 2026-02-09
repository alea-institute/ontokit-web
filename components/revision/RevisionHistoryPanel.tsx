"use client";

import { useCallback, useEffect, useState } from "react";
import { revisionsApi, type RevisionCommit } from "@/lib/api/revisions";
import { cn } from "@/lib/utils";
import {
  History,
  ChevronDown,
  ChevronRight,
  GitCommit,
  User,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevisionHistoryPanelProps {
  projectId: string;
  accessToken?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectRevision?: (commit: RevisionCommit) => void;
  className?: string;
}

export function RevisionHistoryPanel({
  projectId,
  accessToken,
  isOpen,
  onClose,
  onSelectRevision,
  className,
}: RevisionHistoryPanelProps) {
  const [commits, setCommits] = useState<RevisionCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await revisionsApi.getHistory(projectId, accessToken);
      setCommits(response.commits);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load history";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleSelectCommit = (commit: RevisionCommit) => {
    setSelectedHash(commit.hash);
    onSelectRevision?.(commit);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute right-0 top-0 z-30 h-full w-80 border-l border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h3 className="font-medium">Revision History</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-56px)] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-red-500">
            {error}
          </div>
        ) : commits.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No revision history yet
          </div>
        ) : (
          <div className="py-2">
            {commits.map((commit, index) => (
              <button
                key={commit.hash}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50",
                  selectedHash === commit.hash &&
                    "bg-primary-50 dark:bg-primary-900/20"
                )}
                onClick={() => handleSelectCommit(commit)}
              >
                <div className="flex items-start gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center pt-1">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full",
                        index === 0
                          ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700"
                      )}
                    >
                      <GitCommit className="h-3.5 w-3.5" />
                    </div>
                    {index < commits.length - 1 && (
                      <div className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-600" />
                    )}
                  </div>

                  {/* Commit info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {commit.message}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span
                        className="font-mono"
                        title={commit.hash}
                      >
                        {commit.short_hash}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {commit.author_name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {formatDate(commit.timestamp)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact trigger button for the history panel
interface HistoryButtonProps {
  onClick: () => void;
  isOpen: boolean;
  className?: string;
}

export function HistoryButton({ onClick, isOpen, className }: HistoryButtonProps) {
  return (
    <Button
      variant={isOpen ? "secondary" : "ghost"}
      size="sm"
      className={cn("gap-2", className)}
      onClick={onClick}
    >
      <History className="h-4 w-4" />
      <span className="hidden sm:inline">History</span>
    </Button>
  );
}
