"use client";

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, GitBranch, History } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  CHANGE_WINDOWS,
  DEFAULT_CHANGE_WINDOW,
  ChangeFilters,
  ChangeHelp,
  ChangeSummary,
  TimeWindow,
  type ChangeFilterValues,
  type SelectedChangeFilters,
} from "@/components/changes/ChangeControls";
import { ChangeRow, ENTITY_TYPE_LABELS, NET_CHANGES } from "@/components/changes/ChangeRow";
import { ORIGIN_LABELS } from "@/components/changes/OriginBadge";
import type { NetChange, ProjectChangesResponse } from "@/lib/api/changes";
import { useProjectChanges } from "@/lib/hooks/useProjectChanges";
import { useProjectHomeHref } from "@/lib/hooks/useProjectHomeHref";

function matchingItems(pages: ProjectChangesResponse[], kinds: readonly NetChange[]) {
  const items = pages.flatMap((page) => page.items);
  // Net change describes the entire window, so filter the grouped rows.
  return kinds.length ? items.filter((item) => kinds.includes(item.net_change)) : items;
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "change" : "changes"}`;
}

export default function ProjectChangesPage() {
  const { data: session } = useSession();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectHomeHref = useProjectHomeHref(id);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const keepResultsFocus = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return;
    return () => {
      if (document.activeElement === button) resultsHeading.current?.focus();
    };
  }, []);

  const days = CHANGE_WINDOWS.find((preset) => String(preset) === searchParams.get("days")) ?? DEFAULT_CHANGE_WINDOW;
  const branch = searchParams.get("branch") || undefined;
  const requestedAuthors = searchParams.getAll("author").filter(Boolean);
  // Resolve URL author IDs against the whole window so combining filters
  // neither hides valid choices nor sends unknown author IDs to the feed.
  const windowFilters = { days, branch };
  const authorFeed = useProjectChanges(id, session?.accessToken, windowFilters);
  const windowAuthors = authorFeed.data?.pages[0]?.summary.authors;
  const waitingForAuthors = requestedAuthors.length > 0 && !windowAuthors;
  const knownAuthors = new Set(windowAuthors?.map(({ user_id }) => user_id));
  const selected: SelectedChangeFilters = {
    origin: searchParams.getAll("origin").filter((value): value is ChangeFilterValues["origin"] => Object.hasOwn(ORIGIN_LABELS, value)),
    author: requestedAuthors.filter((author) => knownAuthors.has(author)),
    entity_type: searchParams.getAll("entity_type").filter((value): value is ChangeFilterValues["entity_type"] => Object.hasOwn(ENTITY_TYPE_LABELS, value)),
    net_change: Array.from(new Set(searchParams.getAll("net_change"))).filter((value): value is NetChange => Object.hasOwn(NET_CHANGES, value)),
  };

  const feed = useProjectChanges(id, session?.accessToken, {
    ...windowFilters,
    origin: selected.origin.length ? selected.origin : undefined,
    entity_type: selected.entity_type.length ? selected.entity_type : undefined,
    author: selected.author.length ? selected.author : undefined,
  }, !waitingForAuthors);

  const pages = waitingForAuthors ? undefined : feed.data?.pages;
  const firstPage = pages?.[0];
  const activeBranch = firstPage?.window.branch ?? branch;
  const items = matchingItems(pages ?? [], selected.net_change);
  const matchingCount = firstPage && selected.net_change.length > 0
    ? selected.net_change.reduce((sum, kind) => sum + firstPage.summary.by_net_change[kind], 0)
    : undefined;
  const hasMoreMatches = feed.hasNextPage && (matchingCount === undefined || items.length < matchingCount);
  const hasEntityFilters = Object.values(selected).some((values) => values.length > 0);
  const authors = (windowAuthors ?? firstPage?.summary.authors ?? []).map(({ user_id, user_name }) => ({
    value: user_id, label: user_name || user_id,
  }));

  const [paginationNotice, setPaginationNotice] = useState<{
    pages: ProjectChangesResponse[];
    kinds: string;
    count: number;
  }>();
  const kinds = selected.net_change.join(",");
  const lastAdded = paginationNotice?.pages === pages && paginationNotice?.kinds === kinds
    ? paginationNotice.count
    : undefined;

  function updateUrl(update: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    update(next);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleFilter<Key extends keyof ChangeFilterValues>(key: Key, value: ChangeFilterValues[Key]) {
    const values: readonly string[] = selected[key];
    updateUrl((next) => {
      next.delete(key);
      const toggled = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
      for (const entry of toggled) next.append(key, entry);
    });
  }

  function clearFilters() {
    updateUrl((next) => {
      for (const key of Object.keys(selected)) next.delete(key);
      next.delete("days");
    });
  }

  async function loadMore() {
    if (feed.isFetching) return;
    const result = await feed.fetchNextPage();
    if (result.isFetchNextPageError || !result.data) return;
    setPaginationNotice({
      pages: result.data.pages,
      kinds,
      count: matchingItems(result.data.pages, selected.net_change).length - items.length,
    });
  }

  const windowLabel = days === 1 ? "24 hours" : `${days} days`;
  const isLoading = waitingForAuthors ? authorFeed.isLoading : feed.isLoading;
  const isError = waitingForAuthors ? authorFeed.isError : feed.isError && !pages;
  const retry = waitingForAuthors ? authorFeed.refetch : feed.refetch;
  const status = isLoading ? "Loading changes."
    : feed.isFetchingNextPage ? "Loading more changes."
    : feed.isFetchNextPageError ? "Failed to load more changes."
    : isError ? "Failed to load changes."
    : lastAdded !== undefined ? `${lastAdded} more ${lastAdded === 1 ? "change" : "changes"} loaded.`
    : `${countLabel(items.length)} loaded.`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-8">
        <Link
          href={projectHomeHref}
          className="inline-flex items-center gap-1 rounded-sm text-sm text-slate-600 hover:text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-primary-400"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to project
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Changes</h1>
            {activeBranch && (
              <p className="mt-1 flex items-start gap-1.5 wrap-anywhere text-sm text-slate-600 dark:text-slate-400">
                <GitBranch aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Branch: {activeBranch}
              </p>
            )}
          </div>
          <TimeWindow days={days} onChange={(preset) => updateUrl((next) => next.set("days", String(preset)))} />
        </div>

        <ChangeHelp />
        <ChangeSummary
          summary={firstPage?.summary}
          origins={selected.origin}
          netChanges={selected.net_change}
          onOrigin={(origin) => toggleFilter("origin", origin)}
          onNetChange={(change) => toggleFilter("net_change", change)}
          onAllNetChanges={() => updateUrl((next) => next.delete("net_change"))}
        />
        <ChangeFilters
          selected={selected}
          authors={authors}
          hasFilters={hasEntityFilters || days !== DEFAULT_CHANGE_WINDOW}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />

        <section aria-labelledby="changed-entities-heading" aria-busy={isLoading || feed.isFetchingNextPage} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <h2
            id="changed-entities-heading"
            ref={resultsHeading}
            tabIndex={-1}
            className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:border-slate-700 dark:text-white dark:focus-visible:ring-primary-400 sm:px-5"
          >
            Changed entities
          </h2>
          {hasMoreMatches && matchingCount !== undefined && (
            <p className="px-4 pt-3 text-sm text-slate-600 dark:text-slate-400 sm:px-5">
              {items.length} of {matchingCount} matching {matchingCount === 1 ? "entity" : "entities"} shown from loaded pages.
            </p>
          )}
          {isLoading ? (
            <div aria-hidden="true" className="space-y-4 p-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0 dark:border-slate-800">
                  <div className="h-5 w-20 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-20 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="space-y-3 p-8 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                Failed to load changes
              </p>
              <Button ref={keepResultsFocus} type="button" size="sm" onClick={() => void retry()}>Retry</Button>
            </div>
          ) : (
            <>
              {firstPage && items.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item) => (
                    <ChangeRow
                      key={item.entity_iri}
                      item={item}
                      projectId={id}
                      branch={firstPage.window.branch}
                      referenceTime={feed.dataUpdatedAt}
                    />
                  ))}
                </ul>
              ) : (
                <div className="space-y-2 p-8 text-center">
                  <History aria-hidden="true" className="mx-auto h-5 w-5 text-slate-500 dark:text-slate-400" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {hasMoreMatches ? "No matching changes on loaded pages"
                      : hasEntityFilters ? "No changes match your filters"
                      : `No changes in the last ${windowLabel}`}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {hasMoreMatches ? "Load more to look for matching changes."
                      : hasEntityFilters ? "Widen the time window or clear filters."
                      : "Widen the time window to look for earlier changes."}
                  </p>
                </div>
              )}
              {hasMoreMatches && (
                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  {feed.isFetchNextPageError && (
                    <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      Failed to load more changes
                    </p>
                  )}
                  <Button
                    ref={keepResultsFocus}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-disabled={feed.isFetching}
                    onClick={() => void loadMore()}
                    className="text-slate-700 focus-visible:ring-primary-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-slate-200 dark:focus-visible:ring-primary-400"
                  >
                    {feed.isFetchNextPageError ? "Retry" : feed.isFetchingNextPage ? "Loading more…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
        <p role="status" aria-live="polite" className="sr-only">{status}</p>
      </main>
    </div>
  );
}
