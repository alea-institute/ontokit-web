"use client";

import { useState, useEffect } from "react";
import { UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";

interface CreditModalProps {
  open: boolean;
  /**
   * Sole exit path — fired on save, skip, AND dismiss (Escape/backdrop).
   * `website` is the raw honeypot value; the parent MUST forward it verbatim
   * to the submit payload so the server-side control (filled honeypot ->
   * silent fake success) receives the bot signal. The parent closes the
   * modal itself (controlled `open`).
   *
   * `note` is the trimmed "Note for the reviewers" text. It is passed as a
   * fourth argument ONLY when non-empty, so an empty note is omitted from
   * the call entirely; the parent forwards it as the submission `summary`.
   */
  onSubmitCredit: (name: string | null, email: string | null, website: string, note?: string) => void;
}

/** Maximum length of the optional note for the reviewers. */
export const REVIEWER_NOTE_MAX_LENGTH = 1000;

/**
 * Pre-submission gate that lets anonymous contributors optionally provide
 * their name and email for credit attribution. Clicking "Submit Proposal"
 * opens this modal; the actual submit fires on every exit path (save, skip,
 * dismiss) via onSubmitCredit. Credit info is remembered in localStorage via
 * useAnonymousCreditStore for future proposals.
 *
 * Includes a hidden honeypot field (name="website") that bots fill but
 * humans never see. The value is forwarded verbatim — enforcement is
 * server-side (filled honeypot -> silent fake success), so the client must
 * not swallow it.
 */
export function CreditModal({ open, onSubmitCredit }: CreditModalProps) {
  const creditStore = useAnonymousCreditStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [note, setNote] = useState("");

  // Pre-fill from cached credit on open
  useEffect(() => {
    if (open) {
      // This is a deliberate form-reset boundary: the modal stays mounted while
      // closed, and every open must discard stale credit and honeypot drafts.
      // The reopen/reset contract is covered by CreditModal.test.tsx.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(creditStore.name ?? "");
      setEmail(creditStore.email ?? "");
      setHoneypot(""); // Always reset honeypot
      setNote(""); // A note belongs to one proposal; never carry it over
    }
  }, [open, creditStore.name, creditStore.email]);

  // Forward the note only when it has content, so an empty note is omitted
  // from the submission rather than sent as an empty summary.
  const submit = (submitName: string | null, submitEmail: string | null) => {
    const trimmedNote = note.trim().slice(0, REVIEWER_NOTE_MAX_LENGTH);
    if (trimmedNote) {
      onSubmitCredit(submitName, submitEmail, honeypot, trimmedNote);
    } else {
      onSubmitCredit(submitName, submitEmail, honeypot);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim() || null;
    const trimmedEmail = email.trim() || null;

    // Cache credit info for future proposals — but never cache anything a
    // honeypot-tripping submission typed (bot junk).
    if (!honeypot && (trimmedName || trimmedEmail)) {
      creditStore.setCredit(trimmedName, trimmedEmail);
    }

    // Forward the honeypot verbatim — the SERVER decides what a filled
    // honeypot means (silent fake success). Swallowing it client-side would
    // let the bot's edit through as a real submission.
    submit(trimmedName, trimmedEmail);
  };

  // Skip declines credit only; a note the contributor typed still travels
  // with the proposal on every exit path.
  const handleSkip = () => {
    submit(null, null);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleSkip(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            Want credit for your suggestions?
          </DialogTitle>
          <DialogDescription>
            Your changes have been submitted for review. Optionally share your name and email so the project maintainers can follow up.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3">
          {/* Name field */}
          <div>
            <label
              htmlFor="credit-name"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="credit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Email field */}
          <div>
            <label
              htmlFor="credit-email"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Email <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="credit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Note for the reviewers — sent as the submission summary */}
          <div>
            <label
              htmlFor="credit-note"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Note for the reviewers <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="credit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={REVIEWER_NOTE_MAX_LENGTH}
              rows={3}
              placeholder="Why does this change help?"
              aria-describedby="credit-note-count"
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <p
              id="credit-note-count"
              className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500"
            >
              {note.length}/{REVIEWER_NOTE_MAX_LENGTH} characters
            </p>
          </div>

          {/* Honeypot field — invisible to humans, filled by bots */}
          <input
            name="website"
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              opacity: 0,
              pointerEvents: "none",
            }}
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your info will only be used to attribute your contribution. We won&apos;t add you to any mailing list.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
