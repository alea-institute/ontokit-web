"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  Check,
  XCircle,
  MessageSquareWarning,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode,
  FilePlus,
  FileMinus,
  FileEdit,
  Clock,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import { useProjectHomeHref } from "@/lib/hooks/useProjectHomeHref";
import {
  suggestionsApi,
  type BulkReviewAction,
  type SuggestionSessionSummary,
} from "@/lib/api/suggestions";
import { QueueFilterTabs, type QueueFilter } from "@/components/suggestions/QueueFilterTabs";
import { BulkActionBar } from "@/components/suggestions/BulkActionBar";
import { TierBadge } from "@/components/suggestions/TierBadge";
import {
  pullRequestsApi,
  type PRDiffResponse,
  type PRFileChange,
} from "@/lib/api/pullRequests";
import { RejectSuggestionDialog } from "@/components/suggestions/RejectSuggestionDialog";
import { RequestChangesDialog } from "@/components/suggestions/RequestChangesDialog";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/hooks/useNotifications";
import { cn, formatTimeAgo } from "@/lib/utils";

function DiffView({ diff }: { diff: PRDiffResponse }) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    () => new Set(diff.files.map((f) => f.path)),
  );

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const changeTypeConfig: Record<PRFileChange["change_type"], { icon: typeof FileCode; color: string; label: string }> = {
    added: { icon: FilePlus, color: "text-green-600 dark:text-green-400", label: "Added" },
    deleted: { icon: FileMinus, color: "text-red-600 dark:text-red-400", label: "Deleted" },
    modified: { icon: FileEdit, color: "text-amber-600 dark:text-amber-400", label: "Modified" },
    renamed: { icon: FileCode, color: "text-blue-600 dark:text-blue-400", label: "Renamed" },
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        <span>{diff.files_changed} {diff.files_changed === 1 ? "file" : "files"} changed</span>
        {diff.total_additions > 0 && (
          <span className="text-green-600 dark:text-green-400">+{diff.total_additions}</span>
        )}
        {diff.total_deletions > 0 && (
          <span className="text-red-600 dark:text-red-400">-{diff.total_deletions}</span>
        )}
      </div>

      {/* File list */}
      {diff.files.map((file) => {
        const config = changeTypeConfig[file.change_type];
        const Icon = config.icon;
        const isExpanded = expandedFiles.has(file.path);

        return (
          <div
            key={file.path}
            className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <button
              onClick={() => toggleFile(file.path)}
              className="flex w-full items-center gap-2 bg-slate-50 px-4 py-2.5 text-left hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <Icon className={cn("h-4 w-4", config.color)} />
              <span className="flex-1 truncate text-sm font-mono text-slate-900 dark:text-white">
                {file.path}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {file.additions > 0 && (
                  <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                )}
                {file.additions > 0 && file.deletions > 0 && " / "}
                {file.deletions > 0 && (
                  <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                )}
              </span>
            </button>
            {isExpanded && file.patch && (
              <div className="overflow-x-auto border-t border-slate-200 bg-white text-xs dark:border-slate-700 dark:bg-slate-900">
                {file.patch.split("\n").map((line, idx) => {
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
                    <div key={idx} className={cn("px-4 py-0.5 font-mono whitespace-pre", bgClass, textClass)}>
                      {line || " "}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type DetailTab = "summary" | "files";

const MAX_BULK_SELECTION = 100;

export default function SuggestionReviewPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const { project, isRetiredRedirecting, isLoading: isProjectLoading, error: projectError } = useProject(projectId, session?.accessToken);
  const { canEdit: canReview } = derivePermissions(project, session?.accessToken);
  const projectHomeHref = useProjectHomeHref(projectId);

  const [sessions, setSessions] = useState<SuggestionSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Triage queue (R9, KTD13): a tier filter on the same list, plus selection
  // state for the bulk actions. Selection is local — nothing about it belongs
  // on the server — and per-item failures are kept alongside it, because a
  // partial-success response must not collapse into one toast.
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkFailures, setBulkFailures] = useState<Record<string, string>>({});
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const sessionsRequestIdRef = useRef(0);

  const isLoading = isProjectLoading || isLoadingSessions;
  const error = projectError || sessionsError;

  // Detail view
  const [selectedSession, setSelectedSession] = useState<SuggestionSessionSummary | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const [diff, setDiff] = useState<PRDiffResponse | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  // Action dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestChangesDialogOpen, setRequestChangesDialogOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchSessions = useCallback(async () => {
    const requestId = ++sessionsRequestIdRef.current;
    if (!session?.accessToken) {
      if (requestId === sessionsRequestIdRef.current) {
        setSessions([]);
        setSelectedIds(new Set());
        setBulkFailures({});
        setIsLoadingSessions(false);
      }
      return;
    }
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const pendingList = await suggestionsApi.listPending(
        projectId,
        session.accessToken,
        queueFilter === "all" ? undefined : queueFilter,
      );
      if (requestId !== sessionsRequestIdRef.current) return;

      setSessions(pendingList.items);
      const visibleIds = new Set(pendingList.items.map((item) => item.session_id));
      setSelectedIds((previous) => {
        const next = new Set([...previous].filter((id) => visibleIds.has(id)));
        return next.size === previous.size ? previous : next;
      });
      setBulkFailures((previous) => {
        const next = Object.fromEntries(
          Object.entries(previous).filter(([id]) => visibleIds.has(id)),
        );
        return Object.keys(next).length === Object.keys(previous).length ? previous : next;
      });
    } catch (err) {
      if (requestId !== sessionsRequestIdRef.current) return;
      setSessionsError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      if (requestId === sessionsRequestIdRef.current) setIsLoadingSessions(false);
    }
  }, [projectId, session?.accessToken, queueFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Load diff when selecting a session and switching to files tab
  useEffect(() => {
    if (!selectedSession?.pr_number || activeTab !== "files" || diff || isDiffLoading) return;
    if (!session?.accessToken) return;

    let cancelled = false;
    setIsDiffLoading(true);
    pullRequestsApi
      .getDiff(projectId, selectedSession.pr_number, session.accessToken)
      .then((data) => { if (!cancelled) setDiff(data); })
      .catch(() => {
        // Diff may not be available
      })
      .finally(() => { if (!cancelled) setIsDiffLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSession, activeTab, diff, isDiffLoading, projectId, session?.accessToken]);

  // Switching queues starts a fresh selection: ids that are no longer on
  // screen must not ride along into the next bulk call.
  const handleQueueChange = useCallback((next: QueueFilter) => {
    setQueueFilter(next);
    setSelectedIds(new Set());
    setBulkFailures({});
    setSelectedSession(null);
    setDiff(null);
  }, []);

  const toggleSelected = useCallback((sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else if (next.size < MAX_BULK_SELECTION) next.add(sessionId);
      return next;
    });
  }, []);

  const bulkSelectableSessions = useMemo(
    () => sessions.slice(0, MAX_BULK_SELECTION),
    [sessions],
  );
  const allSelected =
    bulkSelectableSessions.length > 0 &&
    bulkSelectableSessions.every((s) => selectedIds.has(s.session_id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const everySelected =
        bulkSelectableSessions.length > 0 &&
        bulkSelectableSessions.every((s) => prev.has(s.session_id));
      return everySelected
        ? new Set()
        : new Set(bulkSelectableSessions.map((s) => s.session_id));
    });
  }, [bulkSelectableSessions]);

  const removeFromSelection = useCallback((sessionId: string) => {
    setSelectedIds((previous) => {
      if (!previous.has(sessionId)) return previous;
      const next = new Set(previous);
      next.delete(sessionId);
      return next;
    });
    setBulkFailures((previous) => {
      if (!(sessionId in previous)) return previous;
      const next = { ...previous };
      delete next[sessionId];
      return next;
    });
  }, []);

  const handleBulkReview = useCallback(
    async (action: BulkReviewAction) => {
      if (!session?.accessToken || selectedIds.size === 0) return;
      setSessionsError(null);
      setBulkFailures({});
      setIsBulkBusy(true);
      try {
        const result = await suggestionsApi.bulkReview(
          projectId,
          { session_ids: Array.from(selectedIds), action },
          session.accessToken,
        );
        // Partial success: what worked leaves the selection, what failed stays
        // selected next to its reason, so a retry is one click and the
        // reviewer never wonders which items are still pending.
        const failures: Record<string, string> = {};
        for (const failure of result.failed) failures[failure.session_id] = failure.reason;
        setBulkFailures(failures);
        setSelectedIds(new Set(result.failed.map((f) => f.session_id)));
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        setSelectedSession(null);
        setDiff(null);
        await fetchSessions();
      } catch (err) {
        setSessionsError(err instanceof Error ? err.message : "Failed to review suggestions");
      } finally {
        setIsBulkBusy(false);
      }
    },
    [projectId, session?.accessToken, selectedIds, fetchSessions],
  );

  const handleSelectSession = (s: SuggestionSessionSummary) => {
    if (selectedSession?.session_id === s.session_id) {
      setSelectedSession(null);
      setDiff(null);
    } else {
      setSelectedSession(s);
      setDiff(null);
      setActiveTab("summary");
    }
  };

  const handleApprove = async () => {
    if (!selectedSession || !session?.accessToken) return;
    const sessionId = selectedSession.session_id;
    setSessionsError(null);
    setActionInProgress(true);
    try {
      await suggestionsApi.approve(projectId, sessionId, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      removeFromSelection(sessionId);
      setSelectedSession(null);
      setDiff(null);
      void fetchSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to approve suggestion");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedSession || !session?.accessToken) return;
    const sessionId = selectedSession.session_id;
    setSessionsError(null);
    setActionInProgress(true);
    try {
      await suggestionsApi.reject(projectId, sessionId, { reason }, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      removeFromSelection(sessionId);
      setSelectedSession(null);
      setDiff(null);
      void fetchSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to reject suggestion");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedSession || !session?.accessToken) return;
    const sessionId = selectedSession.session_id;
    setSessionsError(null);
    setActionInProgress(true);
    try {
      await suggestionsApi.dismiss(projectId, sessionId, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      removeFromSelection(sessionId);
      setSelectedSession(null);
      setDiff(null);
      void fetchSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to dismiss suggestion");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRequestChanges = async (feedback: string) => {
    if (!selectedSession || !session?.accessToken) return;
    const sessionId = selectedSession.session_id;
    setSessionsError(null);
    setActionInProgress(true);
    try {
      await suggestionsApi.requestChanges(projectId, sessionId, { feedback }, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      removeFromSelection(sessionId);
      setSelectedSession(null);
      setDiff(null);
      void fetchSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to request changes");
    } finally {
      setActionInProgress(false);
    }
  };

  if (isLoading || isRetiredRedirecting || status === "loading") {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error || "Project not found"}
              </h2>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!canReview) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href={projectHomeHref}
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {project.name}
            </Link>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-900/20">
              <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                Access Restricted
              </h2>
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">
                Only editors and admins can review suggestions.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href={`/projects/${projectId}/editor`}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Editor
            </Link>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Review Suggestions
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Review and act on pending suggestions for {project.name}.
            </p>
          </div>

          {/* Queue filter (R9): triage is where anonymous and new-contributor
              work lands; the trusted queue is the one auto-accept drains. */}
          <div className="mb-4">
            <QueueFilterTabs
              value={queueFilter}
              onChange={handleQueueChange}
              disabled={isBulkBusy}
            />
            {sessions.length > MAX_BULK_SELECTION && (
              <p
                id="bulk-selection-limit"
                className="mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Bulk actions are limited to {MAX_BULK_SELECTION} suggestions at a time.
                Select all chooses the first {MAX_BULK_SELECTION} shown.
              </p>
            )}
          </div>

          {/* Bulk action bar — only for reviewers, only with a selection */}
          {selectedIds.size > 0 && (
            <BulkActionBar
              selectedCount={selectedIds.size}
              totalCount={Math.min(sessions.length, MAX_BULK_SELECTION)}
              allSelected={allSelected}
              onToggleSelectAll={toggleSelectAll}
              onClearSelection={() => setSelectedIds(new Set())}
              onBulkAccept={() => handleBulkReview("accept")}
              onBulkDismiss={() => handleBulkReview("dismiss")}
              isBusy={isBulkBusy}
            />
          )}

          {/* Pending list */}
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
              <Lightbulb className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                {queueFilter === "triage"
                  ? "Nothing waiting in triage"
                  : queueFilter === "review"
                    ? "No trusted suggestions waiting"
                    : "No pending suggestions"}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                All suggestion submissions have been reviewed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const isSelected = selectedSession?.session_id === s.session_id;
                const lastActivity = new Date(s.last_activity);
                const timeAgo = formatTimeAgo(lastActivity);

                return (
                  <div key={s.session_id}>
                    {/* Row */}
                    <div
                      className={cn(
                        "flex items-center rounded-lg border bg-white transition-colors dark:bg-slate-800",
                        bulkFailures[s.session_id]
                          ? "border-red-300 dark:border-red-800"
                          : isSelected
                            ? "border-primary-300 ring-1 ring-primary-300 dark:border-primary-600 dark:ring-primary-600"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                      )}
                    >
                      <label className="flex cursor-pointer items-center self-stretch pl-4 pr-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.session_id)}
                          onChange={() => toggleSelected(s.session_id)}
                          disabled={
                            isBulkBusy ||
                            (!selectedIds.has(s.session_id) &&
                              selectedIds.size >= MAX_BULK_SELECTION)
                          }
                          aria-label={`Select suggestion from ${s.submitter?.name || s.submitter?.email || (s.is_anonymous ? "Anonymous" : "Unknown user")}`}
                          aria-describedby={
                            sessions.length > MAX_BULK_SELECTION
                              ? "bulk-selection-limit"
                              : undefined
                          }
                          className="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                        />
                      </label>
                      <button
                        onClick={() => handleSelectSession(s)}
                        className="flex-1 p-4 text-left"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {s.submitter?.name || s.submitter?.email || (s.is_anonymous ? "Anonymous" : "Unknown user")}
                              </span>
                              <TierBadge tier={s.submitter_tier} />
                              {s.is_anonymous && !s.submitter_tier && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  Anonymous
                                </span>
                              )}
                              {(s.revision ?? 1) > 1 && (
                                <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  v{s.revision}
                                </span>
                              )}
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {s.changes_count} {s.changes_count === 1 ? "change" : "changes"}
                              </span>
                            </div>

                            {/* Summary */}
                            {s.summary && (
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                {s.summary}
                              </p>
                            )}

                            {/* Entities */}
                            {s.entities_modified.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {s.entities_modified.map((label) => (
                                  <span
                                    key={label}
                                    className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {timeAgo}
                            </span>
                            {isSelected ? (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </button>
                      {s.github_pr_url && (
                        <a
                          href={s.github_pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                          aria-label="View on GitHub"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Why this one didn't go through in the last bulk pass */}
                    {bulkFailures[s.session_id] && (
                      <p
                        role="alert"
                        className="mt-1 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      >
                        Not processed: {bulkFailures[s.session_id]}
                      </p>
                    )}

                    {/* Detail panel */}
                    {isSelected && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-700" role="tablist">
                          <button
                            onClick={() => setActiveTab("summary")}
                            role="tab"
                            id="tab-summary"
                            aria-selected={activeTab === "summary"}
                            className={cn(
                              "px-4 py-2.5 text-sm font-medium transition-colors",
                              activeTab === "summary"
                                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                            )}
                          >
                            Summary
                          </button>
                          <button
                            onClick={() => setActiveTab("files")}
                            role="tab"
                            id="tab-files"
                            aria-selected={activeTab === "files"}
                            className={cn(
                              "px-4 py-2.5 text-sm font-medium transition-colors",
                              activeTab === "files"
                                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                            )}
                          >
                            Files
                          </button>
                        </div>

                        {/* Tab content */}
                        <div className="p-4" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
                          {activeTab === "summary" ? (
                            <div className="space-y-4">
                              {/* Submitter info */}
                              <div>
                                <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  Submitted by
                                </h4>
                                <div className="mt-1 flex items-center gap-2">
                                  <p className="text-sm text-slate-900 dark:text-white">
                                    {s.submitter?.name || s.submitter?.email || (s.is_anonymous ? "Anonymous" : "Unknown user")}
                                  </p>
                                  <TierBadge tier={s.submitter_tier} />
                                  {s.is_anonymous && !s.submitter_tier && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                      Anonymous
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  <Clock className="mr-1 inline h-3 w-3" />
                                  {lastActivity.toLocaleString()}
                                </p>
                              </div>

                              {/* Summary text */}
                              {s.summary && (
                                <div>
                                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Summary
                                  </h4>
                                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {s.summary}
                                  </p>
                                </div>
                              )}

                              {/* Entities */}
                              {s.entities_modified.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Entities Modified
                                  </h4>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {s.entities_modified.map((label) => (
                                      <span
                                        key={label}
                                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Revision history */}
                              {(s.revision ?? 1) > 1 && (
                                <div>
                                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Revision
                                  </h4>
                                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                    Revision {s.revision} (resubmitted after changes were requested)
                                  </p>
                                </div>
                              )}

                              {/* PR link */}
                              {s.pr_number && (
                                <div>
                                  <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Pull Request
                                  </h4>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Link
                                      href={`/projects/${projectId}/pull-requests/${s.pr_number}`}
                                      className="text-sm text-primary-600 hover:underline dark:text-primary-400"
                                    >
                                      PR #{s.pr_number}
                                    </Link>
                                    {s.github_pr_url && (
                                      <a
                                        href={s.github_pr_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        GitHub
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            // Files tab
                            <div>
                              {isDiffLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                                </div>
                              ) : diff ? (
                                <DiffView diff={diff} />
                              ) : (
                                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                  {s.pr_number
                                    ? "Diff not available for this suggestion."
                                    : "No PR associated with this suggestion yet."}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action bar */}
                        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={handleDismiss}
                            disabled={actionInProgress}
                            title="Close without merging and without writing a rejection reason"
                          >
                            <XCircle className="h-4 w-4" />
                            Dismiss
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => setRejectDialogOpen(true)}
                            disabled={actionInProgress}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                            onClick={() => setRequestChangesDialogOpen(true)}
                            disabled={actionInProgress}
                          >
                            <MessageSquareWarning className="h-4 w-4" />
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                            onClick={handleApprove}
                            disabled={actionInProgress}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Action dialogs */}
      <RejectSuggestionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
      />
      <RequestChangesDialog
        open={requestChangesDialogOpen}
        onOpenChange={setRequestChangesDialogOpen}
        onConfirm={handleRequestChanges}
      />
    </>
  );
}
