import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { changesApi, type ChangedEntitiesFilters, type ProjectChangesFilters } from "@/lib/api/changes";

export function useProjectChanges(
  projectId: string,
  accessToken?: string,
  filters: ProjectChangesFilters = {},
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["projectChanges", projectId, !!accessToken, filters],
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
    queryKey: ["changedEntities", projectId, !!accessToken, filters],
    queryFn: () => changesApi.listChangedEntities(projectId, accessToken, filters),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
