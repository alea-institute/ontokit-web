"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  Clock,
  XCircle,
  AlertCircle,
  GitPullRequest,
  GitMerge,
  MessageSquareWarning,
  ExternalLink,
  PenLine,
  MessageCircle,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { projectApi, type Project } from "@/lib/api/projects";
import {
  suggestionsApi,
  type SuggestionSessionSummary,
  type SuggestionSessionStatus,
} from "@/lib/api/suggestions";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  SuggestionSessionStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  active: {
    label: "In Progress",
    icon: Clock,
    color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
  },
  submitted: {
    label: "Pending Review",
    icon: GitPullRequest,
    color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  },
  "auto-submitted": {
    label: "Auto-Submitted",
    icon: AlertCircle,
    color: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
  },
  discarded: {
    label: "Discarded",
    icon: XCircle,
    color: "text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    color: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
  },
  "changes-requested": {
    label: "Changes Requested",
    icon: MessageSquareWarning,
    color: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
  },
};

export default function SuggestionsPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SuggestionSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [proj, sessionList] = await Promise.all([
          projectApi.get(projectId, session?.accessToken),
          session?.accessToken
            ? suggestionsApi.listSessions(projectId, session.accessToken)
            : Promise.resolve({ items: [] }),
        ]);
        setProject(proj);
        setSessions(sessionList.items);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have access to this project");
        } else if (err instanceof ApiError && err.status === 404) {
          setError("Project not found");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load suggestions");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && projectId) {
      fetchData();
    }
  }, [projectId, session?.accessToken, status]);

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

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {project.name}
            </Link>
            <Link href={`/projects/${projectId}/editor`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Open Editor
              </Button>
            </Link>
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              My Suggestions
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Track the status of your suggested changes to {project.name}.
            </p>
          </div>

          {/* Suggestion Sessions List */}
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
              <Lightbulb className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                No suggestions yet
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Open the editor and start making changes. Your suggestions will appear here.
              </p>
              <Link href={`/projects/${projectId}/editor`} className="mt-6 inline-block">
                <Button>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Open Editor
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const config = statusConfig[s.status];
                const StatusIcon = config.icon;
                const lastActivity = new Date(s.last_activity);
                const timeAgo = formatTimeAgo(lastActivity);
                const hasFeedback =
                  (s.status === "changes-requested" || s.status === "rejected") &&
                  s.reviewer_feedback;

                return (
                  <div
                    key={s.session_id}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              config.color,
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                          {(s.revision ?? 1) > 1 && (
                            <span className="rounded-xs bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              v{s.revision}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {s.changes_count} {s.changes_count === 1 ? "change" : "changes"}
                          </span>
                        </div>

                        {/* Entities modified */}
                        {s.entities_modified.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {s.entities_modified.map((label) => (
                              <span
                                key={label}
                                className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Reviewer feedback card */}
                        {hasFeedback && (
                          <div className={cn(
                            "mt-3 rounded-md border p-3",
                            s.status === "rejected"
                              ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
                              : "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10",
                          )}>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                              <MessageCircle className="h-3 w-3" />
                              Feedback from {s.reviewer?.name || s.reviewer?.email || "reviewer"}
                            </div>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {s.reviewer_feedback}
                            </p>
                          </div>
                        )}

                        {/* Resume editing button */}
                        {s.status === "changes-requested" && (
                          <div className="mt-3">
                            <Link
                              href={`/projects/${projectId}/editor?resumeSession=${s.session_id}&branch=${encodeURIComponent(s.branch)}`}
                            >
                              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20">
                                <PenLine className="h-3.5 w-3.5" />
                                Resume Editing
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {timeAgo}
                        </span>
                        {s.pr_number && (
                          <div className="flex items-center gap-1">
                            <Link href={`/projects/${projectId}/pull-requests/${s.pr_number}`}>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                <GitPullRequest className="h-3.5 w-3.5" />
                                PR #{s.pr_number}
                              </Button>
                            </Link>
                            {s.github_pr_url && (
                              <a
                                href={s.github_pr_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                title="View on GitHub"
                                aria-label="View pull request on GitHub"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

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
