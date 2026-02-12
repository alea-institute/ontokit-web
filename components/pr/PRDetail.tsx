"use client";

import { useCallback, useEffect, useState } from "react";
import {
  pullRequestsApi,
  type Comment,
  type PullRequest,
  type Review,
  type PRCommit,
  type PRFileChange,
} from "@/lib/api/pullRequests";
import { PRActions } from "./PRActions";
import { PRCommentThread } from "./PRCommentThread";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  GitBranch,
  ArrowRight,
  User,
  Clock,
  Check,
  X,
  MessageSquare,
  FileCode,
  GitCommit,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type TabType = "conversation" | "commits" | "files";

interface PRDetailProps {
  projectId: string;
  prNumber: number;
  accessToken?: string;
  userRole?: string;
  currentUserId?: string;
  className?: string;
}

export function PRDetail({
  projectId,
  prNumber,
  accessToken,
  userRole,
  currentUserId,
  className,
}: PRDetailProps) {
  const [pr, setPR] = useState<PullRequest | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commits, setCommits] = useState<PRCommit[]>([]);
  const [fileChanges, setFileChanges] = useState<PRFileChange[]>([]);
  const [diffStats, setDiffStats] = useState<{ additions: number; deletions: number; filesChanged: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("conversation");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const loadPR = useCallback(async () => {
    if (!projectId || !prNumber) return;

    setIsLoading(true);
    setError(null);

    try {
      const prData = await pullRequestsApi.get(projectId, prNumber, accessToken);
      setPR(prData);

      // Load reviews and comments
      const [reviewsData, commentsData] = await Promise.all([
        pullRequestsApi.listReviews(projectId, prNumber, accessToken),
        pullRequestsApi.listComments(projectId, prNumber, accessToken),
      ]);
      setReviews(reviewsData.items);
      setComments(commentsData.items);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load pull request";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, prNumber, accessToken]);

  useEffect(() => {
    loadPR();
  }, [loadPR]);

  // Load commits when switching to commits tab
  const loadCommits = useCallback(async () => {
    if (!projectId || !prNumber || commits.length > 0) return;

    setIsLoadingCommits(true);
    try {
      const commitsData = await pullRequestsApi.getCommits(projectId, prNumber, accessToken);
      setCommits(commitsData.items);
    } catch (err) {
      console.error("Failed to load commits:", err);
    } finally {
      setIsLoadingCommits(false);
    }
  }, [projectId, prNumber, accessToken, commits.length]);

  // Load diff when switching to files tab
  const loadDiff = useCallback(async () => {
    if (!projectId || !prNumber || fileChanges.length > 0) return;

    setIsLoadingDiff(true);
    try {
      const diffData = await pullRequestsApi.getDiff(projectId, prNumber, accessToken);
      setFileChanges(diffData.files);
      setDiffStats({
        additions: diffData.total_additions,
        deletions: diffData.total_deletions,
        filesChanged: diffData.files_changed,
      });
      // Expand all files by default
      setExpandedFiles(new Set(diffData.files.map((f) => f.path)));
    } catch (err) {
      console.error("Failed to load diff:", err);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [projectId, prNumber, accessToken, fileChanges.length]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "commits") {
      loadCommits();
    } else if (activeTab === "files") {
      loadDiff();
    }
  }, [activeTab, loadCommits, loadDiff]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !accessToken) return;

    setIsSubmittingComment(true);
    try {
      await pullRequestsApi.createComment(
        projectId,
        prNumber,
        { body: newComment.trim() },
        accessToken
      );
      setNewComment("");
      // Reload comments
      const commentsData = await pullRequestsApi.listComments(
        projectId,
        prNumber,
        accessToken
      );
      setComments(commentsData.items);
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentsChange = async () => {
    const commentsData = await pullRequestsApi.listComments(
      projectId,
      prNumber,
      accessToken
    );
    setComments(commentsData.items);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = () => {
    if (!pr) return null;
    switch (pr.status) {
      case "merged":
        return <GitMerge className="h-6 w-6 text-purple-600" />;
      case "closed":
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <GitPullRequest className="h-6 w-6 text-green-600" />;
    }
  };

  const getStatusBadge = () => {
    if (!pr) return null;
    switch (pr.status) {
      case "merged":
        return (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Merged
          </span>
        );
      case "closed":
        return (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Closed
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Open
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
        {error || "Pull request not found"}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start gap-4">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{pr.title}</h1>
            <span className="text-xl text-slate-500">#{pr.pr_number}</span>
            {getStatusBadge()}
          </div>

          {/* Branch info */}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <GitBranch className="h-4 w-4" />
            <span className="font-mono">{pr.source_branch}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-mono">{pr.target_branch}</span>
          </div>

          {/* Meta info */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {pr.author?.name || pr.author_id}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {pr.status === "merged" && pr.merged_at
                ? `merged ${formatDate(pr.merged_at)}`
                : `opened ${formatDate(pr.created_at)}`}
            </span>
            {pr.github_pr_url && (
              <a
                href={pr.github_pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary-600"
              >
                <ExternalLink className="h-4 w-4" />
                GitHub
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {pr.description && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {pr.description}
          </p>
        </div>
      )}

      {/* Actions */}
      {accessToken && (
        <PRActions
          projectId={projectId}
          pr={pr}
          accessToken={accessToken}
          userRole={userRole}
          onUpdate={setPR}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-4">
          <button
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium",
              activeTab === "conversation"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
            onClick={() => setActiveTab("conversation")}
          >
            <MessageSquare className="h-4 w-4" />
            Conversation
            {comments.length > 0 && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                {comments.length}
              </span>
            )}
          </button>
          <button
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium",
              activeTab === "commits"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
            onClick={() => setActiveTab("commits")}
          >
            <GitCommit className="h-4 w-4" />
            Commits
            {pr.commits_ahead > 0 && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                {pr.commits_ahead}
              </span>
            )}
          </button>
          <button
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium",
              activeTab === "files"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
            onClick={() => setActiveTab("files")}
          >
            <FileCode className="h-4 w-4" />
            Files Changed
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "conversation" && (
          <div className="space-y-6">
            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-slate-900 dark:text-slate-100">
                  Reviews
                </h3>
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        review.status === "approved"
                          ? "bg-green-100 text-green-600"
                          : review.status === "changes_requested"
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {review.status === "approved" ? (
                        <Check className="h-4 w-4" />
                      ) : review.status === "changes_requested" ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {review.reviewer?.name || review.reviewer_id}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            review.status === "approved"
                              ? "text-green-600"
                              : review.status === "changes_requested"
                              ? "text-red-600"
                              : "text-slate-500"
                          )}
                        >
                          {review.status === "approved"
                            ? "approved"
                            : review.status === "changes_requested"
                            ? "requested changes"
                            : "commented"}
                        </span>
                        <span className="text-sm text-slate-400">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                      {review.body && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {review.body}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                Comments
              </h3>
              <PRCommentThread
                projectId={projectId}
                prNumber={prNumber}
                comments={comments}
                accessToken={accessToken || ""}
                currentUserId={currentUserId}
                onCommentsChange={handleCommentsChange}
              />

              {/* Add comment form */}
              {accessToken && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Leave a comment..."
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={isSubmittingComment || !newComment.trim()}
                    >
                      Comment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "commits" && (
          <div className="space-y-3">
            {isLoadingCommits ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : commits.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                No commits found
              </div>
            ) : (
              commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                    <GitCommit className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {commit.message.split("\n")[0]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {commit.author_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(commit.timestamp)}
                      </span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
                        {commit.short_hash}
                      </code>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-4">
            {isLoadingDiff ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : fileChanges.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                No file changes found
              </div>
            ) : (
              <>
                {/* Stats summary */}
                {diffStats && (
                  <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">
                      {diffStats.filesChanged} file{diffStats.filesChanged !== 1 ? "s" : ""} changed
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      +{diffStats.additions}
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -{diffStats.deletions}
                    </span>
                  </div>
                )}

                {/* File list */}
                <div className="space-y-2">
                  {fileChanges.map((file) => {
                    const isExpanded = expandedFiles.has(file.path);
                    const toggleExpanded = () => {
                      setExpandedFiles((prev) => {
                        const next = new Set(prev);
                        if (next.has(file.path)) {
                          next.delete(file.path);
                        } else {
                          next.add(file.path);
                        }
                        return next;
                      });
                    };

                    return (
                      <div
                        key={file.path}
                        className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden"
                      >
                        {/* File header */}
                        <button
                          onClick={toggleExpanded}
                          className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {file.patch ? (
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
                              file.change_type === "added" && "text-green-600",
                              file.change_type === "deleted" && "text-red-600",
                              file.change_type === "modified" && "text-amber-600",
                              file.change_type === "renamed" && "text-blue-600"
                            )} />
                            <div className="min-w-0 text-left">
                              <span className="font-mono text-sm truncate block">
                                {file.path}
                              </span>
                              {file.change_type === "renamed" && file.old_path && (
                                <span className="text-xs text-slate-500">
                                  renamed from {file.old_path}
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              "flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                              file.change_type === "added" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                              file.change_type === "deleted" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              file.change_type === "modified" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              file.change_type === "renamed" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            )}>
                              {file.change_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {file.additions > 0 && (
                              <span className="text-green-600 dark:text-green-400">
                                +{file.additions}
                              </span>
                            )}
                            {file.deletions > 0 && (
                              <span className="text-red-600 dark:text-red-400">
                                -{file.deletions}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Diff content */}
                        {isExpanded && file.patch && (
                          <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                            <pre className="text-xs leading-relaxed">
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
