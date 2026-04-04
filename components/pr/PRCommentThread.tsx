"use client";

import { useState } from "react";
import { pullRequestsApi, type Comment } from "@/lib/api/pullRequests";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reply, Edit, Trash2, User, CornerDownRight } from "lucide-react";

interface PRCommentThreadProps {
  projectId: string;
  prNumber: number;
  comments: Comment[];
  accessToken: string;
  currentUserId?: string;
  onCommentsChange: () => void;
  className?: string;
}

export function PRCommentThread({
  projectId,
  prNumber,
  comments,
  accessToken,
  currentUserId,
  onCommentsChange,
  className,
}: PRCommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleReply = async (parentId: string) => {
    if (!replyBody.trim()) return;

    setIsSubmitting(true);
    try {
      await pullRequestsApi.createComment(
        projectId,
        prNumber,
        { body: replyBody.trim(), parent_id: parentId },
        accessToken
      );
      setReplyBody("");
      setReplyingTo(null);
      onCommentsChange();
    } catch (err) {
      console.error("Failed to reply:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editBody.trim()) return;

    setIsSubmitting(true);
    try {
      await pullRequestsApi.updateComment(
        projectId,
        prNumber,
        commentId,
        { body: editBody.trim() },
        accessToken
      );
      setEditBody("");
      setEditingId(null);
      onCommentsChange();
    } catch (err) {
      console.error("Failed to edit:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await pullRequestsApi.deleteComment(
        projectId,
        prNumber,
        commentId,
        accessToken
      );
      onCommentsChange();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwn = comment.author_id === currentUserId;
    const isEditing = editingId === comment.id;

    return (
      <div
        key={comment.id}
        className={cn(
          "group",
          isReply && "ml-8 border-l-2 border-slate-200 pl-4 dark:border-slate-700"
        )}
      >
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {comment.author?.name || comment.author_id}
                </span>
                <span className="ml-2 text-sm text-slate-500">
                  {formatDate(comment.created_at)}
                </span>
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <span className="ml-1 text-xs text-slate-400">(edited)</span>
                )}
              </div>
            </div>

            {/* Actions */}
            {isOwn && !isEditing && (
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditBody(comment.body);
                  }}
                  className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="rounded-sm p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-700"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEdit(comment.id)}
                  disabled={isSubmitting}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setEditBody("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
              {comment.body}
            </p>
          )}

          {/* Reply button */}
          {!isReply && !isEditing && (
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="mt-2 flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
            >
              <Reply className="h-4 w-4" />
              Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="ml-8 mt-2 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
            <div className="flex items-start gap-2">
              <CornerDownRight className="mt-2 h-4 w-4 text-slate-400" />
              <div className="flex-1 space-y-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-700"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReply(comment.id)}
                    disabled={isSubmitting}
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyBody("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        comments.map((comment) => renderComment(comment))
      )}
    </div>
  );
}
