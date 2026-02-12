"use client";

import { useCallback, useEffect, useState } from "react";
import {
  revisionsApi,
  type RevisionCommit,
  type RevisionDiffResponse,
} from "@/lib/api/revisions";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Calendar,
  Hash,
  GitBranch,
  GitMerge,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  FileText,
  FileCode,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommitDetailViewProps {
  commit: RevisionCommit;
  projectId: string;
  accessToken?: string;
  onBack: () => void;
  commits: RevisionCommit[];
  className?: string;
}

export function CommitDetailView({
  commit,
  projectId,
  accessToken,
  onBack,
  commits,
  className,
}: CommitDetailViewProps) {
  const [diff, setDiff] = useState<RevisionDiffResponse | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const loadDiff = useCallback(async () => {
    if (!commit.parent_hashes.length) {
      // Initial commit - no parent to diff against
      setDiff(null);
      return;
    }

    setIsLoadingDiff(true);
    setDiffError(null);

    try {
      // Diff from first parent to this commit
      const response = await revisionsApi.getDiff(
        projectId,
        commit.parent_hashes[0],
        commit.hash,
        accessToken
      );
      setDiff(response);
      // Expand all files by default
      setExpandedFiles(new Set(response.changes.map((c) => c.path)));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load diff";
      setDiffError(message);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [commit, projectId, accessToken]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const copyHash = async () => {
    await navigator.clipboard.writeText(commit.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const getParentCommit = (hash: string): RevisionCommit | undefined => {
    return commits.find((c) => c.hash === hash);
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case "A":
        return { label: "Added", className: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30" };
      case "D":
        return { label: "Deleted", className: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30" };
      case "M":
        return { label: "Modified", className: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30" };
      case "R":
        return { label: "Renamed", className: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30" };
      default:
        return { label: type, className: "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800" };
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-sm font-medium text-slate-500">
          Commit Details
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Commit message */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {commit.message.split("\n")[0]}
          </h3>
          {commit.message.includes("\n") && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
              {commit.message.split("\n").slice(1).join("\n").trim()}
            </p>
          )}
        </div>

        {/* Merge badge */}
        {commit.is_merge && commit.merged_branch && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <GitMerge className="h-4 w-4" />
              Merged from {commit.merged_branch}
            </span>
          </div>
        )}

        {/* Metadata section */}
        <div className="mb-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          {/* Author */}
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {commit.author_name}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Mail className="h-3 w-3" />
                {commit.author_email}
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {formatFullDate(commit.timestamp)}
            </span>
          </div>

          {/* Commit hash */}
          <div className="flex items-center gap-3">
            <Hash className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-200 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {commit.hash}
              </code>
              <button
                onClick={copyHash}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                title="Copy full hash"
              >
                {copiedHash ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Parent commits */}
          {commit.parent_hashes.length > 0 && (
            <div className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {commit.parent_hashes.length === 1 ? "Parent" : "Parents"}
                </div>
                <div className="space-y-1">
                  {commit.parent_hashes.map((parentHash) => {
                    const parent = getParentCommit(parentHash);
                    return (
                      <div key={parentHash} className="flex items-center gap-2">
                        <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                          {parentHash.slice(0, 8)}
                        </code>
                        {parent && (
                          <span className="truncate text-xs text-slate-500">
                            {parent.message.split("\n")[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Changes section */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            <FileText className="h-4 w-4" />
            Changes
          </h4>

          {!commit.parent_hashes.length ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
              Initial commit - no parent to compare
            </div>
          ) : isLoadingDiff ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : diffError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              {diffError}
            </div>
          ) : diff && diff.changes.length > 0 ? (
            <div className="space-y-2">
              {/* Summary */}
              <div className="mb-3 flex items-center gap-4 text-sm">
                <span className="text-slate-500">
                  {diff.files_changed} file{diff.files_changed !== 1 ? "s" : ""}{" "}
                  changed
                </span>
                {diff.changes.some((c) => c.additions > 0) && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Plus className="h-3.5 w-3.5" />
                    {diff.changes.reduce((sum, c) => sum + c.additions, 0)} additions
                  </span>
                )}
                {diff.changes.some((c) => c.deletions > 0) && (
                  <span className="flex items-center gap-1 text-red-600">
                    <Minus className="h-3.5 w-3.5" />
                    {diff.changes.reduce((sum, c) => sum + c.deletions, 0)} deletions
                  </span>
                )}
              </div>

              {/* File list with expandable diffs */}
              <div className="space-y-2">
                {diff.changes.map((change) => {
                  const typeInfo = getChangeTypeLabel(change.change_type);
                  const isExpanded = expandedFiles.has(change.path);
                  const toggleExpanded = () => {
                    setExpandedFiles((prev) => {
                      const next = new Set(prev);
                      if (next.has(change.path)) {
                        next.delete(change.path);
                      } else {
                        next.add(change.path);
                      }
                      return next;
                    });
                  };

                  return (
                    <div
                      key={change.path}
                      className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden"
                    >
                      {/* File header */}
                      <button
                        onClick={toggleExpanded}
                        className="flex w-full items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {change.patch ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            )
                          ) : (
                            <div className="h-4 w-4 flex-shrink-0" />
                          )}
                          <FileCode className={cn(
                            "h-4 w-4 flex-shrink-0",
                            change.change_type === "A" && "text-green-600",
                            change.change_type === "D" && "text-red-600",
                            change.change_type === "M" && "text-amber-600",
                            change.change_type === "R" && "text-blue-600"
                          )} />
                          <div className="min-w-0 text-left">
                            <span className="font-mono text-sm truncate block text-slate-700 dark:text-slate-300">
                              {change.path}
                            </span>
                            {change.old_path && change.change_type === "R" && (
                              <span className="text-xs text-slate-500">
                                renamed from {change.old_path}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                              typeInfo.className
                            )}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {change.additions > 0 && (
                            <span className="text-green-600">+{change.additions}</span>
                          )}
                          {change.deletions > 0 && (
                            <span className="text-red-600">-{change.deletions}</span>
                          )}
                        </div>
                      </button>

                      {/* Diff content with syntax highlighting */}
                      {isExpanded && change.patch && (
                        <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                          <pre className="text-xs leading-relaxed">
                            {change.patch.split("\n").map((line, idx) => {
                              let bgClass = "";
                              let textClass = "text-slate-700 dark:text-slate-300";

                              if (line.startsWith("+") && !line.startsWith("+++")) {
                                bgClass = "bg-green-50 dark:bg-green-900/20";
                                textClass = "text-green-800 dark:text-green-300";
                              } else if (line.startsWith("-") && !line.startsWith("---")) {
                                bgClass = "bg-red-50 dark:bg-red-900/20";
                                textClass = "text-red-800 dark:text-red-300";
                              } else if (line.startsWith("@@")) {
                                bgClass = "bg-blue-50 dark:bg-blue-900/20";
                                textClass = "text-blue-700 dark:text-blue-300";
                              }

                              return (
                                <div
                                  key={idx}
                                  className={cn("px-4 py-0.5 font-mono whitespace-pre", bgClass, textClass)}
                                >
                                  {line || " "}
                                </div>
                              );
                            })}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
              No file changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
