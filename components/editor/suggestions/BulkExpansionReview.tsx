"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, MinusCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/lib/context/ToastContext";
import {
  bulkExpansionProgress, type BulkExpansionJob, type BulkExpansionTotals,
} from "@/lib/hooks/useBulkExpansion";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import type { AcceptedClassSuggestion } from "@/lib/editor/generatedEntityPersistence";
import { provenanceFromSuggestion } from "@/lib/ontology/suggestionProvenance";
import { SuggestionReviewCards } from "./SuggestionReviewCards";
import { SuggestionSkeleton } from "./SuggestionSkeleton";

interface ReviewScope {
  projectId: string;
  branch: string;
  onAddSuggestedChild?: (iri: string, label: string, parentIri: string, suggestion?: AcceptedClassSuggestion) => Promise<void>;
  isSuggestionMode?: boolean;
}

interface BulkExpansionReviewProps extends ReviewScope {
  runId?: number;
  jobs: BulkExpansionJob[];
  totals: BulkExpansionTotals;
  haltReason: string | null;
  canUseLLM: boolean;
  stop: () => void;
  retry: (iri: string) => void;
}

const statuses = {
  waiting: { label: "Waiting", Icon: Clock },
  generating: { label: "Generating", Icon: Loader2 },
  done: { label: "Done", Icon: CheckCircle },
  failed: { label: "Failed", Icon: AlertTriangle },
  skipped: { label: "Skipped", Icon: MinusCircle },
};

export function BulkExpansionReview({ runId, ...props }: BulkExpansionReviewProps) {
  if (props.jobs.length === 0) return null;
  return <ReviewRun key={JSON.stringify([props.projectId, props.branch, runId])} {...props} />;
}

function ReviewRun({ jobs, totals, haltReason, canUseLLM, stop, retry, ...scope }: BulkExpansionReviewProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focused = useRef(false);
  const hasResult = totals.done + totals.failed > 0;

  useEffect(() => {
    if (!hasResult) return;
    const frame = requestAnimationFrame(() => {
      if (focused.current) return;
      headingRef.current?.focus();
      focused.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [hasResult]);

  return (
    <section aria-labelledby={headingId} className="m-3 max-h-[50dvh] shrink-0 space-y-3 overflow-auto rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-slate-900 focus:outline-2 focus:outline-primary-600 dark:text-slate-100 dark:focus:outline-primary-400">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Bulk expansion review
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {bulkExpansionProgress(totals, jobs.length)}
          </p>
        </div>
        {totals.waiting > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => { stop(); headingRef.current?.focus(); }} className="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400">
            Stop
          </Button>
        )}
      </header>
      {haltReason && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Queue stopped. {haltReason}</span>
        </p>
      )}
      <ul className="space-y-2">
        {jobs.map((job) => (
          <ReviewGroup key={job.iri} job={job} {...scope}
            retry={!haltReason && canUseLLM && totals.generating === 0 ? () => retry(job.iri) : undefined} />
        ))}
      </ul>
    </section>
  );
}

function ReviewGroup({ job, retry, ...scope }: ReviewScope & {
  job: BulkExpansionJob;
  retry?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const { label, Icon } = statuses[job.status];
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <li className="rounded-md border border-slate-200 dark:border-slate-700">
      <Button type="button" size="sm" variant="ghost" aria-expanded={expanded} aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
        className="h-auto min-h-8 w-full justify-between gap-3 px-2 py-1 text-left text-slate-900 focus-visible:ring-primary-500 dark:text-slate-100 dark:focus-visible:ring-primary-400">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Chevron className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">{job.label}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Icon className={job.status === "generating" ? "h-3.5 w-3.5 motion-safe:animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
          {label}
        </span>
      </Button>
      <div id={contentId} hidden={!expanded} className="space-y-2 px-3 pb-3 pt-1 text-sm text-slate-600 dark:text-slate-300">
        {job.status === "waiting" && <p>Waiting to generate suggestions.</p>}
        {job.status === "generating" && <div aria-hidden="true"><SuggestionSkeleton /></div>}
        {job.status === "skipped" && <p>Generation did not start for this class.</p>}
        {job.status === "failed" && (
          <>
            <p>{job.error}</p>
            {retry && (
              <Button type="button" variant="outline" size="sm" onClick={retry} className="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400">
                Retry
              </Button>
            )}
          </>
        )}
        {job.status === "done" && <GroupCards target={job} {...scope} />}
      </div>
    </li>
  );
}

function GroupCards({ target, projectId, branch, onAddSuggestedChild, isSuggestionMode }: ReviewScope & { target: BulkExpansionJob }) {
  const toast = useToast();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const review = useSuggestions({
    projectId, branch, entityIri: target.iri, suggestionType: "children", canUseLLM: false,
    getAcceptanceError: onAddSuggestedChild ? undefined : () => "Generated entity persistence is unavailable.",
    onAccepted: async (suggestion, editedValue) => {
      if (!mounted.current) throw new Error("Open the review on this branch before accepting more suggestions.");
      if (!onAddSuggestedChild) throw new Error("Generated entity persistence is unavailable.");
      const provenance = provenanceFromSuggestion(suggestion);
      await onAddSuggestedChild(suggestion.iri, editedValue ?? suggestion.label, target.iri,
        suggestion.definition == null ? provenance : { ...provenance, definition: suggestion.definition });
    },
  });

  const acceptAll = async () => {
    const { accepted, skipped } = await review.acceptAll();
    if (!mounted.current) return;
    const counts = `${accepted} accepted, ${skipped} skipped.`;
    const location = isSuggestionMode
      ? "Accepted classes join the current draft. Switching branches discards the entire proposal draft."
      : "Accepted classes were saved on the current branch. To undo an addition, use Delete on its class in the tree.";
    if (accepted > 0 && skipped === 0) toast.success("Suggestions accepted", `${counts} ${location}`);
    else toast.info("Suggestion review updated", accepted > 0 ? `${counts} ${location}` : counts);
  };

  const busy = review.isAcceptingAll || review.acceptingIndices.size > 0;
  const count = review.eligibleCount;
  const classes = count === 1 ? "class" : "classes";

  if (!review.items.length) return <p>No suggestions returned.</p>;

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy || count === 0}
        onClick={() => setConfirmationOpen(true)} className="focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400">
        Accept all eligible ({count})
      </Button>
      {review.error && (
        <p role="status" className="flex items-start gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {review.error}
        </p>
      )}
      <SuggestionReviewCards review={review} showDefinition />
      <ConfirmDialog
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        title="Accept all eligible suggestions"
        description={`Add ${count} ${classes} under ${target.label} ${isSuggestionMode ? "in the current draft" : "on the current branch"}?`}
        confirmLabel={`Accept ${count} ${classes}`}
        confirmDisabled={busy || count === 0}
        onConfirm={acceptAll}
      />
    </>
  );
}
