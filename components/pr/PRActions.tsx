"use client";

import { useState } from "react";
import {
  pullRequestsApi,
  type PullRequest,
  type ReviewCreate,
} from "@/lib/api/pullRequests";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  GitMerge,
  XCircle,
  Check,
  X,
  MessageSquare,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface PRActionsProps {
  projectId: string;
  pr: PullRequest;
  accessToken: string;
  userRole?: string;
  onUpdate: (pr: PullRequest) => void;
  className?: string;
}

export function PRActions({
  projectId,
  pr,
  accessToken,
  userRole,
  onUpdate,
  className,
}: PRActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  const canMerge = userRole === "owner" || userRole === "admin";
  const canReview = userRole === "owner" || userRole === "admin";
  const canReopen = userRole === "owner" || userRole === "admin";
  const isOpen = pr.status === "open";
  const isClosed = pr.status === "closed";
  const isMerged = pr.status === "merged";

  const handleMerge = async () => {
    await pullRequestsApi.merge(
      projectId,
      pr.pr_number,
      { delete_source_branch: true },
      accessToken
    );

    // Refresh PR data
    const updatedPR = await pullRequestsApi.get(
      projectId,
      pr.pr_number,
      accessToken
    );
    onUpdate(updatedPR);
  };

  const handleClose = async () => {
    const updatedPR = await pullRequestsApi.close(
      projectId,
      pr.pr_number,
      accessToken
    );
    onUpdate(updatedPR);
  };

  const handleReopen = async () => {
    const updatedPR = await pullRequestsApi.reopen(
      projectId,
      pr.pr_number,
      accessToken
    );
    onUpdate(updatedPR);
  };

  const handleReview = async (status: ReviewCreate["status"]) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await pullRequestsApi.createReview(
        projectId,
        pr.pr_number,
        {
          status,
          body: reviewBody.trim() || undefined,
        },
        accessToken
      );

      // Refresh PR data
      const updatedPR = await pullRequestsApi.get(
        projectId,
        pr.pr_number,
        accessToken
      );
      onUpdate(updatedPR);

      setShowReviewForm(false);
      setReviewBody("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit review";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Merged PRs have no actions
  if (isMerged) {
    return null;
  }

  // Closed PRs can be reopened
  if (isClosed) {
    return (
      <div className={cn("space-y-4", className)}>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canReopen && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowReopenDialog(true)}
              disabled={isSubmitting}
              className="gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reopen
            </Button>
          )}
        </div>

        {/* Reopen Confirmation Dialog */}
        <ConfirmDialog
          open={showReopenDialog}
          onOpenChange={setShowReopenDialog}
          onConfirm={handleReopen}
          title="Reopen Pull Request"
          description={`Are you sure you want to reopen "${pr.title}"?`}
          confirmLabel="Reopen"
          variant="default"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Review Form */}
      {showReviewForm ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <h4 className="mb-2 font-medium">Submit Review</h4>
          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            placeholder="Leave a comment (optional)"
            rows={3}
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700"
          />
          <div className="flex flex-wrap gap-2">
            {canReview && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleReview("approved")}
                  disabled={isSubmitting}
                  className="gap-1 bg-green-600 hover:bg-green-500"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReview("changes_requested")}
                  disabled={isSubmitting}
                  className="gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                  Request Changes
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleReview("commented")}
              disabled={isSubmitting}
              className="gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              Comment
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowReviewForm(false);
                setReviewBody("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Review button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowReviewForm(true)}
            disabled={isSubmitting}
            className="gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            Review
          </Button>

          {/* Merge button */}
          {canMerge && (
            <Button
              size="sm"
              onClick={() => setShowMergeDialog(true)}
              disabled={isSubmitting || !pr.can_merge}
              className="gap-1"
              title={
                !pr.can_merge
                  ? "Cannot merge: approval requirements not met"
                  : undefined
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4" />
              )}
              Merge
            </Button>
          )}

          {/* Close button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCloseDialog(true)}
            disabled={isSubmitting}
            className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <XCircle className="h-4 w-4" />
            Close
          </Button>
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      <ConfirmDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        onConfirm={handleMerge}
        title="Merge Pull Request"
        description={`Are you sure you want to merge "${pr.title}"? The source branch will be deleted after merging.`}
        confirmLabel="Merge"
        variant="default"
      />

      {/* Close Confirmation Dialog */}
      <ConfirmDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        onConfirm={handleClose}
        title="Close Pull Request"
        description={`Are you sure you want to close "${pr.title}"? This will not delete the branch and can be reopened later.`}
        confirmLabel="Close PR"
        variant="danger"
      />

      {/* Merge status */}
      {!pr.can_merge && canMerge && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          This pull request requires additional approvals before it can be merged.
          Current: {pr.approval_count} approvals
        </p>
      )}
    </div>
  );
}
