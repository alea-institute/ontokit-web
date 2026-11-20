"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, GitBranch, History } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  CHANGE_WINDOWS,
  ChangeFilters,
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
  // Applying event_type before grouping can change the entity's net change.
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

  const days = CHANGE_WINDOWS.find((preset) => String(preset) === searchParams.get("days")) ?? 7;
  const branch = searchParams.get("branch") || undefined;
  const selected: SelectedChangeFilters = {
    origin: searchParams.getAll("origin").filter((value): value is ChangeFilterValues["origin"] => Object.hasOwn(ORIGIN_LABELS, value)),
    author: searchParams.getAll("author").filter(Boolean),
    entity_type: searchParams.getAll("entity_type").filter((value): value is ChangeFilterValues["entity_type"] => Object.hasOwn(ENTITY_TYPE_LABELS, value)),
    net_change: searchParams.getAll("net_change").filter((value): value is NetChange => Object.hasOwn(NET_CHANGES, value)),
  };

  const filtersWithoutAuthor = { days, branch, origin: selected.origin, entity_type: selected.entity_type };
  const feed = useProjectChanges(id, session?.accessToken, {
    ...filtersWithoutAuthor,
    author: selected.author.length ? selected.author : undefined,
  });
  // The filtered summary only includes matching authors. Reuse the request
  // without the author filter so users can still add another author.
  const authorFeed = useProjectChanges(
    id, session?.accessToken, filtersWithoutAuthor, selected.author.length > 0,
  );

  const pages = feed.data?.pages;
  const firstPage = pages?.[0];
  const activeBranch = firstPage?.window.branch ?? branch;
  const items = matchingItems(pages ?? [], selected.net_change);
  const authorSummary = authorFeed.data?.pages[0]?.summary ?? firstPage?.summary;
  const authors = new Map(authorSummary?.authors.map(({ user_id, user_name }) => [user_id, user_name || user_id]));
  for (const author of selected.author) {
    if (!authors.has(author)) authors.set(author, author);
  }

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
    });
  }

  async function loadMore() {
    const result = await feed.fetchNextPage();
    if (result.isFetchNextPageError || !result.data) return;
    setPaginationNotice({
      pages: result.data.pages,
      kinds,
      count: matchingItems(result.data.pages, selected.net_change).length - items.length,
    });
  }

  const windowLabel = days === 1 ? "day" : `${days} days`;
  const status = feed.isLoading ? "Loading changes."
    : feed.isFetchingNextPage ? "Loading more changes."
    : feed.isFetchNextPageError ? "Failed to load more changes."
    : feed.isError && !pages ? "Failed to load changes."
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
          authors={Array.from(authors, ([value, label]) => ({ value, label }))}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />

        <section aria-labelledby="changed-entities-heading" aria-busy={feed.isLoading || feed.isFetchingNextPage} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <h2 id="changed-entities-heading" className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900 dark:border-slate-700 dark:text-white sm:px-5">
            Changed entities
          </h2>
          {feed.isLoading ? (
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
          ) : feed.isError && !pages ? (
            <div className="space-y-3 p-8 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                Failed to load changes
              </p>
              <Button type="button" size="sm" onClick={() => void feed.refetch()}>Retry</Button>
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
                    {feed.hasNextPage ? "No matching changes on loaded pages" : `No changes in the last ${windowLabel}`}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {feed.hasNextPage ? "Load more to look for matching changes." : "Widen the time window or clear filters."}
                  </p>
                </div>
              )}
              {(feed.hasNextPage || feed.isFetchNextPageError) && (
                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  {feed.isFetchNextPageError && (
                    <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      Failed to load more changes
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={feed.isFetching}
                    onClick={() => void loadMore()}
                    className="text-slate-700 focus-visible:ring-primary-500 dark:text-slate-200 dark:focus-visible:ring-primary-400"
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
