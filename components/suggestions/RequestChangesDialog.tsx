"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquareWarning, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RequestChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (feedback: string) => Promise<void>;
}

export function RequestChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: RequestChangesDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setFeedback("");
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request changes");
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
              <MessageSquareWarning className="h-5 w-5 text-amber-500" />
              Request Changes
            </DialogTitle>
            <DialogDescription>
              Provide feedback on what the submitter should change. They will be able to resume editing and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3">
            <div>
              <label
                htmlFor="changes-feedback"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Feedback
              </label>
              <textarea
                ref={textareaRef}
                id="changes-feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="E.g., Please add Spanish translations for the new labels..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={3}
                disabled={isSubmitting}
                maxLength={1000}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {feedback.length}/1000 characters
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
            <Button
              type="submit"
              disabled={isSubmitting || !feedback.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Request Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
