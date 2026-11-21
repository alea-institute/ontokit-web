import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { changesApi, type ChangedEntitiesFilters, type ProjectChangesFilters } from "@/lib/api/changes";
import { ApiError } from "@/lib/api/client";

export function isInvalidChangeFilterError(error: unknown) {
  return error instanceof ApiError && error.status === 422;
}

export function useProjectChanges(
  projectId: string,
  accessToken?: string,
  filters: ProjectChangesFilters = {},
  enabled = true,
) {
  const queryClient = useQueryClient();
  const retry = queryClient.getDefaultOptions().queries?.retry ?? 3;

  return useInfiniteQuery({
    queryKey: ["projectChanges", projectId, !!accessToken, filters],
    queryFn: ({ pageParam }) =>
      changesApi.list(projectId, accessToken, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!projectId && enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isInvalidChangeFilterError(error)) return false;
      if (typeof retry === "function") return retry(failureCount, error);
      return typeof retry === "number" ? failureCount < retry : retry;
    },
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
