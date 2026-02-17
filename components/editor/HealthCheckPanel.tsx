"use client";

import { useState, useEffect, useCallback } from "react";
import {
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  lintApi,
  createLintWebSocket,
  type LintIssue,
  type LintIssueType,
  type LintSummary,
  type LintWebSocketMessage,
} from "@/lib/api/lint";
import { cn, formatDateTime, getLocalName } from "@/lib/utils";

interface HealthCheckPanelProps {
  projectId: string;
  accessToken?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToClass?: (iri: string) => void;
  /** Whether the current user can trigger a lint run (requires admin/manager role) */
  canRunLint?: boolean;
}

type IssueFilter = "all" | "error" | "warning" | "info";

const issueIcons = {
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const issueColors = {
  error: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10",
  info: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10",
};

export function HealthCheckPanel({
  projectId,
  accessToken,
  canRunLint = false,
  isOpen,
  onClose,
  onNavigateToClass,
}: HealthCheckPanelProps) {
  const [summary, setSummary] = useState<LintSummary | null>(null);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<IssueFilter>("all");

  // Fetch lint status and issues
  const fetchData = useCallback(async (issueFilter?: IssueFilter) => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build issue fetch options based on filter
      const issueOptions: { issue_type?: LintIssueType; limit: number } = { limit: 500 };
      const activeFilter = issueFilter ?? filter;
      if (activeFilter !== "all") {
        issueOptions.issue_type = activeFilter as LintIssueType;
      }

      const [summaryData, issuesData] = await Promise.all([
        lintApi.getStatus(projectId, accessToken),
        lintApi.getIssues(projectId, accessToken, issueOptions),
      ]);

      setSummary(summaryData);
      setIssues(issuesData.items);

      // Check if a run is in progress
      if (
        summaryData.last_run?.status === "pending" ||
        summaryData.last_run?.status === "running"
      ) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load lint data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken, isOpen, filter]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!isOpen) return;

    // Track if this effect is still active (handles React Strict Mode double-invoke)
    let isActive = true;
    let ws: WebSocket | null = null;

    const handleMessage = (message: LintWebSocketMessage) => {
      if (!isActive) return;
      if (message.type === "lint_started") {
        setIsRunning(true);
      } else if (message.type === "lint_complete" || message.type === "lint_failed") {
        setIsRunning(false);
        // Refresh data
        fetchData();
      }
    };

    // Small delay to avoid spurious connections during Strict Mode remounts
    const timeoutId = setTimeout(() => {
      if (isActive) {
        ws = createLintWebSocket(projectId, handleMessage);
      }
    }, 100);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      if (ws) {
        ws.close();
      }
    };
  }, [isOpen, projectId, fetchData]);

  // Trigger a new lint run
  const handleRunLint = async () => {
    if (!accessToken) {
      setError("Authentication required to run lint");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      await lintApi.triggerLint(projectId, accessToken);
      // The WebSocket will notify us when it's complete
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start lint";
      setError(message);
      setIsRunning(false);
    }
  };

  // Dismiss an issue
  const handleDismissIssue = async (issueId: string) => {
    if (!accessToken) return;

    try {
      await lintApi.dismissIssue(projectId, issueId, accessToken);
      // Remove from local state
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
      // Update counts
      if (summary) {
        const issue = issues.find((i) => i.id === issueId);
        if (issue) {
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  total_issues: prev.total_issues - 1,
                  error_count:
                    issue.issue_type === "error" ? prev.error_count - 1 : prev.error_count,
                  warning_count:
                    issue.issue_type === "warning"
                      ? prev.warning_count - 1
                      : prev.warning_count,
                  info_count:
                    issue.issue_type === "info" ? prev.info_count - 1 : prev.info_count,
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error("Failed to dismiss issue:", err);
    }
  };

  // Handle filter change - update filter and fetch matching issues
  const handleFilterChange = useCallback((newFilter: IssueFilter) => {
    setFilter(newFilter);
    fetchData(newFilter);
  }, [fetchData]);

  // Issues are now pre-filtered by the API, no client-side filtering needed
  const filteredIssues = issues;

  if (!isOpen) return null;

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Health Check
          </h2>
          {isRunning && (
            <span className="flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunLint}
            disabled={isRunning || !accessToken || !canRunLint}
            className="gap-1"
          >
            <RefreshCw className={cn("h-4 w-4", isRunning && "animate-spin")} />
            {isRunning ? "Running..." : "Run Lint"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="grid grid-cols-4 gap-2">
            <SummaryCard
              label="Errors"
              count={summary.error_count}
              color="red"
              active={filter === "error"}
              onClick={() => handleFilterChange(filter === "error" ? "all" : "error")}
            />
            <SummaryCard
              label="Warnings"
              count={summary.warning_count}
              color="amber"
              active={filter === "warning"}
              onClick={() => handleFilterChange(filter === "warning" ? "all" : "warning")}
            />
            <SummaryCard
              label="Info"
              count={summary.info_count}
              color="blue"
              active={filter === "info"}
              onClick={() => handleFilterChange(filter === "info" ? "all" : "info")}
            />
            <SummaryCard
              label="Total"
              count={summary.total_issues}
              color="slate"
              active={filter === "all"}
              onClick={() => handleFilterChange("all")}
            />
          </div>
          {summary.last_run && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="h-3 w-3" />
              Last run: {formatDateTime(summary.last_run.started_at)}
              {summary.last_run.status === "completed" && (
                <CheckCircle2 className="ml-1 h-3 w-3 text-green-500" />
              )}
              {summary.last_run.status === "failed" && (
                <XCircle className="ml-1 h-3 w-3 text-red-500" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && !summary && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      )}

      {/* No issues */}
      {!isLoading && summary && summary.total_issues === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
            No issues found
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Your ontology looks healthy!
          </p>
        </div>
      )}

      {/* No run yet */}
      {!isLoading && !summary?.last_run && (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Info className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No lint run yet
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Click &ldquo;Run Lint&rdquo; to check your ontology
          </p>
        </div>
      )}

      {/* Issues list */}
      {!isLoading && filteredIssues.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onNavigate={onNavigateToClass}
                onDismiss={accessToken ? () => handleDismissIssue(issue.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  count: number;
  color: "red" | "amber" | "blue" | "slate";
  active?: boolean;
  onClick?: () => void;
}

function SummaryCard({ label, count, color, active, onClick }: SummaryCardProps) {
  const colorClasses = {
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    slate: "text-slate-600 dark:text-slate-400",
  };

  const bgClasses = {
    red: "bg-red-50 dark:bg-red-900/20",
    amber: "bg-amber-50 dark:bg-amber-900/20",
    blue: "bg-blue-50 dark:bg-blue-900/20",
    slate: "bg-slate-50 dark:bg-slate-800",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 text-center transition-all",
        bgClasses[color],
        active && "ring-2 ring-primary-500 ring-offset-1"
      )}
    >
      <p className={cn("text-lg font-semibold", colorClasses[color])}>{count}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
    </button>
  );
}

interface IssueCardProps {
  issue: LintIssue;
  onNavigate?: (iri: string) => void;
  onDismiss?: () => void;
}

function IssueCard({ issue, onNavigate, onDismiss }: IssueCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        issueColors[issue.issue_type]
      )}
    >
      <div className="flex items-start gap-2">
        {issueIcons[issue.issue_type]}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-200/50 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
              {issue.rule_id}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {issue.message}
          </p>
          {issue.subject_iri && (
            <button
              onClick={() => onNavigate?.(issue.subject_iri!)}
              className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400"
              title={issue.subject_iri}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
                <span className="text-[8px] font-bold text-owl-class">C</span>
              </span>
              {getLocalName(issue.subject_iri)}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
            title="Dismiss issue"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
