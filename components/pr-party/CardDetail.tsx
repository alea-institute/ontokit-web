"use client";

import { useState } from "react";
import { ExternalLink, FileDiff, GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";
import { isTrustedGitHubLink, trustedGitHubUrl } from "@/lib/prPartyLinks";
import { QAThread } from "@/components/pr-party/QAThread";
import {
  usePRPartyCard,
  usePRPartyQueue,
  usePRPartySettings,
} from "@/lib/hooks/usePRPartyQueue";
import { parsePRPartyError } from "@/lib/api/prParty";
import type { PRPartyQueueCard } from "@/lib/api/prParty";

/**
 * The expanded PR Party card: the full brief, the deep links, the Q&A thread,
 * and the merge control (R5/R11/R13/R14).
 *
 * **A merge is reported only from its receipt (C5).** `POST /actions` returning
 * 200 means GitHub took the call, not that the branch moved: a protected branch,
 * a required check that flipped, or a race with another merge all produce a
 * successful response and an unmerged PR. `action.merged === true` is the only
 * thing this component will render as "merged". Everything else renders as *not*
 * merged, in its own colour, with a link to finish the job on GitHub — because a
 * reviewer who believes a PR merged when it did not walks away from it.
 *
 * **Whether merge is a button at all is the reviewer's own setting (R11).** With
 * `dashboard` they get one tap; with `manual` they get a link and nothing else.
 * That is a preference about where someone keeps their habits, not a capability
 * gate — the server still decides what is permitted.
 *
 * Brief text is LLM output over third-party PR content: text nodes only, and
 * links only when they are github.com URLs (R21).
 */

type MergeOutcomeKind = "merged" | "skipped" | "failed";

interface MergeOutcome {
  kind: MergeOutcomeKind;
  message: string;
  link: string | null;
}

const OUTCOME_STYLES: Record<MergeOutcomeKind, string> = {
  merged:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  skipped:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
  failed:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200",
};

export interface CardDetailProps {
  card: PRPartyQueueCard;
  reviewerId: string;
}

export function CardDetail({ card, reviewerId }: CardDetailProps) {
  const { announce } = useAnnounce();
  const { card: detail, isLoading, isError } = usePRPartyCard(card.card_id);
  const { submitAction, askQuestion } = usePRPartyQueue();
  const { settings } = usePRPartySettings();

  const [merging, setMerging] = useState(false);
  const [outcome, setOutcome] = useState<MergeOutcome | null>(null);

  const label = card.title ?? `${card.repo_full_name}#${card.pr_number}`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div
          role="status"
          aria-label="Loading the full review"
          className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Loading the full review…
        </span>
      </div>
    );
  }

  if (isError || !detail) {
    const safePrUrl = trustedGitHubUrl(card.pr_url);
    return (
      <div className="py-2">
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          The full review could not be loaded. Read it on GitHub instead.
        </p>
        {safePrUrl && <a
          href={safePrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-300"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open on GitHub
        </a>}
      </div>
    );
  }

  const briefLinks = (detail.brief_links ?? []).filter(isTrustedGitHubLink);
  // `merge_default` is a *placement* preference (`PRPartyMergePlacement`), not
  // GitHub's merge method. Anything other than an explicit `manual` falls back
  // to the dashboard button, which is the affordance the server can still refuse.
  const manualMerge = settings?.merge_default === "manual";
  // Own PRs (R18) already carry their own merge button on the card itself, which
  // appears only once the counterpart has approved. Rendering a second one here
  // would put two merge buttons on one card.
  const showMerge = detail.state === "open" && !detail.read_only;
  const hasApproval = detail.other_reviewer.has_approved;
  const safePrUrl = trustedGitHubUrl(detail.pr_url);
  const safeDiffUrl = trustedGitHubUrl(detail.diff_url);

  async function handleMerge() {
    if (!detail) return;
    setOutcome(null);
    setMerging(true);
    try {
      const response = await submitAction({
        cardId: detail.card_id,
        actionKind: "merge",
        headSha: detail.head_sha,
      });

      // C5 — the receipt, and only the receipt.
      if (response.action?.merged === true) {
        setOutcome({ kind: "merged", message: `Merged. ${label} is in.`, link: null });
        announce(`${label} merged.`);
        return;
      }

      const status = response.action?.status ?? "unknown";
      const link = trustedGitHubUrl(response.deep_link) ?? safePrUrl;
      setOutcome({
        kind: "skipped",
        message: `Not merged — GitHub recorded the request (${status}) without merging. Finish it there.`,
        link,
      });
      announce(`${label} was not merged. Finish it on GitHub.`, "assertive");
    } catch (err) {
      const message =
        parsePRPartyError(err)?.message ||
        (err instanceof Error ? err.message : "The merge failed");
      setOutcome({ kind: "failed", message: `Not merged. ${message}`, link: safePrUrl });
      announce(`Merge failed for ${label}: ${message}`, "assertive");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div data-testid="pr-party-card-detail" className="flex flex-col gap-4">
      {/* Brief. Text nodes only (R21). */}
      <section className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          What changed
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
          {detail.brief_what}
        </p>

        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Why
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
          {detail.brief_why}
        </p>

        {detail.brief_decisions?.length > 0 && (
          <>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Decisions
            </h3>
            <ul className="mt-1 list-disc pl-5 text-slate-700 dark:text-slate-200">
              {detail.brief_decisions.map((decision, index) => (
                <li key={index}>{decision}</li>
              ))}
            </ul>
          </>
        )}

        {detail.truncated_note && (
          <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {detail.truncated_note}
          </p>
        )}
      </section>

      {/* Deep links — the brief is a summary, not the source. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {safePrUrl && <a
          href={safePrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-700 underline dark:text-primary-300"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open the pull request
        </a>}
        {safeDiffUrl && <a
          href={safeDiffUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-700 underline dark:text-primary-300"
        >
          <FileDiff className="h-3.5 w-3.5" aria-hidden="true" />
          Read the diff
        </a>}
      </div>

      {briefLinks.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {briefLinks.map((link) => (
            <li key={link}>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-700 underline dark:text-primary-300"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>
      )}

      <QAThread
        cardId={detail.card_id}
        reviewerId={reviewerId}
        entries={detail.qa_thread ?? []}
        prUrl={detail.pr_url}
        onAsk={askQuestion}
      />

      {showMerge && (
        <section className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Merge
          </h3>

          {!hasApproval ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Merge is unavailable until the other reviewer approves this revision.
            </p>
          ) : manualMerge && safePrUrl ? (
            <a
              href={safePrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-300"
            >
              <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
              Merge it on GitHub
            </a>
          ) : manualMerge ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              The GitHub merge link is unavailable.
            </p>
          ) : (
            <Button
              type="button"
              className="mt-2 min-h-11 w-full sm:w-auto"
              disabled={merging}
              onClick={handleMerge}
            >
              {merging && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Merge pull request
            </Button>
          )}

          {outcome && (
            <p
              data-testid="pr-party-merge-outcome"
              data-outcome={outcome.kind}
              className={`mt-2 rounded-md border p-2 text-sm ${OUTCOME_STYLES[outcome.kind]}`}
            >
              {outcome.message}
              {outcome.link && (
                <>
                  {" "}
                  <a
                    href={outcome.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Open it on GitHub
                  </a>
                </>
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
