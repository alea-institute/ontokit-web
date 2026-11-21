import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changesApi, type ChangedEntitiesResponse } from "@/lib/api/changes";
import type { BranchListResponse } from "@/lib/api/revisions";
import { branchQueryKeys } from "@/lib/context/BranchContext";
import { projectChangesKey } from "./useProjectChanges";

export type ChangedEntity = ChangedEntitiesResponse["items"][number];

const emptyEntries: ReadonlyMap<string, ChangedEntity> = new Map();
const changedEntitiesKey = (projectId: string, branch: string | undefined) =>
  ["changed-entities", projectId, branch] as const;

interface UseChangedEntitiesOptions {
  projectId: string;
  branch?: string;
  accessToken?: string;
  days: number;
  enabled: boolean;
}

export function useChangedEntities({
  projectId,
  branch,
  accessToken,
  days,
  enabled,
}: UseChangedEntitiesOptions) {
  const isEnabled = enabled && !!projectId && !!branch;
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: [...changedEntitiesKey(projectId, branch), days, !!accessToken],
    queryFn: () => changesApi.listChangedEntities(projectId, accessToken, { branch, days }),
    enabled: isEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const entries = useMemo(() => isEnabled && data
    ? new Map(data.items.map((item) => [item.entity_iri, item]))
    : emptyEntries, [isEnabled, data]);

  return {
    entries,
    truncated: isEnabled && (data?.truncated ?? false),
    isLoading: isEnabled && isFetching,
    error: isEnabled ? error : null,
    refetch,
  };
}

export function useInvalidateChangedEntitiesAfterSave(projectId: string, accessToken?: string, enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const branchKey = branchQueryKeys.list(projectId, accessToken);
    const cache = queryClient.getQueryCache();
    let previous = queryClient.getQueryData<BranchListResponse>(branchKey);
    // Source and entity saves already invalidate the branch list. Keep
    // watching when the source view hides the tree so cached changes go stale.
    return cache.subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success" ||
          event.query !== cache.find({ queryKey: branchKey, exact: true })) return;
      const current = queryClient.getQueryData<BranchListResponse>(branchKey);
      const previousHeads = new Map(previous?.items.map((item) => [item.name, item.commit_hash]));
      previous = current;
      const markerKeys = [];
      for (const item of current?.items ?? []) {
        const lastHead = previousHeads.get(item.name);
        if (lastHead && item.commit_hash && lastHead !== item.commit_hash) {
          markerKeys.push(changedEntitiesKey(projectId, item.name));
        }
      }
      if (markerKeys.length === 0) return;

      // Changes requests can omit the branch and let the API resolve the default.
      for (const queryKey of [...markerKeys, projectChangesKey(projectId)]) {
        const filters = { queryKey };
        // The first read may have started before the commit.
        void queryClient.cancelQueries(filters).then(() => queryClient.invalidateQueries(filters));
      }
    });
  }, [queryClient, projectId, accessToken, enabled]);
}
