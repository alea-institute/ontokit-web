"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Scissors,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { projectApi, type Project } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import {
  suggestionsApi,
  type SuggestionSessionSummary,
  type SessionDetailResponse,
  type EntityReviewMetadata,
  type ShardReviewMark,
} from "@/lib/api/suggestions";
import {
  pullRequestsApi,
  type PRDiffResponse,
  type PRFileChange,
} from "@/lib/api/pullRequests";
import { RejectSuggestionDialog } from "@/components/suggestions/RejectSuggestionDialog";
import { RequestChangesDialog } from "@/components/suggestions/RequestChangesDialog";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/hooks/useNotifications";
import { ProvenanceBadge } from "@/components/suggestions/ProvenanceBadge";
import { ShardTabNavigator, type ShardTabInfo } from "@/components/suggestions/ShardTabNavigator";
import { SimilarEntitiesInlinePanel } from "@/components/suggestions/SimilarEntitiesInlinePanel";
import { ShardReviewMarker, type ShardMark } from "@/components/suggestions/ShardReviewMarker";
import { attributeLinesToEntities } from "@/lib/editor/entityLineAttribution";
import { cn } from "@/lib/utils";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function DiffView({
  diff,
  entityMetadataMap,
  activeShardId,
  sessionDetail,
  projectId,
  accessToken,
}: {
  diff: PRDiffResponse;
  entityMetadataMap: Map<string, EntityReviewMetadata>;
  activeShardId: string | null;
  sessionDetail: SessionDetailResponse | null;
  projectId: string;
  accessToken?: string;
}) {
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

        // Entity-to-line attribution using tested pure function
        const patchLines = file.patch ? file.patch.split("\n") : [];
        const attributions = attributeLinesToEntities(patchLines, entityMetadataMap);

        // Determine which entity IRIs belong to the active shard
        const activeShardIris = activeShardId && sessionDetail
          ? new Set(sessionDetail.shards.find(s => s.id === activeShardId)?.entity_iris ?? [])
          : null;

        // Track which entities appear in this file's patch (for similar entities panels)
        const entitiesInPatch = new Set<string>();
        for (const attr of attributions) {
          if (attr.entityIri) entitiesInPatch.add(attr.entityIri);
        }

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
                {patchLines.map((line, idx) => {
                  const attribution = attributions[idx];

                  // Shard filter: hide addition lines for entities not in active shard (Pitfall 3: hunk-level)
                  if (activeShardIris && attribution.entityIri && !activeShardIris.has(attribution.entityIri)) {
                    if (line.startsWith("+") && !line.startsWith("+++")) {
                      return null; // Skip this line — not in active shard
                    }
                  }

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
                    <div key={idx} className={cn("flex items-center px-4 py-0.5 font-mono whitespace-pre", bgClass, textClass)}>
                      <span className="flex-1">{line || " "}</span>
                      {line.startsWith("+") && !line.startsWith("+++") && attribution.metadata && (
                        <ProvenanceBadge
                          provenance={attribution.metadata.provenance}
                          confidence={attribution.metadata.confidence}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Similar entities panels for entities in this file's patch */}
                {Array.from(entitiesInPatch).map(iri => {
                  const meta = entityMetadataMap.get(iri);
                  if (!meta || meta.duplicate_candidates.length === 0) return null;
                  return (
                    <SimilarEntitiesInlinePanel
                      key={iri}
                      entityIri={iri}
                      entityLabel={meta.entity_label}
                      candidates={meta.duplicate_candidates}
                      projectId={projectId}
                      accessToken={accessToken}
                    />
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

export default function SuggestionReviewPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SuggestionSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail view
  const [selectedSession, setSelectedSession] = useState<SuggestionSessionSummary | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const [diff, setDiff] = useState<PRDiffResponse | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  // Enriched session detail (Phase 16)
  const [sessionDetail, setSessionDetail] = useState<SessionDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Shard tab filter
  const [activeShardId, setActiveShardId] = useState<string | null>(null); // null = "All"

  // Per-shard review marks (buffered in state, sent with PR action)
  const [shardMarks, setShardMarks] = useState<Record<string, ShardMark>>({});

  // Action dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestChangesDialogOpen, setRequestChangesDialogOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const canReview = project?.user_role === "owner" || project?.user_role === "admin" || project?.user_role === "editor" || project?.is_superadmin;

  const fetchData = useCallback(async () => {
    if (status === "loading") return;
    if (!session?.accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const [proj, pendingList] = await Promise.all([
        projectApi.get(projectId, session.accessToken),
        suggestionsApi.listPending(projectId, session.accessToken),
      ]);
      setProject(proj);
      setSessions(pendingList.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("You don't have access to review suggestions for this project");
      } else if (err instanceof ApiError && err.status === 404) {
        setError("Project not found");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load suggestions");
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, session?.accessToken, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load diff + enriched session detail when selecting a session and switching to files tab
  useEffect(() => {
    if (!selectedSession || activeTab !== "files" || isDiffLoading) return;
    if (!session?.accessToken) return;
    // Skip if both already loaded
    if (diff && sessionDetail) return;

    let cancelled = false;
    setIsDiffLoading(true);
    setIsDetailLoading(true);

    const diffPromise = selectedSession.pr_number
      ? pullRequestsApi.getDiff(projectId, selectedSession.pr_number, session.accessToken)
      : Promise.resolve(null);

    const detailPromise = suggestionsApi
      .getSessionDetail(projectId, selectedSession.session_id, session.accessToken)
      .catch(() => null); // Graceful fallback — enriched detail is optional; diff still works without it

    Promise.all([diffPromise, detailPromise])
      .then(([diffData, detailData]) => {
        if (cancelled) return;
        if (diffData) setDiff(diffData);
        if (detailData) setSessionDetail(detailData);
      })
      .catch(() => {
        // diff may not be available
      })
      .finally(() => {
        if (!cancelled) {
          setIsDiffLoading(false);
          setIsDetailLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [selectedSession, activeTab, diff, sessionDetail, isDiffLoading, projectId, session?.accessToken]);

  const handleSelectSession = (s: SuggestionSessionSummary) => {
    if (selectedSession?.session_id === s.session_id) {
      setSelectedSession(null);
      setDiff(null);
      setSessionDetail(null);
      setActiveShardId(null);
      // NOTE: shardMarks intentionally NOT cleared here (RESEARCH.md Pitfall 4)
    } else {
      setSelectedSession(s);
      setDiff(null);
      setSessionDetail(null);
      setActiveShardId(null);
      // NOTE: shardMarks intentionally NOT cleared here (RESEARCH.md Pitfall 4)
      setActiveTab("summary");
    }
  };

  const handleApprove = async () => {
    if (!selectedSession || !session?.accessToken) return;
    setActionInProgress(true);
    try {
      // Send per-shard review marks if any exist (Phase 16: D-09, D-10)
      const hasShardMarks = Object.keys(shardMarks).length > 0;
      if (hasShardMarks) {
        const marks: ShardReviewMark[] = Object.entries(shardMarks).map(([shard_id, mark]) => ({
          shard_id,
          status: mark.status,
          feedback: mark.feedback,
        }));
        await suggestionsApi.postShardReviews(
          projectId,
          selectedSession.session_id,
          { marks },
          session.accessToken,
        ).catch(() => {
          // Non-blocking — shard marks are additive metadata per D-10
        });

        // D-12: Dispatch notification refresh for rejected shards with feedback
        const hasRejectedWithFeedback = marks.some(m => m.status === "rejected" && m.feedback);
        if (hasRejectedWithFeedback) {
          window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        }
      }

      await suggestionsApi.approve(projectId, selectedSession.session_id, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      setSelectedSession(null);
      setDiff(null);
      setSessionDetail(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve suggestion");
    } finally {
      setActionInProgress(false);
      setShardMarks({}); // Only clear marks after action completes
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedSession || !session?.accessToken) return;
    setActionInProgress(true);
    try {
      // Send per-shard review marks if any exist (Phase 16: D-09, D-10)
      const hasShardMarks = Object.keys(shardMarks).length > 0;
      if (hasShardMarks) {
        const marks: ShardReviewMark[] = Object.entries(shardMarks).map(([shard_id, mark]) => ({
          shard_id,
          status: mark.status,
          feedback: mark.feedback,
        }));
        await suggestionsApi.postShardReviews(
          projectId,
          selectedSession.session_id,
          { marks },
          session.accessToken,
        ).catch(() => {
          // Non-blocking — shard marks are additive metadata per D-10
        });

        // D-12: Dispatch notification refresh for rejected shards with feedback
        const hasRejectedWithFeedback = marks.some(m => m.status === "rejected" && m.feedback);
        if (hasRejectedWithFeedback) {
          window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        }
      }

      await suggestionsApi.reject(projectId, selectedSession.session_id, { reason }, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      setSelectedSession(null);
      setDiff(null);
      setSessionDetail(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject suggestion");
    } finally {
      setActionInProgress(false);
      setShardMarks({}); // Only clear marks after action completes
    }
  };

  const handleRequestChanges = async (feedback: string) => {
    if (!selectedSession || !session?.accessToken) return;
    setActionInProgress(true);
    try {
      // Send per-shard review marks if any exist (Phase 16: D-09, D-10)
      const hasShardMarks = Object.keys(shardMarks).length > 0;
      if (hasShardMarks) {
        const marks: ShardReviewMark[] = Object.entries(shardMarks).map(([shard_id, mark]) => ({
          shard_id,
          status: mark.status,
          feedback: mark.feedback,
        }));
        await suggestionsApi.postShardReviews(
          projectId,
          selectedSession.session_id,
          { marks },
          session.accessToken,
        ).catch(() => {
          // Non-blocking — shard marks are additive metadata per D-10
        });

        // D-12: Dispatch notification refresh for rejected shards with feedback
        const hasRejectedWithFeedback = marks.some(m => m.status === "rejected" && m.feedback);
        if (hasRejectedWithFeedback) {
          window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        }
      }

      await suggestionsApi.requestChanges(projectId, selectedSession.session_id, { feedback }, session.accessToken);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      setSelectedSession(null);
      setDiff(null);
      setSessionDetail(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request changes");
    } finally {
      setActionInProgress(false);
      setShardMarks({}); // Only clear marks after action completes
    }
  };

  // Build entity IRI lookup from session detail
  const entityMetadataMap = useMemo(() => {
    if (!sessionDetail) return new Map<string, EntityReviewMetadata>();
    const map = new Map<string, EntityReviewMetadata>();
    for (const entity of sessionDetail.entities) {
      map.set(entity.entity_iri, entity);
    }
    return map;
  }, [sessionDetail]);

  // Compute shard tab info
  const shardTabs: ShardTabInfo[] = useMemo(() => {
    if (!sessionDetail?.shards) return [];
    return sessionDetail.shards.map(s => ({
      id: s.id,
      label: s.label,
      entityCount: s.entity_iris.length,
    }));
  }, [sessionDetail]);

  // Build shard mark status lookup for ShardTabNavigator
  const shardMarkStatuses = useMemo(() => {
    const statuses: Record<string, "approved" | "rejected"> = {};
    for (const [id, mark] of Object.entries(shardMarks)) {
      statuses[id] = mark.status;
    }
    return statuses;
  }, [shardMarks]);

  if (isLoading || status === "loading") {
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
              href={`/projects/${projectId}`}
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

          {/* Pending list */}
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
              <Lightbulb className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                No pending suggestions
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
                        isSelected
                          ? "border-primary-300 ring-1 ring-primary-300 dark:border-primary-600 dark:ring-primary-600"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                      )}
                    >
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
                              {s.is_anonymous && (
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
                                  {s.is_anonymous && (
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
                              {/* Shard tab navigator (Phase 16) */}
                              {shardTabs.length > 0 && (
                                <div className="mb-4">
                                  <ShardTabNavigator
                                    shards={shardTabs}
                                    activeShardId={activeShardId}
                                    shardMarks={shardMarkStatuses}
                                    onShardChange={setActiveShardId}
                                  />
                                </div>
                              )}

                              {isDiffLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                                </div>
                              ) : diff ? (
                                <>
                                  <DiffView
                                    diff={diff}
                                    entityMetadataMap={entityMetadataMap}
                                    activeShardId={activeShardId}
                                    sessionDetail={sessionDetail}
                                    projectId={projectId}
                                    accessToken={session?.accessToken}
                                  />

                                  {/* Per-shard review marker (Phase 16) */}
                                  {activeShardId && sessionDetail && (
                                    <ShardReviewMarker
                                      shardId={activeShardId}
                                      shardLabel={sessionDetail.shards.find(sh => sh.id === activeShardId)?.label ?? activeShardId}
                                      mark={shardMarks[activeShardId]}
                                      onChange={(id, mark) => {
                                        setShardMarks(prev => {
                                          const next = { ...prev };
                                          if (mark) {
                                            next[id] = mark;
                                          } else {
                                            delete next[id];
                                          }
                                          return next;
                                        });
                                      }}
                                    />
                                  )}
                                </>
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
                          {/* Create clean PR (stretch goal — D-11, D-16) */}
                          {Object.values(shardMarks).some(m => m.status === "rejected") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={async () => {
                                if (!selectedSession || !session?.accessToken) return;
                                const approvedIds = Object.entries(shardMarks)
                                  .filter(([, m]) => m.status === "approved")
                                  .map(([id]) => id);
                                if (approvedIds.length === 0) return;
                                setActionInProgress(true);
                                try {
                                  await suggestionsApi.createCleanPR(
                                    projectId,
                                    selectedSession.session_id,
                                    { approved_shard_ids: approvedIds },
                                    session.accessToken,
                                  );
                                  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
                                  setSelectedSession(null);
                                  setDiff(null);
                                  setSessionDetail(null);
                                  setShardMarks({});
                                  fetchData();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Failed to create clean PR");
                                } finally {
                                  setActionInProgress(false);
                                }
                              }}
                              disabled={actionInProgress || !Object.values(shardMarks).some(m => m.status === "approved")}
                            >
                              <Scissors className="h-4 w-4" />
                              Create PR from approved shards
                            </Button>
                          )}
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
