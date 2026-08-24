"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  trustApi,
  type ProjectTrustSettings,
  type ProjectTrustSettingsUpdate,
} from "@/lib/api/trust";
import { cn } from "@/lib/utils";

export const trustSettingsQueryKeys = {
  detail: (projectId: string) => ["trust-settings", projectId] as const,
};

interface TrustLadderSectionProps {
  projectId: string;
  accessToken?: string;
  /** Owner/admin only — the endpoints refuse anyone else. */
  canManage: boolean;
}

/**
 * Per-project ladder configuration (R6, R11; KTD8).
 *
 * Both defaults are deliberately conservative: five accepted suggestions to
 * earn trusted status, and auto-accept OFF until an owner opts in. Turning
 * auto-accept on means trusted contributors' suggestions merge themselves
 * after the quiet period, so the copy says exactly that rather than hiding it
 * behind a toggle label.
 */
export function TrustLadderSection({ projectId, accessToken, canManage }: TrustLadderSectionProps) {
  const queryClient = useQueryClient();
  // Only the fields the admin has touched live here; the server's answer is
  // the base. Deriving rather than mirroring means a refetch can never be
  // clobbered by a stale copy sitting in local state.
  const [edits, setEdits] = useState<Partial<ProjectTrustSettings>>({});
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: trustSettingsQueryKeys.detail(projectId),
    queryFn: () => trustApi.getSettings(projectId, accessToken!),
    enabled: canManage && !!accessToken,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (next: ProjectTrustSettingsUpdate) =>
      trustApi.updateSettings(projectId, next, accessToken!),
    onSuccess: (updated, submitted) => {
      setEdits((current) => {
        const remaining = { ...current };

        for (const key of Object.keys(submitted) as (keyof ProjectTrustSettings)[]) {
          if (Object.is(current[key], submitted[key])) {
            delete remaining[key];
          }
        }

        return remaining;
      });
      setSaved(true);
      queryClient.setQueryData(trustSettingsQueryKeys.detail(projectId), updated);
    },
  });

  const draft: ProjectTrustSettings | null = query.data
    ? { ...query.data, ...edits }
    : null;

  if (!canManage) return null;

  if (query.isError) {
    return (
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load the contribution trust settings.
        </p>
        <Button
          size="sm"
          className="mt-3"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Trying again…" : "Try again"}
        </Button>
      </section>
    );
  }

  if (query.isLoading || !draft) {
    return (
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading contribution trust settings…
        </div>
      </section>
    );
  }

  const dirty =
    !!query.data &&
    (draft.trust_promotion_threshold !== query.data.trust_promotion_threshold ||
      draft.auto_accept_enabled !== query.data.auto_accept_enabled ||
      draft.auto_accept_quiet_days !== query.data.auto_accept_quiet_days);

  const update = (patch: Partial<ProjectTrustSettings>) => {
    setSaved(false);
    setEdits((prev) => ({ ...prev, ...patch }));
  };

  return (
    <section
      id="trust-ladder"
      className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Contribution Trust
        </h2>
      </div>

      <div className="space-y-5">
        <div>
          <label
            htmlFor="trust-threshold"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Accepted suggestions to become trusted
          </label>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            A signed-in contributor is promoted automatically once this many of their
            suggestions have been accepted. Anonymous contributions are credited but never
            counted. You can always grant or refuse trust by hand on a member.
          </p>
          <input
            id="trust-threshold"
            type="number"
            min={1}
            max={100}
            value={draft.trust_promotion_threshold}
            onChange={(e) =>
              update({ trust_promotion_threshold: Number(e.target.value) })
            }
            className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={draft.auto_accept_enabled}
              onChange={(e) => update({ auto_accept_enabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Merge trusted contributors&apos; suggestions automatically
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                After the quiet period below passes with no reviewer comment or rejection, a
                trusted contributor&apos;s suggestion merges itself. Anonymous, new-contributor
                and AI-generated suggestions are never merged this way — they always wait for a
                human. Off unless you turn it on.
              </span>
            </span>
          </label>
        </div>

        <div className={cn(!draft.auto_accept_enabled && "opacity-50")}>
          <label
            htmlFor="quiet-days"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Quiet period (days)
          </label>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            Any reviewer comment stops the clock; resolving the objection starts a fresh
            window.
          </p>
          <input
            id="quiet-days"
            type="number"
            min={1}
            max={90}
            value={draft.auto_accept_quiet_days}
            disabled={!draft.auto_accept_enabled}
            onChange={(e) => update({ auto_accept_quiet_days: Number(e.target.value) })}
            className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => mutation.mutate({ ...edits })}
          >
            {mutation.isPending ? "Saving…" : "Save trust settings"}
          </Button>
          {saved && !dirty && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              Saved
            </p>
          )}
          {mutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              Couldn&apos;t save the trust settings.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
