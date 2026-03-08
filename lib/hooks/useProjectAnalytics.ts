import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";

export function useProjectActivity(
  projectId: string,
  accessToken?: string,
  days = 30
) {
  return useQuery({
    queryKey: ["projectActivity", projectId, days],
    queryFn: () => analyticsApi.getActivity(projectId, accessToken, days),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useHotEntities(
  projectId: string,
  accessToken?: string,
  limit = 20
) {
  return useQuery({
    queryKey: ["hotEntities", projectId, limit],
    queryFn: () => analyticsApi.getHotEntities(projectId, accessToken, limit),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useContributors(
  projectId: string,
  accessToken?: string,
  days = 30
) {
  return useQuery({
    queryKey: ["contributors", projectId, days],
    queryFn: () => analyticsApi.getContributors(projectId, accessToken, days),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
