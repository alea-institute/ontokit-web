import { useQuery } from "@tanstack/react-query";
import { projectApi } from "@/lib/api/projects";

export const memberQueryKeys = {
  list: (projectId: string) => ["members", projectId] as const,
};

export function useMembers(projectId: string, accessToken?: string) {
  return useQuery({
    queryKey: memberQueryKeys.list(projectId),
    queryFn: () => projectApi.listMembers(projectId, accessToken!),
    enabled: !!projectId && !!accessToken,
  });
}
