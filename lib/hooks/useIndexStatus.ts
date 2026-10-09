import { useQuery } from "@tanstack/react-query";
import { projectOntologyApi } from "@/lib/api/client";

export const indexQueryKeys = {
  status: (projectId: string, accessToken?: string) =>
    ["index", "status", projectId, accessToken] as const,
};

export function useIndexStatus(
  projectId: string,
  accessToken?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: indexQueryKeys.status(projectId, accessToken),
    queryFn: () => projectOntologyApi.getIndexStatus(projectId, accessToken),
    // Index notifications are best effort; reconcile even if an update is lost.
    refetchInterval: 15_000,
    enabled: (options?.enabled ?? true) && !!projectId && !!accessToken,
  });
}
