import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { changesApi, type ChangedEntitiesFilters, type ProjectChangesFilters } from "@/lib/api/changes";

export const projectChangesKey = (projectId: string) => ["projectChanges", projectId] as const;

export function useProjectChanges(
  projectId: string,
  accessToken?: string,
  filters: ProjectChangesFilters = {},
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: [...projectChangesKey(projectId), filters.branch, "list", !!accessToken, filters],
    queryFn: ({ pageParam }) =>
      changesApi.list(projectId, accessToken, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!projectId && enabled,
    staleTime: 60_000,
  });
}

export function useChangedEntities(
  projectId: string,
  accessToken?: string,
  filters: ChangedEntitiesFilters = {},
) {
  return useQuery({
    queryKey: [...projectChangesKey(projectId), filters.branch, "digest", !!accessToken, filters],
    queryFn: () => changesApi.listChangedEntities(projectId, accessToken, filters),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
