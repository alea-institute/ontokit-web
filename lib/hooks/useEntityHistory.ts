import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";

export function useEntityHistory(
  projectId: string,
  entityIri: string | null,
  accessToken?: string,
  branch?: string,
  limit = 50
) {
  return useQuery({
    queryKey: ["entityHistory", projectId, entityIri, branch, limit],
    queryFn: () =>
      analyticsApi.getEntityHistory(projectId, entityIri!, accessToken, branch, limit),
    enabled: !!entityIri && !!projectId,
    staleTime: 30_000,
  });
}
