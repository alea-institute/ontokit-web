"use client";

import { useCallback, useEffect, useState } from "react";
import { revisionsApi, type RevisionDiffResponse } from "@/lib/api/revisions";
import { cn } from "@/lib/utils";
import {
  FileCode,
  FilePlus,
  FileX,
  FileDiff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface DiffViewerProps {
  projectId: string;
  fromVersion: string;
  toVersion?: string;
  accessToken?: string;
  className?: string;
}

export function DiffViewer({
  projectId,
  fromVersion,
  toVersion = "HEAD",
  accessToken,
  className,
}: DiffViewerProps) {
  const [diff, setDiff] = useState<RevisionDiffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const loadDiff = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await revisionsApi.getDiff(
        projectId,
        fromVersion,
        toVersion,
        accessToken
      );
      setDiff(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load diff";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, fromVersion, toVersion, accessToken]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (changeType: string) => {
    switch (changeType) {
      case "A":
      case "added":
        return <FilePlus className="h-4 w-4 text-green-600" />;
      case "D":
      case "deleted":
        return <FileX className="h-4 w-4 text-red-600" />;
      case "M":
      case "modified":
        return <FileDiff className="h-4 w-4 text-amber-600" />;
      case "R":
      case "renamed":
        return <FileCode className="h-4 w-4 text-blue-600" />;
      default:
        return <FileCode className="h-4 w-4 text-slate-500" />;
    }
  };

  const getChangeLabel = (changeType: string) => {
    switch (changeType) {
      case "A":
      case "added":
        return (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Added
          </span>
        );
      case "D":
      case "deleted":
        return (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Deleted
          </span>
        );
      case "M":
      case "modified":
        return (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Modified
          </span>
        );
      case "R":
      case "renamed":
        return (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Renamed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!diff || diff.changes.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
        No changes between these versions
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{diff.files_changed} file{diff.files_changed !== 1 ? "s" : ""} changed</span>
        <span className="font-mono text-xs">
          {fromVersion.substring(0, 8)} ... {toVersion === "HEAD" ? "HEAD" : toVersion.substring(0, 8)}
        </span>
      </div>

      {/* File list */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {diff.changes.map((change) => (
          <div
            key={change.path}
            className={cn(
              "border-b border-slate-200 last:border-b-0 dark:border-slate-700",
              expandedFiles.has(change.path) && "bg-slate-50 dark:bg-slate-700/30"
            )}
          >
            {/* File header */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
              onClick={() => toggleFile(change.path)}
            >
              {expandedFiles.has(change.path) ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              {getFileIcon(change.change_type)}
              <span className="flex-1 font-mono text-sm">{change.path}</span>
              {getChangeLabel(change.change_type)}
            </button>

            {/* File content (placeholder for now) */}
            {expandedFiles.has(change.path) && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-center text-sm text-slate-500">
                  Detailed diff view coming soon
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
