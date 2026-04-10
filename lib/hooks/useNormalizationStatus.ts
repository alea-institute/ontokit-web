import { useQuery } from "@tanstack/react-query";
import { normalizationApi } from "@/lib/api/normalization";

export const normalizationQueryKeys = {
  status: (projectId: string) => ["normalization", "status", projectId] as const,
};

export function useNormalizationStatus(
  projectId: string,
  accessToken?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: normalizationQueryKeys.status(projectId),
    queryFn: () => normalizationApi.getStatus(projectId, accessToken),
    enabled: (options?.enabled ?? true) && !!projectId,
  });
}
