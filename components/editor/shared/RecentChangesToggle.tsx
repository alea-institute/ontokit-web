"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChangedEntities } from "@/lib/hooks/useChangedEntities";
import { ChangedEntitiesProvider } from "./ChangedEntitiesContext";

interface RecentChangesTreeProps {
  projectId: string;
  branch?: string;
  accessToken?: string;
  visible: boolean;
  children: ReactNode;
}

function readPreference(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

// Start with the server's default during hydration, then read browser storage.
const serverPreference = () => false;
const subscribeToPreference = () => () => {};

export function RecentChangesTree({ projectId, branch, accessToken, visible, children }: RecentChangesTreeProps) {
  const storageKey = `ontokit:recent-changes:${projectId}`;
  const [preference, setPreference] = useState<{ key: string; enabled: boolean } | null>(null);
  const storedPreference = useSyncExternalStore(subscribeToPreference, () => readPreference(storageKey), serverPreference);
  const enabled = preference?.key === storageKey ? preference.enabled : storedPreference;
  const { entries, truncated, isLoading, error, refetch } = useChangedEntities({
    projectId, branch, accessToken, days: 7, enabled: visible && enabled,
  });
  const query = branch ? `?${new URLSearchParams({ branch })}` : "";
  const href = `/projects/${encodeURIComponent(projectId)}/changes${query}`;

  function toggle() {
    setPreference({ key: storageKey, enabled: !enabled });
    try {
      localStorage.setItem(storageKey, enabled ? "0" : "1");
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  return (
    <>
      {visible && (
        <div className="shrink-0 space-y-1 border-b border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-busy={isLoading || undefined}
              onClick={toggle}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:text-slate-200 dark:focus-visible:outline-primary-400"
            >
              <span aria-hidden="true" className={cn(
                "relative h-4 w-7 shrink-0 rounded-full transition-colors",
                enabled ? "bg-primary-600 dark:bg-primary-500" : "bg-slate-300 dark:bg-slate-600",
              )}>
                <span className={cn(
                  "absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform dark:bg-slate-100",
                  enabled && "translate-x-3",
                )} />
              </span>
              Show recent changes
            </button>
            <Link
              href={href}
              prefetch={false}
              className="rounded-sm font-medium text-primary-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:text-primary-300 dark:focus-visible:outline-primary-400"
            >
              View all changes
            </Link>
          </div>
          <div aria-live="polite" className="text-slate-600 dark:text-slate-400">
            {enabled && (
              <>
                <p>Marks appear on loaded classes. View all changes for the complete list.</p>
                {isLoading ? (
                  <div className="py-1">
                    <span className="sr-only">Loading recent changes…</span>
                    <div aria-hidden="true" className="h-3 w-24 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
                  </div>
                ) : error ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-red-700 dark:text-red-400">Could not load recent changes.</p>
                    <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : truncated ? (
                  <p>Showing the 5,000 most recent changes. View all changes for the full list.</p>
                ) : branch && entries.size === 0 ? (
                  <p>No changes in the last 7 days.</p>
                ) : entries.size > 0 ? (
                  <p className="sr-only">Recent changes loaded.</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
      <ChangedEntitiesProvider entries={entries}>{children}</ChangedEntitiesProvider>
    </>
  );
}
