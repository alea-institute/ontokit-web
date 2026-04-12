import { useQuery } from "@tanstack/react-query";
import { lintApi } from "@/lib/api/lint";

export const lintQueryKeys = {
  summary: (projectId: string) => ["lint", "summary", projectId] as const,
};

export function useLintSummary(projectId: string, accessToken?: string) {
  return useQuery({
    queryKey: lintQueryKeys.summary(projectId),
    queryFn: () => lintApi.getStatus(projectId, accessToken),
    enabled: !!projectId && !!accessToken,
  });
}
