import { useQuery } from "@tanstack/react-query";
import { normalizationApi } from "@/lib/api/normalization";

export const normalizationQueryKeys = {
  status: (projectId: string, accessToken?: string) =>
    ["normalization", "status", projectId, accessToken] as const,
};

export function useNormalizationStatus(
  projectId: string,
  accessToken?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: normalizationQueryKeys.status(projectId, accessToken),
    queryFn: () => normalizationApi.getStatus(projectId, accessToken),
    enabled: (options?.enabled ?? true) && !!projectId && !!accessToken,
  });
}
