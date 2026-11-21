"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/lib/context/ToastContext";
import type { UseSuggestionsReturn } from "@/lib/hooks/useSuggestions";
import { SuggestionReviewCards, type MarkSuggestionDistinct } from "./SuggestionReviewCards";
import { SuggestionSkeleton } from "./SuggestionSkeleton";

interface SuggestionBatchReviewProps {
  title: string;
  parentLabel?: string;
  review: UseSuggestionsReturn;
  onRequest: () => void;
  canRequest?: boolean;
  acceptanceLockedReason?: string;
  requestVersion?: number;
  returnFocus?: () => void;
  siblingCount: number | (() => Promise<number>);
  /** What the counted neighbors are to the suggested classes. */
  existingKind?: "sibling" | "subclass";
  onMarkDistinct?: MarkSuggestionDistinct;
}

export function SuggestionBatchReview({
  title, parentLabel, review, onRequest, canRequest = true, requestVersion,
  returnFocus, siblingCount, existingKind = "sibling", onMarkDistinct, acceptanceLockedReason,
}: SuggestionBatchReviewProps) {
  const [one, many] = existingKind === "subclass" ? ["subclass", "subclasses"] : ["sibling", "siblings"];
  const toast = useToast();
  const headingId = useId();
  const groundingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedVersion = useRef(0);
  const restoreFocus = useRef(false);
  const [confirmation, setConfirmation] = useState<"accept" | "reject" | null>(null);
  const [groundingOpen, setGroundingOpen] = useState(false);
  const [loadedSiblingCount, setLoadedSiblingCount] = useState<number | "unavailable" | null>(null);
  const { items, eligibleCount, isLoading, isAcceptingAll } = review;
  const pending = items.filter((item) => item.status === "pending").length;
  const accepted = items.filter((item) => item.status === "accepted").length;
  const rejected = items.filter((item) => item.status === "rejected").length;
  const blocked = items.filter((item) => item.status === "pending" && item.suggestion.duplicate_verdict === "block").length;
  const busy = !!review.busyReason || isLoading || isAcceptingAll || review.acceptingIndices.size > 0;
  const count = typeof siblingCount === "number" ? siblingCount : loadedSiblingCount;

  useEffect(() => {
    if (!requestVersion || focusedVersion.current === requestVersion || !headingRef.current || isLoading) return;
    focusedVersion.current = requestVersion;
    restoreFocus.current = pending > 0;
    headingRef.current.focus();
  }, [isLoading, pending, requestVersion]);

  useEffect(() => {
    if (!restoreFocus.current || pending > 0 || confirmation || busy) return;
    // Let the dialog release its focus trap before returning to the requester.
    const frame = requestAnimationFrame(() => {
      restoreFocus.current = false;
      returnFocus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, confirmation, pending, returnFocus]);

  const acceptAll = async () => {
    const result = await review.acceptAll();
    const message = `${result.accepted} accepted, ${result.skipped} skipped. Each accepted class is saved as it is accepted.`;
    if (result.skipped > 0) toast.info("Suggestion review updated", message);
    else toast.success("Suggestions accepted", message);
  };

  const toggleGrounding = () => {
    setGroundingOpen(!groundingOpen);
    if (!groundingOpen && typeof siblingCount === "function" && typeof loadedSiblingCount !== "number") {
      setLoadedSiblingCount(null);
      void siblingCount().then(setLoadedSiblingCount, () => setLoadedSiblingCount("unavailable"));
    }
  };

  if (!review.hasBatch && !isLoading && !review.error) return null;
  const model = items[0]?.suggestion.model;

  return (
    <section aria-labelledby={headingId} className="mt-3 space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <header className="space-y-1">
        <h3 ref={headingRef} id={headingId} tabIndex={-1} className="rounded-sm text-sm font-semibold text-slate-900 focus:outline-2 focus:outline-primary-600 dark:text-slate-100 dark:focus:outline-primary-400">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            AI-suggested
          </span>
          {model && <span className="break-all">{model}</span>}
        </div>
      </header>

      {(isLoading || review.hasBatch) && (
        <p className="text-xs text-slate-600 dark:text-slate-300" aria-live="polite" aria-atomic="true">
          {isLoading ? "Generating suggestions…" :
            `${pending - blocked} pending, ${accepted} accepted, ${rejected} rejected, ${blocked} blocked as duplicate`}
        </p>
      )}
      {isLoading && (
        <div aria-hidden="true" className="space-y-2">
          <SuggestionSkeleton />
          <SuggestionSkeleton />
          <SuggestionSkeleton />
        </div>
      )}
      {review.error && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span role="status">{review.error}</span>
          {review.requestError && (
            <Button variant="outline" size="sm" onClick={onRequest} disabled={!canRequest || busy}>Retry</Button>
          )}
        </div>
      )}
      {!isLoading && !review.error && items.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300" role="status">No suggestions returned.</p>
      )}
      {review.hasBatch && items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy || eligibleCount === 0} onClick={() => {
              if (eligibleCount > 3) setConfirmation("accept");
              else void acceptAll();
            }}>
              Accept all ({eligibleCount})
            </Button>
            <Button size="sm" variant="outline" disabled={busy || pending === 0} onClick={() => setConfirmation("reject")}>
              Reject all
            </Button>
            {rejected > 0 && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={review.restoreRejected}>
                Restore rejected ({rejected})
              </Button>
            )}
          </div>
          <div>
            <Button
              size="sm" variant="ghost" aria-expanded={groundingOpen} aria-controls={groundingId}
              onClick={toggleGrounding} className="gap-1 px-1 text-xs text-slate-700 focus-visible:ring-primary-500 dark:text-slate-300 dark:focus-visible:ring-primary-400"
            >
              {groundingOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              Grounding
            </Button>
            <p id={groundingId} hidden={!groundingOpen} className="text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
              Based on: label, definition, parents, and {typeof count === "number"
                ? `${count} existing ${count === 1 ? one : many}`
                : count === "unavailable" ? `existing ${many} (count unavailable)` : `existing ${many} (loading count…)`}
            </p>
          </div>
          <SuggestionReviewCards review={review} onMarkDistinct={onMarkDistinct} acceptanceLockedReason={acceptanceLockedReason} showDefinition />
        </>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
        title={confirmation === "accept" ? "Accept all suggestions" : "Reject all suggestions"}
        description={confirmation === "accept"
          ? `Create ${eligibleCount} classes under ${parentLabel}? Each class is saved as it is accepted.`
          : `Reject ${pending} pending suggestion${pending === 1 ? "" : "s"}?`}
        confirmLabel={confirmation === "accept" ? `Accept ${eligibleCount} classes` : `Reject ${pending} suggestion${pending === 1 ? "" : "s"}`}
        confirmDisabled={busy || (confirmation === "accept" ? eligibleCount === 0 : pending === 0)}
        onConfirm={confirmation === "accept" ? acceptAll : review.rejectAll}
        variant={confirmation === "reject" ? "danger" : "default"}
      />
    </section>
  );
}
