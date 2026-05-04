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
    enabled: (options?.enabled ?? true) && !!projectId && !!accessToken,
  });
}
