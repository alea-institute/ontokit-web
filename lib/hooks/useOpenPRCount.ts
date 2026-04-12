import { useQuery } from "@tanstack/react-query";
import { pullRequestsApi } from "@/lib/api/pullRequests";

export const openPRCountQueryKeys = {
  count: (projectId: string) => ["pullRequests", "openCount", projectId] as const,
};

export function useOpenPRCount(projectId: string, accessToken?: string) {
  return useQuery({
    queryKey: openPRCountQueryKeys.count(projectId),
    queryFn: async () => {
      const res = await pullRequestsApi.list(projectId, accessToken, "open", undefined, 0, 1);
      return res.total;
    },
    enabled: !!projectId && !!accessToken,
  });
}
