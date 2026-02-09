"use client";

import { useCallback, useEffect, useState } from "react";
import {
  pullRequestsApi,
  type Comment,
  type PullRequest,
  type Review,
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("conversation");
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

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
          <div className="text-center text-sm text-slate-500 py-8">
            Commits view coming soon
          </div>
        )}

        {activeTab === "files" && (
          <div className="text-center text-sm text-slate-500 py-8">
            Files changed view coming soon
          </div>
        )}
      </div>
    </div>
  );
}
