"use client";

import { useId, useState } from "react";
import { AlertTriangle, Check, MessagesSquare, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PRPartyVerdict } from "@/lib/api/prParty";

/**
 * The three verdicts, in the reviewer's language (R7).
 *
 * "Accept" and "Accept with suggestions" are both `approve` — the difference
 * is the body the review carries, not the verdict. "Discuss live" is
 * `discuss_live`: the server records the park (R9) and posts nothing to
 * GitHub, which is why its copy promises exactly that. `request_changes` has
 * no button — the party model concludes a disagreement in person, not by a
 * rejection posted asynchronously.
 */
export interface VerdictSubmission {
  verdict: PRPartyVerdict;
  body?: string;
  /** AE6 — the reviewer chose to act before the card was ready. */
  override?: boolean;
}

interface VerdictControlsProps {
  /** Server-supplied. Never re-derived here — the two would drift. */
  ready: boolean;
  /** Plain-language reason a verdict is blocked, when it is. */
  reason: string | null;
  /** The PR moved after the brief was written (AE2). */
  stale: boolean;
  /** GitHub or the brief generator is unavailable — verdicts record intent. */
  degraded?: boolean;
  /** An action for this card is already in flight. */
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (submission: VerdictSubmission) => void;
}

const ACCEPT_COPY = "Posts an approving review on GitHub as you";
const ACCEPT_NOTES_COPY = "Posts an approving review carrying your notes";
const DISCUSS_COPY = "Parks this card to the party agenda — nothing posts to GitHub";
const DEGRADED_ACCEPT_COPY = "Records your decision here, then opens GitHub to finish it";
const DEGRADED_NOTES_COPY = "Records your decision and notes here, then opens GitHub";

export function VerdictControls({
  ready,
  reason,
  stale,
  degraded,
  disabled,
  isSubmitting,
  onSubmit,
}: VerdictControlsProps) {
  // Several cards can be on screen at once; a fixed id would collide and point
  // every label at the first textarea.
  const notesFieldId = useId();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  // A verdict held back by the stale confirm step (AE2).
  const [pending, setPending] = useState<VerdictSubmission | null>(null);

  const busy = !!disabled || !!isSubmitting;

  /**
   * A stale card demands an explicit confirm before anything is posted to
   * GitHub. Discuss-live is exempt: parking a card cannot approve stale code.
   */
  function request(submission: VerdictSubmission) {
    if (stale && submission.verdict === "approve") {
      setPending(submission);
      return;
    }
    onSubmit(submission);
  }

  if (pending) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This pull request changed after the brief was written. Accepting now approves
          the newer code, which nobody has summarised for you.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => {
              const submission = pending;
              setPending(null);
              onSubmit(submission);
            }}
          >
            Confirm and accept anyway
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => setPending(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <VerdictButton
        icon={Check}
        label={degraded ? "Accept (record + open GitHub)" : "Accept"}
        description={degraded ? DEGRADED_ACCEPT_COPY : ACCEPT_COPY}
        disabled={busy || !ready}
        blockedReason={!ready ? reason : null}
        onClick={() => request({ verdict: "approve" })}
      />

      {notesOpen ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <label
            htmlFor={notesFieldId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Your notes
          </label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {degraded ? DEGRADED_NOTES_COPY : ACCEPT_NOTES_COPY}
          </p>
          <textarea
            id={notesFieldId}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className={cn(
              "mt-2 w-full rounded-md border border-slate-300 bg-white p-2 text-sm",
              "text-slate-900 placeholder:text-slate-400",
              "focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500",
              "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
            )}
            placeholder="What should the author know?"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy || !ready || notes.trim().length === 0}
              onClick={() => {
                setNotesOpen(false);
                request({ verdict: "approve", body: notes.trim() });
              }}
            >
              Send accept with suggestions
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setNotesOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <VerdictButton
          icon={PencilLine}
          label="Accept with suggestions"
          description={degraded ? DEGRADED_NOTES_COPY : ACCEPT_NOTES_COPY}
          disabled={busy || !ready}
          blockedReason={!ready ? reason : null}
          onClick={() => setNotesOpen(true)}
        />
      )}

      {/* Discuss live stays available while the brief is still brewing: talking
          about a PR needs no summary, and the party agenda is where an
          unreadable card belongs. */}
      <VerdictButton
        icon={MessagesSquare}
        label="Discuss live"
        description={DISCUSS_COPY}
        disabled={busy}
        blockedReason={null}
        onClick={() => request({ verdict: "discuss_live" })}
      />

      {!ready && (
        // AE6 — one tap, carrying the override with it. A two-step "unlock then
        // accept" would let a reviewer forget which state they unlocked.
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start text-left"
          disabled={busy}
          onClick={() => request({ verdict: "approve", override: true })}
        >
          Review anyway — accept without waiting
        </Button>
      )}
    </div>
  );
}

interface VerdictButtonProps {
  icon: typeof Check;
  label: string;
  description: string;
  disabled: boolean;
  blockedReason: string | null;
  onClick: () => void;
}

function VerdictButton({
  icon: Icon,
  label,
  description,
  disabled,
  blockedReason,
  onClick,
}: VerdictButtonProps) {
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-start gap-2 py-2 text-left"
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </Button>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {blockedReason && (
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{blockedReason}</p>
      )}
    </div>
  );
}
