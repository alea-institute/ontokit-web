import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { changesApi, type ChangedEntitiesFilters, type ProjectChangesFilters } from "@/lib/api/changes";
import { ApiError } from "@/lib/api/client";

export function isChangesValidationError(error: unknown) {
  return error instanceof ApiError && error.status === 422;
}

export const projectChangesKey = (projectId: string) => ["projectChanges", projectId] as const;

export function useProjectChanges(
  projectId: string,
  accessToken?: string,
  filters: ProjectChangesFilters = {},
  enabled = true,
) {
  const queryClient = useQueryClient();
  const retry = queryClient.getDefaultOptions().queries?.retry ?? 3;
  const queryKey = [...projectChangesKey(projectId), filters.branch, "list", !!accessToken, filters] as const;

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      changesApi.list(projectId, accessToken, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!projectId && enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isChangesValidationError(error)) return false;
      if (typeof retry === "function") return retry(failureCount, error);
      return typeof retry === "number" ? failureCount < retry : retry;
    },
  });

  async function restartFromFirstPage() {
    await queryClient.resetQueries({ queryKey, exact: true });
    return queryClient.getQueryData<typeof query.data>(queryKey);
  }

  return { ...query, restartFromFirstPage };
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
