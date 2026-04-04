"use client";

import { useState, useEffect, useRef } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SuggestionSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (summary?: string) => Promise<void>;
  entitiesModified: string[];
  changesCount: number;
}

export function SuggestionSubmitDialog({
  open,
  onOpenChange,
  onConfirm,
  entitiesModified,
  changesCount,
}: SuggestionSubmitDialogProps) {
  const [summary, setSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setSummary("");
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(summary.trim() || undefined);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Submit Suggestions
            </DialogTitle>
            <DialogDescription>
              Your changes will be submitted for review by a project editor.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3">
            {/* Entities modified */}
            {entitiesModified.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Modified items ({changesCount} {changesCount === 1 ? "change" : "changes"})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entitiesModified.map((label) => (
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

            {/* Summary textarea */}
            <div>
              <label
                htmlFor="suggestion-summary"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Describe your changes (optional)
              </label>
              <textarea
                ref={textareaRef}
                id="suggestion-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="E.g., Updated labels for FamilyRelation and added Spanish translations..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={3}
                disabled={isSubmitting}
                maxLength={1000}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {summary.length}/1000 characters
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for Review"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
