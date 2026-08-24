"use client";

import { CheckCircle2, ExternalLink, LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ProposalSubmittedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prNumber: number | null;
  prUrl?: string | null;
  /** A contributor who already has an account has nothing to be nudged toward. */
  isSignedIn: boolean;
  onSignIn?: () => void;
}

/**
 * The anonymous submit-success state, plus the account nudge (R7, KTD12).
 *
 * Anonymous contributions are credited but never counted toward promotion —
 * so the moment right after a successful submission is the one moment a
 * contributor can see what an account would buy them. Copy only: no backend
 * surface, no obligation, and the proposal they just made is already in.
 */
export function ProposalSubmittedDialog({
  open,
  onOpenChange,
  prNumber,
  prUrl,
  isSignedIn,
  onSignIn,
}: ProposalSubmittedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            Thank you — your proposal is in
          </DialogTitle>
          <DialogDescription>
            {prNumber
              ? `A reviewer will look at proposal #${prNumber} and decide whether it lands in the ontology.`
              : "A reviewer will look at your proposal and decide whether it lands in the ontology."}
          </DialogDescription>
        </DialogHeader>

        {!isSignedIn && (
          <div className="my-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-900/50 dark:bg-primary-900/20">
            <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
              Make your next one count toward becoming a trusted contributor
            </p>
            <p className="mt-1.5 text-sm text-primary-800/80 dark:text-primary-200/80">
              Proposals made without an account are credited, but they can&apos;t be counted —
              there is nobody to count them for. With an account, every accepted suggestion
              moves you up the ladder, and trusted contributors can add new entries
              themselves.
            </p>
            {onSignIn && (
              <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={onSignIn}>
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                Create an account or sign in
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-center text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View proposal
            </a>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
