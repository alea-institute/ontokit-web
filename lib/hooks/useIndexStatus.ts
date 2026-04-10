import { useQuery } from "@tanstack/react-query";
import { projectOntologyApi } from "@/lib/api/client";

export const indexQueryKeys = {
  status: (projectId: string) => ["index", "status", projectId] as const,
};

export function useIndexStatus(
  projectId: string,
  accessToken?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: indexQueryKeys.status(projectId),
    queryFn: () => projectOntologyApi.getIndexStatus(projectId, accessToken),
    enabled: (options?.enabled ?? true) && !!projectId,
  });
}
