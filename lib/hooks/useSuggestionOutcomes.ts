import { useInfiniteQuery } from "@tanstack/react-query";
import { trustApi } from "@/lib/api/trust";

export const suggestionOutcomesQueryKeys = {
  list: (projectId: string) => ["suggestion-outcomes", projectId] as const,
};

/**
 * Submission outcomes and their immutable submitter snapshots.
 *
 * Owner/admin only server-side, so `enabled` carries the same condition. The
 * returned items accumulate across cursor pages for a Load more control.
 */
export function useSuggestionOutcomes(
  projectId: string,
  accessToken?: string,
  canManage = true,
) {
  const query = useInfiniteQuery({
    queryKey: suggestionOutcomesQueryKeys.list(projectId),
    queryFn: ({ pageParam }) =>
      trustApi.listOutcomes(
        projectId,
        { cursor: pageParam, limit: 25 },
        accessToken!,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!projectId && canManage && !!accessToken,
    staleTime: 30_000,
  });

  const pages = query.data?.pages;

  return {
    ...query,
    items: pages?.flatMap((page) => page.items) ?? [],
    total: pages?.[0]?.total ?? 0,
    next_cursor: pages?.at(-1)?.next_cursor ?? null,
  };
}
