"use client";

import { useState } from "react";
import { pullRequestsApi, type PullRequest } from "@/lib/api/pullRequests";
import { useBranch } from "@/lib/context/BranchContext";
import { Button } from "@/components/ui/button";
import { X, GitBranch, ArrowRight } from "lucide-react";

interface PRCreateModalProps {
  projectId: string;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (pr: PullRequest) => void;
}

export function PRCreateModal({
  projectId,
  accessToken,
  isOpen,
  onClose,
  onCreated,
}: PRCreateModalProps) {
  const { currentBranch, defaultBranch, branches } = useBranch();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceBranch, setSourceBranch] = useState(currentBranch);
  const [targetBranch, setTargetBranch] = useState(defaultBranch);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (sourceBranch === targetBranch) {
      setError("Source and target branches must be different");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const pr = await pullRequestsApi.create(
        projectId,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          source_branch: sourceBranch,
          target_branch: targetBranch,
        },
        accessToken
      );

      onCreated?.(pr);
      onClose();

      // Reset form
      setTitle("");
      setDescription("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create pull request";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Create Pull Request</h2>
          <button
            onClick={onClose}
            className="rounded-xs p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Branch selection */}
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                From
              </label>
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-slate-400" />
                <select
                  value={sourceBranch}
                  onChange={(e) => setSourceBranch(e.target.value)}
                  className="flex-1 rounded-xs border-0 bg-transparent py-1 text-sm focus:outline-hidden focus:ring-0"
                >
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400" />

            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Into
              </label>
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-slate-400" />
                <select
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  className="flex-1 rounded-xs border-0 bg-transparent py-1 text-sm focus:outline-hidden focus:ring-0"
                >
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="pr-title"
              className="mb-1 block text-sm font-medium"
            >
              Title
            </label>
            <input
              id="pr-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your changes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="pr-description"
              className="mb-1 block text-sm font-medium"
            >
              Description
            </label>
            <textarea
              id="pr-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your changes in detail (optional)"
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Pull Request"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
