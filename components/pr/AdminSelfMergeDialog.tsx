"use client";

/**
 * AdminSelfMergeDialog — Confirmation dialog for admin direct-merge action (D-20).
 *
 * Integration pattern:
 * This dialog should be rendered alongside the merge button in PRActions.tsx.
 * The merge button handler should check:
 *   1. Is the current user an admin or owner? (userRole === "admin" || userRole === "owner")
 *   2. Is the current user the PR author (self-merge)? (pr.author_id === currentUserId)
 *   3. If both are true, set showAdminSelfMergeDialog = true instead of showMergeDialog.
 *   4. onConfirm calls the actual merge API (handleMerge in PRActions).
 *
 * This component is ready for wiring — the dialog itself is complete. The calling
 * component (PRActions) can add the gate check at the "Merge" button onClick.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminSelfMergeDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  prTitle?: string;
}

export function AdminSelfMergeDialog({
  open,
  onConfirm,
  onCancel,
  isLoading = false,
  prTitle,
}: AdminSelfMergeDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = "admin-self-merge-heading";
  const [prevOpen, setPrevOpen] = useState(false);

  // Focus cancel button when dialog opens (safer default focus)
  useEffect(() => {
    if (open && !prevOpen) {
      // Small delay to allow the dialog to render
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 0);
      setPrevOpen(true);
      return () => clearTimeout(timer);
    }
    if (!open) {
      setPrevOpen(false);
    }
  }, [open, prevOpen]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
          <div className="flex-1">
            <h2
              id={headingId}
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Merge directly to main?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You are about to merge this structural change without peer review. This cannot be undone.
            </p>
            {prTitle && (
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {prTitle}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              As an admin, this will bypass the normal review process. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Merging...
              </>
            ) : (
              "Merge directly"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
