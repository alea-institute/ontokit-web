"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ShieldCheck,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  lintApi,
  createLintWebSocket,
  type LintIssue,
  type LintIssueType,
  type LintSummary,
  type LintWebSocketMessage,
  type SubjectType,
} from "@/lib/api/lint";
import {
  qualityApi,
  createQualityWebSocket,
  type QualityWebSocketMessage,
} from "@/lib/api/quality";
import type { ConsistencyCheckResult, ConsistencyIssue, DuplicateCluster, DuplicateDetectionResult } from "@/lib/ontology/qualityTypes";
import Link from "next/link";
import { cn, formatDateTime, getLocalName } from "@/lib/utils";

interface HealthCheckPanelProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToClass?: (iri: string, subjectType?: string) => void;
  /** Whether the current user can trigger a lint run (requires admin/manager role) */
  canRunLint?: boolean;
}

type HealthTab = "lint" | "consistency" | "duplicates";
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
  branch,
  canRunLint = false,
  isOpen,
  onClose,
  onNavigateToClass,
}: HealthCheckPanelProps) {
  const [activeTab, setActiveTab] = useState<HealthTab>("lint");
  const [summary, setSummary] = useState<LintSummary | null>(null);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<IssueFilter>("all");

  // Consistency check state
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyError, setConsistencyError] = useState<string | null>(null);

  // Duplicate detection state
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>([]);
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);

  // Loading flags for cached data fetches (distinct from the check/detect flags
  // so the tab switches immediately and the button stays enabled)
  const [isLoadingCachedConsistency, setIsLoadingCachedConsistency] = useState(false);
  const [isLoadingCachedDuplicates, setIsLoadingCachedDuplicates] = useState(false);

  // Lint config hint (level name + rule count)
  const [lintConfigHint, setLintConfigHint] = useState<string | null>(null);

  // Track whether the quality WebSocket is connected
  const qualityWsConnected = useRef(false);
  // Cancellation flag for the polling fallback loop
  const pollCancelled = useRef(false);
  // Safety timeout refs for WS path (so they can be cleared on completion/unmount)
  const consistencyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicatesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Stable ref for fetchData so the WebSocket effect can call it without re-running
  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  // Fetch lint config hint (level name + rule count)
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [config, levels] = await Promise.all([
          lintApi.getLintConfig(projectId, accessToken),
          lintApi.getLevels(),
        ]);
        if (cancelled) return;
        if (config.lint_level != null) {
          const level = levels.levels.find((l) => l.level === config.lint_level);
          if (level) {
            setLintConfigHint(`Level ${level.level} — ${level.name} (${level.rule_ids.length} rules)`);
          } else {
            setLintConfigHint(`Level ${config.lint_level} (${config.effective_rules.length} rules)`);
          }
        } else if (config.enabled_rules) {
          setLintConfigHint(`Custom (${config.enabled_rules.length} rules)`);
        } else {
          // No explicit config — backend's effective_rules is the authoritative
          // count of what the linter will actually run for this project.
          setLintConfigHint(`All rules (${config.effective_rules.length})`);
        }
      } catch (err) {
        // Hint is non-critical UI, but the failure must be observable.
        console.error("Failed to fetch lint config hint:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, projectId, accessToken]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!isOpen || !accessToken) return;

    // Track if this effect is still active (handles React Strict Mode double-invoke)
    let isActive = true;
    let ws: WebSocket | null = null;

    const handleMessage = (message: LintWebSocketMessage) => {
      if (!isActive) return;
      if (message.type === "lint_started") {
        setIsRunning(true);
      } else if (message.type === "lint_complete" || message.type === "lint_failed") {
        setIsRunning(false);
        fetchDataRef.current();
      }
    };

    // Small delay to avoid spurious connections during Strict Mode remounts
    const timeoutId = setTimeout(() => {
      if (isActive) {
        ws = createLintWebSocket(
          projectId,
          handleMessage,
          () => {
            if (isActive) {
              setIsRunning(false);
              setError("Lint WebSocket connection failed");
            }
          },
          (event) => {
            if (isActive && event.code !== 1000) {
              setIsRunning(false);
            }
          },
          accessToken
        );
      }
    }, 100);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      if (ws) {
        ws.close();
      }
    };
  }, [isOpen, projectId, accessToken]);

  // Clear lint results
  const [isClearing, setIsClearing] = useState(false);
  const handleClearResults = async () => {
    if (!accessToken) return;
    setIsClearing(true);
    try {
      await lintApi.clearResults(projectId, accessToken);
      setSummary((prev) => prev ? {
        ...prev,
        last_run: null,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        total_issues: 0,
      } : null);
      setIssues([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear results");
    } finally {
      setIsClearing(false);
    }
  };

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

  // Trigger consistency check as a background job.
  // Same WS-first / polling-fallback pattern as duplicate detection.
  const handleRunConsistencyCheck = async () => {
    if (!accessToken) return;
    setIsCheckingConsistency(true);
    setConsistencyError(null);
    pollCancelled.current = false;

    let jobId: string;
    try {
      ({ job_id: jobId } = await qualityApi.triggerConsistencyCheck(
        projectId,
        accessToken,
        branch
      ));
    } catch (err) {
      setConsistencyError(
        err instanceof Error ? err.message : "Consistency check failed"
      );
      setIsCheckingConsistency(false);
      return;
    }

    // When WS is connected the effect handler manages loading state
    if (qualityWsConnected.current) {
      if (consistencyTimeoutRef.current) clearTimeout(consistencyTimeoutRef.current);
      consistencyTimeoutRef.current = setTimeout(() => {
        consistencyTimeoutRef.current = null;
        setIsCheckingConsistency((prev) => {
          if (prev) setConsistencyError("Consistency check timed out — try again later");
          return false;
        });
      }, 60_000);
      return;
    }

    // Fallback: poll for job result with exponential backoff
    try {
      let delay = 1000;
      const maxDelay = 5000;
      const maxAttempts = 20;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (pollCancelled.current) return;
        await new Promise((r) => setTimeout(r, delay));
        if (pollCancelled.current) return;
        const result = await qualityApi.getConsistencyJobResult(
          projectId,
          jobId,
          accessToken
        );
        if ("status" in result && result.status === "pending") {
          delay = Math.min(delay * 1.5, maxDelay);
          continue;
        }
        const completed = result as ConsistencyCheckResult;
        setConsistencyIssues(completed.issues);
        return;
      }
      setConsistencyError("Consistency check timed out — try again later");
    } catch (err) {
      if (!pollCancelled.current) {
        setConsistencyError(
          err instanceof Error ? err.message : "Consistency check failed"
        );
      }
    } finally {
      if (!pollCancelled.current) {
        setIsCheckingConsistency(false);
      }
    }
  };

  // Trigger duplicate detection as a background job.
  // If the quality WebSocket is connected, it will deliver the result via
  // duplicates_complete/duplicates_failed events. Otherwise, fall back to
  // polling the job-result endpoint.
  const handleDetectDuplicates = async () => {
    if (!accessToken) return;
    setIsDetectingDuplicates(true);
    setDuplicatesError(null);
    pollCancelled.current = false;

    let jobId: string;
    try {
      ({ job_id: jobId } = await qualityApi.triggerDuplicateDetection(
        projectId,
        accessToken,
        branch
      ));
    } catch (err) {
      setDuplicatesError(
        err instanceof Error ? err.message : "Duplicate detection failed"
      );
      setIsDetectingDuplicates(false);
      return;
    }

    // When WS is connected the effect handler manages loading state.
    // Add a safety timeout so the spinner doesn't stay forever if the
    // WS message is lost (network hiccup, Redis pubsub gap, etc.).
    if (qualityWsConnected.current) {
      if (duplicatesTimeoutRef.current) clearTimeout(duplicatesTimeoutRef.current);
      duplicatesTimeoutRef.current = setTimeout(() => {
        duplicatesTimeoutRef.current = null;
        setIsDetectingDuplicates((prev) => {
          if (prev) setDuplicatesError("Duplicate detection timed out — try again later");
          return false;
        });
      }, 60_000);
      return;
    }

    // Fallback: poll for job result with exponential backoff
    try {
      let delay = 1000;
      const maxDelay = 5000;
      const maxAttempts = 20;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (pollCancelled.current) return;
        await new Promise((r) => setTimeout(r, delay));
        if (pollCancelled.current) return;
        const result = await qualityApi.getDuplicateJobResult(
          projectId,
          jobId,
          accessToken
        );
        // 202 Accepted: job still pending — keep polling
        if ("status" in result && result.status === "pending") {
          delay = Math.min(delay * 1.5, maxDelay);
          continue;
        }
        // 200 OK: job complete — narrow to DuplicateDetectionResult
        const completed = result as DuplicateDetectionResult;
        setDuplicateClusters(completed.clusters);
        return;
      }
      setDuplicatesError("Duplicate detection timed out — try again later");
    } catch (err) {
      if (!pollCancelled.current) {
        setDuplicatesError(
          err instanceof Error ? err.message : "Duplicate detection failed"
        );
      }
    } finally {
      if (!pollCancelled.current) {
        setIsDetectingDuplicates(false);
      }
    }
  };

  // Load cached data when tab changes.
  // Use requestAnimationFrame so the tab switch paints before the loading
  // state is set, preventing the UI from appearing frozen.
  useEffect(() => {
    let cancelled = false;
    if (activeTab === "consistency" && consistencyIssues.length === 0 && !isCheckingConsistency) {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setIsLoadingCachedConsistency(true);
        qualityApi.getConsistencyIssues(projectId, accessToken, branch)
          .then((r) => { if (!cancelled) setConsistencyIssues(r.issues); })
          .catch((err) => { console.error(`Failed to load cached consistency issues for project ${projectId}:`, err); })
          .finally(() => { if (!cancelled) setIsLoadingCachedConsistency(false); });
      });
    }
    if (activeTab === "duplicates" && duplicateClusters.length === 0 && !isDetectingDuplicates) {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setIsLoadingCachedDuplicates(true);
        qualityApi.getLatestDuplicates(projectId, accessToken, branch)
          .then((r) => { if (!cancelled) setDuplicateClusters(r.clusters); })
          .catch((err) => { console.error(`Failed to load cached duplicates for project ${projectId}:`, err); })
          .finally(() => { if (!cancelled) setIsLoadingCachedDuplicates(false); });
      });
    }
    return () => { cancelled = true; };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear stale quality data when project or branch changes
  useEffect(() => {
    setConsistencyIssues([]);
    setConsistencyError(null);
    setDuplicateClusters([]);
    setDuplicatesError(null);
  }, [projectId, branch]);

  // Quality WebSocket for real-time consistency / duplicates updates
  useEffect(() => {
    if (!isOpen || !accessToken) return;

    let isActive = true;
    let ws: WebSocket | null = null;

    const resolvedBranch = branch ?? "main";

    const handleQualityMessage = (message: QualityWebSocketMessage) => {
      if (!isActive) return;
      // Ignore events for other branches (backend filters by project, not branch)
      if (message.branch !== resolvedBranch) return;

      if (message.type === "consistency_started") {
        setIsCheckingConsistency(true);
      } else if (message.type === "consistency_complete") {
        if (consistencyTimeoutRef.current) {
          clearTimeout(consistencyTimeoutRef.current);
          consistencyTimeoutRef.current = null;
        }
        qualityApi.getConsistencyIssues(projectId, accessToken, branch)
          .then((r) => { if (isActive) setConsistencyIssues(r.issues); })
          .catch((err) => {
            if (isActive) setConsistencyError(err instanceof Error ? err.message : "Failed to load consistency results");
          })
          .finally(() => { if (isActive) setIsCheckingConsistency(false); });
      } else if (message.type === "consistency_failed") {
        if (consistencyTimeoutRef.current) {
          clearTimeout(consistencyTimeoutRef.current);
          consistencyTimeoutRef.current = null;
        }
        setIsCheckingConsistency(false);
        setConsistencyError(message.error ?? "Consistency check failed");
      } else if (message.type === "duplicates_started") {
        setIsDetectingDuplicates(true);
      } else if (message.type === "duplicates_complete") {
        if (duplicatesTimeoutRef.current) {
          clearTimeout(duplicatesTimeoutRef.current);
          duplicatesTimeoutRef.current = null;
        }
        qualityApi.getLatestDuplicates(projectId, accessToken, branch)
          .then((r) => { if (isActive) setDuplicateClusters(r.clusters); })
          .catch((err) => {
            if (isActive) setDuplicatesError(err instanceof Error ? err.message : "Failed to load duplicate results");
          })
          .finally(() => { if (isActive) setIsDetectingDuplicates(false); });
      } else if (message.type === "duplicates_failed") {
        if (duplicatesTimeoutRef.current) {
          clearTimeout(duplicatesTimeoutRef.current);
          duplicatesTimeoutRef.current = null;
        }
        setIsDetectingDuplicates(false);
        setDuplicatesError(message.error ?? "Duplicate detection failed");
      }
    };

    const timeoutId = setTimeout(() => {
      if (isActive) {
        ws = createQualityWebSocket(
          projectId,
          handleQualityMessage,
          () => { qualityWsConnected.current = false; },
          () => { qualityWsConnected.current = false; },
          accessToken,
          () => { qualityWsConnected.current = true; }
        );
      }
    }, 100);

    return () => {
      isActive = false;
      qualityWsConnected.current = false;
      pollCancelled.current = true;
      if (consistencyTimeoutRef.current) {
        clearTimeout(consistencyTimeoutRef.current);
        consistencyTimeoutRef.current = null;
      }
      if (duplicatesTimeoutRef.current) {
        clearTimeout(duplicatesTimeoutRef.current);
        duplicatesTimeoutRef.current = null;
      }
      clearTimeout(timeoutId);
      if (ws) ws.close();
    };
  }, [isOpen, projectId, accessToken, branch]);

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
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3">
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
            {activeTab === "lint" && (
              summary?.last_run?.status === "completed" && !isRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearResults}
                  disabled={isClearing || !accessToken || !canRunLint}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  {isClearing ? "Clearing..." : "Clear"}
                </Button>
              ) : (
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
              )
            )}
            {activeTab === "consistency" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunConsistencyCheck}
                disabled={isCheckingConsistency || !accessToken}
                className="gap-1"
              >
                <ShieldCheck className={cn("h-4 w-4", isCheckingConsistency && "animate-spin")} />
                {isCheckingConsistency ? "Checking..." : "Run Check"}
              </Button>
            )}
            {activeTab === "duplicates" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectDuplicates}
                disabled={isDetectingDuplicates || !accessToken}
                className="gap-1"
              >
                <Copy className={cn("h-4 w-4", isDetectingDuplicates && "animate-spin")} />
                {isDetectingDuplicates ? "Detecting..." : "Find Duplicates"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex px-4">
          {(["lint", "consistency", "duplicates"] as HealthTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              )}
            >
              {tab === "lint" ? "Lint" : tab === "consistency" ? "Consistency" : "Duplicates"}
            </button>
          ))}
        </div>
      </div>

      {/* Lint Tab */}
      {activeTab === "lint" && (
      <>
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
          <div className="mt-2 space-y-0.5">
            {summary.last_run && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
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
            {lintConfigHint && (
              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Info className="h-3 w-3" />
                {lintConfigHint}
                <span className="mx-0.5">&mdash;</span>
                <Link
                  href={`/projects/${projectId}/settings#lint-config`}
                  className="text-primary-600 hover:underline dark:text-primary-400"
                >
                  configure
                </Link>
              </div>
            )}
          </div>
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

      {/* No issues (only after a completed run) */}
      {!isLoading && summary?.last_run?.status === "completed" && summary.total_issues === 0 && (
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
      </>
      )}

      {/* Consistency Tab */}
      {activeTab === "consistency" && (
        <div className="flex-1 overflow-y-auto p-4">
          {consistencyError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {consistencyError}
            </div>
          )}
          {(isCheckingConsistency || isLoadingCachedConsistency) && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          )}
          {!isCheckingConsistency && !isLoadingCachedConsistency && consistencyIssues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShieldCheck className="h-12 w-12 text-green-500" />
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                No consistency issues
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Run a consistency check to validate your ontology structure.
              </p>
            </div>
          )}
          {consistencyIssues.length > 0 && (
            <div className="space-y-2">
              {consistencyIssues.map((issue, idx) => (
                <div
                  key={`${issue.rule_id}-${issue.entity_iri}-${idx}`}
                  className={cn(
                    "rounded-lg border p-3",
                    issue.severity === "error" && "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10",
                    issue.severity === "warning" && "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10",
                    issue.severity === "info" && "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {issue.severity === "error" && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                    {issue.severity === "warning" && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                    {issue.severity === "info" && <Info className="h-4 w-4 shrink-0 text-blue-500" />}
                    <div className="min-w-0 flex-1">
                      <span className="rounded-sm bg-slate-200/50 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
                        {issue.rule_id}
                      </span>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {issue.message}
                      </p>
                      {issue.entity_iri && (
                        <button
                          onClick={() => onNavigateToClass?.(issue.entity_iri, issue.entity_type)}
                          className="mt-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                        >
                          {getLocalName(issue.entity_iri)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicates Tab */}
      {activeTab === "duplicates" && (
        <div className="flex-1 overflow-y-auto p-4">
          {duplicatesError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {duplicatesError}
            </div>
          )}
          {(isDetectingDuplicates || isLoadingCachedDuplicates) && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          )}
          {!isDetectingDuplicates && !isLoadingCachedDuplicates && duplicateClusters.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                No duplicates detected
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Find Duplicates&rdquo; to scan for near-duplicate entities.
              </p>
            </div>
          )}
          {duplicateClusters.length > 0 && (
            <div className="space-y-3">
              {duplicateClusters.map((cluster, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10"
                >
                  <div className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {Math.round(cluster.similarity * 100)}% similar
                  </div>
                  <div className="space-y-1">
                    {cluster.entities.map((entity) => (
                      <button
                        key={entity.iri}
                        onClick={() => onNavigateToClass?.(entity.iri, entity.entity_type)}
                        className="flex w-full items-center gap-2 text-left text-sm text-primary-600 hover:underline dark:text-primary-400"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
                          <span className="text-[8px] font-bold text-owl-class">
                            {entity.entity_type === "class" ? "C" : entity.entity_type === "property" ? "P" : "I"}
                          </span>
                        </span>
                        {entity.label || getLocalName(entity.iri)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
  onNavigate?: (iri: string, subjectType?: string) => void;
  onDismiss?: () => void;
}

const SUBJECT_TYPE_BADGE: Record<SubjectType, { letter: string; colorClass: string }> = {
  class: { letter: "C", colorClass: "text-owl-class bg-owl-class/10 border-owl-class/50" },
  property: { letter: "P", colorClass: "text-emerald-600 bg-emerald-100/50 border-emerald-500/50 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-400/50" },
  individual: { letter: "I", colorClass: "text-violet-600 bg-violet-100/50 border-violet-500/50 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-400/50" },
  other: { letter: "?", colorClass: "text-slate-500 bg-slate-100/50 border-slate-400/50 dark:text-slate-400 dark:bg-slate-700/50 dark:border-slate-500/50" },
};

function resolveBadgeKey(subjectType: SubjectType | null): SubjectType {
  if (subjectType === null) return "other";
  if (subjectType in SUBJECT_TYPE_BADGE) return subjectType;
  // Unknown SubjectType from backend (schema drift) — surface for observability.
  console.error("Unknown lint issue subject_type:", subjectType);
  return "other";
}

function IssueCard({ issue, onNavigate, onDismiss }: IssueCardProps) {
  // Resolved once so the subject button and the related-entity buttons agree
  // on the entity type when navigating. duplicate-label and similar rules
  // emit `duplicate_iris` for entities of the same kind as `subject_type`.
  const subjectTypeKey = resolveBadgeKey(issue.subject_type);
  const subjectBadge = SUBJECT_TYPE_BADGE[subjectTypeKey];
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
            <span className="rounded-sm bg-slate-200/50 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
              {issue.rule_id}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {issue.message}
          </p>
          {issue.subject_iri && (
            <button
              onClick={() => onNavigate?.(issue.subject_iri!, subjectTypeKey)}
              className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400"
              title={issue.subject_iri}
            >
              <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", subjectBadge.colorClass)}>
                <span className="text-[8px] font-bold">{subjectBadge.letter}</span>
              </span>
              {getLocalName(issue.subject_iri)}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </button>
          )}
          {/* Related entities from issue details */}
          {issue.details?.duplicate_iris && issue.details.duplicate_iris.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Also:</span>
              {issue.details.duplicate_iris.slice(0, 3).map((iri) => (
                <button
                  key={iri}
                  onClick={() => onNavigate?.(iri, subjectTypeKey)}
                  className="text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400"
                  title={iri}
                >
                  {getLocalName(iri)}
                </button>
              ))}
              {issue.details.duplicate_iris.length > 3 && (
                <span>+{issue.details.duplicate_iris.length - 3} more</span>
              )}
            </div>
          )}
          {/* Conflicting values from label-per-language */}
          {issue.details?.labels && issue.details.labels.length > 1 && (
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Values: </span>
              {issue.details.labels.map((label, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className="font-mono text-slate-600 dark:text-slate-300">&ldquo;{label}&rdquo;</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
            title="Dismiss issue"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
