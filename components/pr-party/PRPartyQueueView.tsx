"use client";

import { useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, LogIn, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePRPartyCapabilities } from "@/lib/hooks/usePRPartyCapabilities";
import { usePRPartyQueue, usePRPartySettings } from "@/lib/hooks/usePRPartyQueue";
import type { PRPartyQueueCard } from "@/lib/api/prParty";
import { PRPartyCard } from "./PRPartyCard";
import { QueueTabs, type PRPartyTab } from "./QueueTabs";

/**
 * The review queue itself, gates included.
 *
 * All of it lives here rather than in `app/pr-party/page.tsx` because the page
 * is excluded from coverage — a gate that decides who sees verdict buttons is
 * the last thing that should sit in an untested file.
 *
 * Reviewer posture comes from `usePRPartyCapabilities` and nowhere else, and it
 * fails closed: while the capability query is in flight, the visitor is not a
 * reviewer, so the queue is not fetched and the affordances do not flicker into
 * existence ahead of the permission behind them.
 */

/**
 * Has the caller concluded this card at its current head?
 *
 * Only actions at `head_sha` count: a verdict on an older commit was concluded
 * against code that has since moved, which is precisely the card that belongs
 * back in the queue rather than in Done.
 *
 * `discuss_live` is excluded even though the server records it as a succeeded
 * review action: parking a card for the party is the opposite of concluding it.
 * A park that counted as settled would file the card under Done and empty the
 * agenda the park exists to fill.
 */
export function isSettledForCaller(card: PRPartyQueueCard): boolean {
  return card.actions.some(
    (action) =>
      action.head_sha === card.head_sha &&
      action.verdict !== "discuss_live" &&
      (action.status === "succeeded" || action.status === "degraded_confirmed"),
  );
}

const EMPTY_COPY: Record<PRPartyTab, { title: string; body: string }> = {
  queue: {
    title: "Nothing waiting on you",
    body: "New pull requests appear here as soon as their brief is ready.",
  },
  agenda: {
    title: "No cards parked for the party",
    body: "Choose “Discuss live” on a card to bring it to the next party.",
  },
  done: {
    title: "No concluded reviews yet",
    body: "Reviews you conclude stay here until the pull request is closed or merged.",
  },
};

export interface PRPartyQueueViewProps {
  /** U12 mounts the full detail panel for the expanded card through here. */
  renderCardDetail?: (card: PRPartyQueueCard) => React.ReactNode;
}

export function PRPartyQueueView({ renderCardDetail }: PRPartyQueueViewProps = {}) {
  const { status } = useSession();
  const {
    isReviewer,
    degraded,
    credential,
    isLoading: capsLoading,
  } = usePRPartyCapabilities();
  const searchParams = useSearchParams();
  const cardParam = searchParams?.get("card") ?? null;

  // Both pieces of view state are derived from `?card=` with a user override
  // that expires when the param changes, rather than synced by an effect: a new
  // deep link should win over whatever the reviewer had open, and an effect
  // would render the stale value first and correct it a frame later.
  const [tabChoice, setTabChoice] = useState<{ param: string | null; tab: PRPartyTab | null }>(
    { param: cardParam, tab: null },
  );
  const [expandedChoice, setExpandedChoice] = useState<{
    param: string | null;
    cardId: string | null;
  }>({ param: cardParam, cardId: cardParam });

  /** Lifted here so U12's detail panel and this list agree on what is open. */
  const expandedCardId =
    expandedChoice.param === cardParam ? expandedChoice.cardId : cardParam;

  const queue = usePRPartyQueue({ enabled: isReviewer });
  // Merge placement is a reviewer preference, so it is fetched once here and
  // handed to every card rather than fetched per card.
  const { settings } = usePRPartySettings({ enabled: isReviewer });

  const groups = useMemo(() => {
    const result: Record<PRPartyTab, PRPartyQueueCard[]> = {
      queue: [],
      agenda: [],
      done: [],
    };
    for (const card of queue.cards) {
      // Parked first, and deliberately: `parked` is the server's own statement
      // that this card is waiting for the party. Whatever actions sit on it,
      // the agenda is where the reviewer expects to find it.
      if (card.parked) result.agenda.push(card);
      else if (isSettledForCaller(card)) result.done.push(card);
      else result.queue.push(card);
    }
    return result;
  }, [queue.cards]);

  // A `?card=` deep link opens on the tab that actually holds the card — and
  // keeps following it if a verdict moves it to Done, which is where the
  // reviewer's attention already is.
  const deepLinkTab = useMemo<PRPartyTab | null>(() => {
    if (!cardParam) return null;
    for (const candidate of ["queue", "agenda", "done"] as PRPartyTab[]) {
      if (groups[candidate].some((card) => card.card_id === cardParam)) return candidate;
    }
    return null;
  }, [cardParam, groups]);

  const tab: PRPartyTab =
    (tabChoice.param === cardParam ? tabChoice.tab : null) ?? deepLinkTab ?? "queue";
  const setTab = (next: PRPartyTab) => setTabChoice({ param: cardParam, tab: next });

  if (status === "loading" || (status === "authenticated" && capsLoading)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div
          role="status"
          aria-label="Loading the review queue"
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
        />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          Sign in to review pull requests
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          PR Party is where reviewers read a pull request and decide on it.
        </p>
        <Button
          className="mt-6 min-h-11"
          onClick={() => signIn("zitadel", { callbackUrl: window.location.href })}
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign In
        </Button>
      </div>
    );
  }

  if (!isReviewer) {
    // Deliberately says nothing about who the reviewers are.
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          PR Party is limited to designated reviewers
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your account does not have review access. Nothing else on OntoKit is
          affected.
        </p>
      </div>
    );
  }

  const visible = groups[tab];
  const empty = EMPTY_COPY[tab];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QueueTabs
          value={tab}
          onChange={setTab}
          counts={{
            queue: groups.queue.length,
            agenda: groups.agenda.length,
            done: groups.done.length,
          }}
        />
        <Link
          href="/pr-party/settings"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
      </div>

      {degraded && (
        <p
          data-testid="pr-party-degraded-notice"
          data-degraded-cause={credential ? "outage" : "no-credential"}
          className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
        >
          {/* A reviewer who has never stored a PAT is not looking at a GitHub
              outage — they are looking at a setup step nobody told them about.
              Blaming GitHub sends them to check a status page instead of the
              one screen that fixes it. */}
          {credential ? (
            <>
              GitHub is unavailable right now. Verdicts are recorded here and finished
              on GitHub by hand.
            </>
          ) : (
            <>
              Connect your GitHub token in{" "}
              <Link href="/pr-party/settings" className="font-medium underline">
                Review settings
              </Link>{" "}
              to post verdicts. Until then they are recorded here only.
            </>
          )}
        </p>
      )}

      <div className="mt-6">
        {queue.isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div
              role="status"
              aria-label="Loading the review queue"
              className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
            />
          </div>
        ) : queue.isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20">
            <p className="flex items-center justify-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {queue.error instanceof Error
                ? queue.error.message
                : "Couldn't load the review queue"}
            </p>
            <Button
              variant="outline"
              className="mt-4 min-h-11"
              disabled={queue.isFetching}
              onClick={() => void queue.refetch()}
            >
              {queue.isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {empty.title}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{empty.body}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((card) => (
              <PRPartyCard
                key={card.card_id}
                card={card}
                degraded={degraded}
                highlighted={cardParam === card.card_id}
                expanded={expandedCardId === card.card_id}
                onToggleExpanded={(cardId) =>
                  setExpandedChoice({
                    param: cardParam,
                    cardId: expandedCardId === cardId ? null : cardId,
                  })
                }
                detailSlot={renderCardDetail?.(card)}
                mergePlacement={settings?.merge_default === "manual" ? "manual" : "dashboard"}
                onSubmitAction={queue.submitAction}
                onUnpark={queue.unparkCard}
                onRerunReview={queue.rerunReview}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
