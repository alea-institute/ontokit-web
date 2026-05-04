import { useQuery } from "@tanstack/react-query";
import { suggestionsApi } from "@/lib/api/suggestions";

export const pendingSuggestionQueryKeys = {
  count: (projectId: string) => ["suggestions", "pendingCount", projectId] as const,
};

export function usePendingSuggestionCount(
  projectId: string,
  accessToken?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: pendingSuggestionQueryKeys.count(projectId),
    queryFn: async () => {
      const res = await suggestionsApi.listPending(projectId, accessToken!);
      return res.items.length;
    },
    enabled: (options?.enabled ?? true) && !!projectId && !!accessToken,
  });
}
