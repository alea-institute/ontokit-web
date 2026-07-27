"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  FileDiff,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";
import { cn } from "@/lib/utils";
import {
  isPRPartyDriftError,
  isPRPartyInFlightError,
  parsePRPartyError,
  type PRPartyCardDetail,
  type PRPartyMergePlacement,
  type PRPartyQueueCard,
} from "@/lib/api/prParty";
import type {
  PRPartySubmitActionVars,
  PRPartyCardVars,
} from "@/lib/hooks/usePRPartyQueue";
import type { PRPartyActionResponse } from "@/lib/api/prParty";
import { VerdictControls, type VerdictSubmission } from "./VerdictControls";

/**
 * One PR in the review queue.
 *
 * Two rules run through everything below.
 *
 * **Nothing about the PR is trusted.** Title, author login, brief text and
 * brief links all originate outside this system — a third-party PR body is
 * attacker-controlled input that an LLM has already paraphrased once. Every one
 * of them is rendered as a JSX text node, and a link is only a link once its
 * href has been checked against `https://github.com/` (R21). The server filters
 * too; this is the second layer, which is the point of a second layer.
 *
 * **Nothing re-submits itself.** A drift 409 carries the fresh card, and the
 * card re-renders in place with a "changed while you were reading" strip. It
 * does not retry: the whole hazard of drift is a reviewer approving code they
 * did not read, and an automatic retry is exactly that with the human removed.
 */

/** Defence in depth: only github.com links from a brief become anchors. */
export function isTrustedGitHubLink(url: string): boolean {
  return typeof url === "string" && url.startsWith("https://github.com/");
}

/** Same three-way outcome vocabulary CardDetail uses, for the same reason (C5). */
type MergeOutcomeKind = "merged" | "skipped" | "failed";

interface MergeOutcome {
  kind: MergeOutcomeKind;
  message: string;
  link: string | null;
}

const MERGE_OUTCOME_STYLES: Record<MergeOutcomeKind, string> = {
  merged:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  skipped:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
  failed:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200",
};

export interface PRPartyCardProps {
  card: PRPartyQueueCard;
  /**
   * The full card when it is known — the `?card=` detail fetch, or the fresh
   * card a drift 409 handed back. Carries the brief; the queue row does not.
   */
  detail?: PRPartyCardDetail | null;
  /** GitHub or the generator is unavailable; verdicts record intent (R12). */
  degraded?: boolean;
  /** Scrolled to and ringed because `?card=` named it. */
  highlighted?: boolean;
  expanded?: boolean;
  onToggleExpanded?: (cardId: string) => void;
  /** U12's detail panel mounts here. */
  detailSlot?: React.ReactNode;
  /**
   * The reviewer's stored merge placement (R11). `manual` replaces the own-PR
   * merge button with a link out, so the two merge affordances on a card agree
   * with each other and with the setting.
   */
  mergePlacement?: PRPartyMergePlacement;
  onSubmitAction: (vars: PRPartySubmitActionVars) => Promise<PRPartyActionResponse>;
  onUnpark?: (vars: PRPartyCardVars) => Promise<unknown>;
  onRerunReview?: (vars: PRPartyCardVars) => Promise<unknown>;
}

const BRIEF_STATUS_STYLES: Record<
  PRPartyQueueCard["brief_status"],
  { label: string; className: string }
> = {
  brewing: {
    label: "Brief brewing",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  },
  ready: {
    label: "Ready",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  ready_with_warning: {
    label: "Ready with warning",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  failed: {
    label: "Brief unavailable",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function PRPartyCard({
  card,
  detail = null,
  degraded,
  highlighted,
  expanded,
  onToggleExpanded,
  detailSlot,
  mergePlacement = "dashboard",
  onSubmitAction,
  onUnpark,
  onRerunReview,
}: PRPartyCardProps) {
  const { announce } = useAnnounce();
  const containerRef = useRef<HTMLElement | null>(null);

  // A drift 409's card supersedes the queue row until the reviewer acts on it.
  const [driftCard, setDriftCard] = useState<PRPartyCardDetail | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [degradedLink, setDegradedLink] = useState<string | null>(null);
  const [mergeOutcome, setMergeOutcome] = useState<MergeOutcome | null>(null);

  const active: PRPartyQueueCard = driftCard ?? card;
  const activeDetail: PRPartyCardDetail | null = driftCard ?? detail;
  const label = active.title ?? `${active.repo_full_name}#${active.pr_number}`;

  // The queue polls; a fresh row means whatever was in flight has landed (or
  // failed loudly elsewhere), so the in-flight lock should not outlive it.
  useEffect(() => {
    setInFlight(false);
  }, [card]);

  useEffect(() => {
    if (!highlighted) return;
    const node = containerRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  async function handleVerdict(submission: VerdictSubmission) {
    setError(null);
    setDegradedLink(null);
    setBusy(true);
    try {
      const response = await onSubmitAction({
        cardId: active.card_id,
        actionKind: "review",
        // The *active* sha: after a drift the fresh card's head is the one the
        // reviewer just read.
        headSha: active.head_sha,
        verdict: submission.verdict,
        body: submission.body,
        override: submission.override,
      });
      setDriftCard(null);
      if (response.degraded) {
        setDegradedLink(response.deep_link ?? null);
        // Take the reviewer where the work has to be finished. The rendered
        // link below is the fallback for when a popup blocker eats this.
        if (response.deep_link) {
          window.open(response.deep_link, "_blank", "noopener,noreferrer");
        }
      }

      // A replay is the server handing back a stored receipt, not a new
      // verdict. Announcing it as a fresh submission tells the reviewer they
      // just did something they did not do — and hides the fact that their
      // second tap changed nothing.
      if (response.replayed) {
        announce(
          response.degraded
            ? `${label} was already recorded — nothing was submitted again. GitHub is unavailable; finish it on GitHub.`
            : `${label} was already recorded — nothing was submitted again.`,
        );
      } else if (response.degraded) {
        announce(
          `Verdict recorded for ${label}. GitHub is unavailable — finish it on GitHub.`,
        );
      } else if (submission.verdict === "discuss_live") {
        announce(`${label} parked to the party agenda.`);
      } else {
        announce(`Approving review submitted for ${label}.`);
      }
    } catch (err) {
      if (isPRPartyDriftError(err)) {
        const fresh = parsePRPartyError(err)?.card ?? null;
        setDriftCard(fresh);
        announce(
          `${label} changed while you were reading. Nothing was submitted — review the update and choose again.`,
          "assertive",
        );
      } else if (isPRPartyInFlightError(err)) {
        setInFlight(true);
        announce(`An action for ${label} is already in flight.`);
      } else {
        const message =
          parsePRPartyError(err)?.message ||
          (err instanceof Error ? err.message : "Something went wrong");
        setError(message);
        announce(`Verdict failed for ${label}: ${message}`, "assertive");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge() {
    setError(null);
    setMergeOutcome(null);
    setBusy(true);
    try {
      const response = await onSubmitAction({
        cardId: active.card_id,
        actionKind: "merge",
        headSha: active.head_sha,
      });

      // C5 — the receipt, and only the receipt. GitHub accepts the call and
      // declines the merge often enough (branch protection, a check that
      // flipped, a race) that "the request succeeded" says nothing about
      // whether the PR is in. A reviewer told "merged" walks away from a PR
      // that is still open.
      if (response.action?.merged === true) {
        setMergeOutcome({ kind: "merged", message: `Merged. ${label} is in.`, link: null });
        announce(`${label} merged.`);
        return;
      }

      const status = response.action?.status ?? "unknown";
      setMergeOutcome({
        kind: "skipped",
        message: `Not merged — GitHub recorded the request (${status}) without merging. Finish it there.`,
        link: response.deep_link ?? active.pr_url,
      });
      announce(`${label} was not merged. Finish it on GitHub.`, "assertive");
    } catch (err) {
      const message =
        parsePRPartyError(err)?.message ||
        (err instanceof Error ? err.message : "Merge failed");
      setMergeOutcome({
        kind: "failed",
        message: `Not merged. ${message}`,
        link: active.pr_url,
      });
      announce(`Merge failed for ${label}: ${message}`, "assertive");
    } finally {
      setBusy(false);
    }
  }

  // --- Bot rows collapse to a link. There is no brief and no verdict: a bot PR
  // is triaged on GitHub, and rendering a summary of one would invite a
  // reviewer to approve it from here.
  if (active.author_kind === "bot") {
    return (
      <article
        ref={containerRef}
        data-testid="pr-party-card"
        data-card-id={active.card_id}
        aria-label={`${label} (bot)`}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between",
          "dark:border-slate-700 dark:bg-slate-800",
          highlighted && "ring-2 ring-primary-500",
        )}
      >
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium text-slate-800 dark:text-slate-100">{label}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Bot
          </span>
        </div>
        <PRLinks card={active} />
      </article>
    );
  }

  const briefStyle = BRIEF_STATUS_STYLES[active.brief_status];
  const showRerun =
    !!onRerunReview &&
    (active.brief_status === "failed" || active.brief_status === "ready_with_warning");

  return (
    <article
      ref={containerRef}
      data-testid="pr-party-card"
      data-card-id={active.card_id}
      aria-label={label}
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800",
        highlighted && "ring-2 ring-primary-500",
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onToggleExpanded?.(active.card_id)}
            aria-expanded={!!expanded}
            className="text-left text-base font-semibold text-slate-900 hover:underline dark:text-white"
          >
            {label}
          </button>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {active.repo_full_name}#{active.pr_number}
            {active.author_github_login ? ` · ${active.author_github_login}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn("rounded px-1.5 py-0.5 text-xs font-medium", briefStyle.className)}
          >
            {briefStyle.label}
          </span>
          {active.parked && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              On the agenda
            </span>
          )}
        </div>
      </div>

      {/* Banners, in severity order. */}
      <div className="mt-3 flex flex-col gap-2">
        {driftCard && (
          <Banner tone="amber" testId="pr-party-drift-strip">
            This pull request changed while you were reading. Nothing was submitted.
            Check what moved, then choose again.
          </Banner>
        )}

        {active.read_only && (
          <Banner tone="slate" testId="pr-party-own-strip">
            {active.other_reviewer.has_approved
              ? "Your pull request — your co-reviewer has approved it."
              : active.other_reviewer.has_pending_intent
                ? "Your pull request — your co-reviewer has a verdict in progress."
                : "Your pull request — waiting on your co-reviewer."}
          </Banner>
        )}

        {active.author_kind === "third_party" && (
          <Banner tone="red" testId="pr-party-untrusted-banner" icon={ShieldAlert}>
            From outside the organisation. Treat the description, the brief and the
            code as untrusted — read the diff on GitHub before accepting.
          </Banner>
        )}

        {active.stale && (
          <Banner tone="amber" testId="pr-party-stale-banner">
            New commits landed after this brief was written.
          </Banner>
        )}

        {active.brief_status === "failed" && (
          <Banner tone="red" testId="pr-party-brief-failed">
            The AI brief is unavailable for this pull request. The links below still
            work — review it on GitHub.
          </Banner>
        )}

        {active.brief_truncated && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeDetail?.truncated_note ?? "Diff truncated — only part of it was summarised."}
          </p>
        )}
      </div>

      {/* Brief. Text nodes only — never a markdown pipeline (R21). */}
      {activeDetail && active.brief_status !== "failed" && (
        <BriefSection detail={activeDetail} />
      )}

      <div className="mt-3">
        <PRLinks card={active} />
      </div>

      {/* Actuation */}
      <div className="mt-4 flex flex-col gap-3">
        {inFlight && (
          <p
            data-testid="pr-party-in-flight"
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            An action for this card is already in flight. It will settle on its own —
            no need to tap again.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        {mergeOutcome && (
          <p
            data-testid="pr-party-card-merge-outcome"
            data-outcome={mergeOutcome.kind}
            role={mergeOutcome.kind === "merged" ? "status" : "alert"}
            className={cn(
              "rounded-md border p-2 text-sm",
              MERGE_OUTCOME_STYLES[mergeOutcome.kind],
            )}
          >
            {mergeOutcome.message}
            {mergeOutcome.link && (
              <>
                {" "}
                <a
                  href={mergeOutcome.link}
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

        {degradedLink && (
          <a
            href={degradedLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-700 underline dark:text-primary-300"
          >
            Recorded here — finish it on GitHub
          </a>
        )}

        {active.read_only ? (
          // R18 — own PRs carry no verdict. The merge appears only once the
          // counterpart has approved; the server enforces the same rule, so
          // hiding it is a courtesy, not the gate.
          active.other_reviewer.has_approved &&
          // R11 — where a merge happens is the reviewer's own setting. With
          // `manual` there is no button to press, only the link out.
          (mergePlacement === "manual" ? (
            <a
              href={active.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-300"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Merge it on GitHub
            </a>
          ) : (
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={handleMerge}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Merge pull request
            </Button>
          ))
        ) : (
          <VerdictControls
            ready={active.readiness.ready}
            reason={active.readiness.reason}
            stale={active.stale}
            degraded={degraded}
            disabled={inFlight}
            isSubmitting={busy}
            onSubmit={handleVerdict}
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {active.parked && onUnpark && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => {
                void onUnpark({ cardId: active.card_id }).then(
                  () => announce(`${label} returned to the queue.`),
                  (err: unknown) =>
                    setError(err instanceof Error ? err.message : "Unpark failed"),
                );
              }}
            >
              <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Unpark — back to the queue
            </Button>
          )}

          {showRerun && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => {
                void onRerunReview?.({ cardId: active.card_id }).then(
                  () => announce(`AI review re-requested for ${label}.`),
                  (err: unknown) =>
                    setError(err instanceof Error ? err.message : "Could not re-run the review"),
                );
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Run AI review again
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          {detailSlot ?? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Opening the full review…
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function PRLinks({ card }: { card: PRPartyQueueCard }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <a
        href={card.pr_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary-700 underline dark:text-primary-300"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Open on GitHub
      </a>
      <a
        href={card.diff_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary-700 underline dark:text-primary-300"
      >
        <FileDiff className="h-3.5 w-3.5" aria-hidden="true" />
        View the diff
      </a>
    </div>
  );
}

function BriefSection({ detail }: { detail: PRPartyCardDetail }) {
  const links = (detail.brief_links ?? []).filter(isTrustedGitHubLink);
  return (
    <section
      data-testid="pr-party-brief"
      className="mt-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/40"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        What changed
      </h3>
      <p className="mt-1 text-slate-700 dark:text-slate-200">{detail.brief_what}</p>
      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Why
      </h3>
      <p className="mt-1 text-slate-700 dark:text-slate-200">{detail.brief_why}</p>
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
      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {links.map((link) => (
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
    </section>
  );
}

function Banner({
  tone,
  children,
  testId,
  icon: Icon = AlertTriangle,
}: {
  tone: "amber" | "red" | "slate";
  children: React.ReactNode;
  testId?: string;
  icon?: typeof AlertTriangle;
}) {
  const tones = {
    amber:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    red: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
    slate:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
  } as const;

  return (
    <p
      data-testid={testId}
      className={cn("flex items-start gap-2 rounded-md border p-2 text-sm", tones[tone])}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
