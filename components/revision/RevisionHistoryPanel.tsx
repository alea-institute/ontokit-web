"use client";

import { useCallback, useEffect, useState } from "react";
import { revisionsApi, type RevisionCommit } from "@/lib/api/revisions";
import { cn } from "@/lib/utils";
import {
  History,
  GitMerge,
  GitBranch,
  User,
  Calendar,
  X,
} from "lucide-react";
import { useBranch } from "@/lib/context/BranchContext";
import { Button } from "@/components/ui/button";
import { GitGraph } from "./GitGraph";
import { CommitDetailView } from "./CommitDetailView";
import { DEFAULT_GRAPH_CONFIG } from "@/lib/git-graph/types";

interface RevisionHistoryPanelProps {
  projectId: string;
  accessToken?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectRevision?: (commit: RevisionCommit) => void;
  className?: string;
}

const ROW_HEIGHT = DEFAULT_GRAPH_CONFIG.cellHeight;

export function RevisionHistoryPanel({
  projectId,
  accessToken,
  isOpen,
  onClose,
  onSelectRevision,
  className,
}: RevisionHistoryPanelProps) {
  const [commits, setCommits] = useState<RevisionCommit[]>([]);
  const [refs, setRefs] = useState<Record<string, string[]> | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<RevisionCommit | null>(null);
  const { defaultBranch } = useBranch();

  const loadHistory = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await revisionsApi.getHistory(projectId, accessToken);
      setCommits(response.commits);
      setRefs(response.refs);
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
    setSelectedCommit(commit);
    onSelectRevision?.(commit);
  };

  const handleBackToList = () => {
    setSelectedCommit(null);
  };

  const handleGraphSelect = (hash: string) => {
    const commit = commits.find((c) => c.hash === hash);
    if (commit) {
      handleSelectCommit(commit);
    }
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
        "absolute right-0 top-0 z-30 h-full w-[768px] border-l border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800",
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
          className="rounded-xs p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-56px)]">
        {selectedCommit ? (
          <CommitDetailView
            commit={selectedCommit}
            projectId={projectId}
            accessToken={accessToken}
            onBack={handleBackToList}
            commits={commits}
          />
        ) : (
          <div className="h-full overflow-y-auto">
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
              <div className="flex">
                {/* Git Graph */}
                <div className="flex-shrink-0 border-r border-slate-100 dark:border-slate-700/50">
                  <GitGraph
                    commits={commits}
                    selectedHash={selectedHash}
                    onSelectCommit={handleGraphSelect}
                    refs={refs}
                    defaultBranch={defaultBranch}
                    className="pt-0"
                  />
                </div>

                {/* Commit List */}
                <div className="min-w-0 flex-1">
                  {commits.map((commit) => (
                    <button
                      key={commit.hash}
                      className={cn(
                        "w-full text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50",
                        selectedHash === commit.hash &&
                          "bg-primary-50 dark:bg-primary-900/20"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => handleSelectCommit(commit)}
                    >
                      <div className="flex h-full items-center px-3">
                        <div className="min-w-0 flex-1">
                          {/* Commit message */}
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {commit.message}
                          </p>

                          {/* Branch ref badges */}
                          {(refs?.[commit.hash] ?? []).length > 0 && (
                            <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                              {(refs?.[commit.hash] ?? []).map((ref) => (
                                <span
                                  key={ref}
                                  title={ref}
                                  className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                >
                                  <GitBranch className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{ref}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Merge badge */}
                          {commit.is_merge && commit.merged_branch && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              <GitMerge className="h-2.5 w-2.5" />
                              {commit.merged_branch}
                            </span>
                          )}

                          {/* Metadata row */}
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono" title={commit.hash}>
                              {commit.short_hash}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <User className="h-3 w-3" />
                              <span className="max-w-[80px] truncate">
                                {commit.author_name}
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(commit.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
