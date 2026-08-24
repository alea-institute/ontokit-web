"use client";

import { ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/suggestions/TierBadge";
import { useSuggestionOutcomes } from "@/lib/hooks/useSuggestionOutcomes";
import type { SuggestionOutcomeItem } from "@/lib/api/trust";
import { formatTimeAgo } from "@/lib/utils";

interface AuditLogSectionProps {
  projectId: string;
  accessToken?: string;
  /** Owner/admin only — the endpoint refuses anyone else. */
  canManage: boolean;
}

function TierSnapshot({ item }: { item: SuggestionOutcomeItem }) {
  if (item.snapshot_captured_at === null) {
    return (
      <span
        className="text-sm text-slate-400 dark:text-slate-500"
        title="Recorded before audit snapshots were captured"
      >
        —
      </span>
    );
  }

  if (item.is_anonymous) {
    return (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Anonymous
      </span>
    );
  }

  if (!item.snapshot_tier) {
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        Capture failed
      </span>
    );
  }

  return <TierBadge tier={item.snapshot_tier} />;
}

function AuditRow({ item }: { item: SuggestionOutcomeItem }) {
  const submitter = item.submitter_name || item.submitter_email || "Unknown submitter";
  const decider =
    item.decided_by === "system:auto-accept"
      ? "Auto-accepted"
      : item.decided_by_name || "Unknown decider";

  return (
    <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="space-y-2 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {submitter}
            </p>
            {item.is_anonymous && item.submitter_name && item.submitter_email && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {item.submitter_email}
              </p>
            )}
          </div>
          <TierSnapshot item={item} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>
            <span className="sr-only">Submitter role: </span>
            {item.snapshot_role || "—"}
          </span>
          <span>
            <span className="sr-only">Outcome: </span>
            {item.outcome}
          </span>
          <span>
            <span className="sr-only">Decided by: </span>
            {decider}
          </span>
          <time dateTime={item.created_at}>{formatTimeAgo(item.created_at)}</time>
        </div>
      </div>
    </li>
  );
}

export function AuditLogSection({ projectId, accessToken, canManage }: AuditLogSectionProps) {
  const outcomes = useSuggestionOutcomes(projectId, accessToken, canManage);

  if (!canManage) return null;

  if (outcomes.isError && outcomes.items.length === 0) {
    return (
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load the suggestion outcome audit trail.
        </p>
      </section>
    );
  }

  if (outcomes.isLoading || !outcomes.data) {
    return (
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading suggestion outcome audit trail…
        </div>
      </section>
    );
  }

  if (outcomes.items.length === 0) {
    return (
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
        <ClipboardList className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
          No decided outcomes yet
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          No decided outcomes yet — the audit trail records from today forward.
        </p>
      </section>
    );
  }

  return (
    <section
      id="suggestion-outcome-audit"
      className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Suggestion Outcome Audit
        </h2>
      </div>

      <ul className="space-y-3">
        {outcomes.items.map((item, index) => (
          <AuditRow
            key={`${item.created_at}-${item.user_id}-${index}`}
            item={item}
          />
        ))}
      </ul>

      {outcomes.isError ? (
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load more</p>
          <Button
            size="sm"
            variant="outline"
            disabled={outcomes.isFetchingNextPage}
            onClick={() => outcomes.fetchNextPage()}
          >
            {outcomes.isFetchingNextPage ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : outcomes.hasNextPage ? (
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
          disabled={outcomes.isFetchingNextPage}
          onClick={() => outcomes.fetchNextPage()}
        >
          {outcomes.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </section>
  );
}
