import { useQuery } from "@tanstack/react-query";
import { llmApi, type LLMUsageResponse } from "@/lib/api/llm";

export function useLLMUsage(projectId: string, accessToken?: string) {
  const usageQuery = useQuery({
    queryKey: ["llm-usage", projectId],
    queryFn: () => llmApi.getUsage(projectId, accessToken!),
    enabled: !!accessToken && !!projectId,
    staleTime: 60_000, // 1 min — refresh when user views dashboard
    refetchInterval: 60_000, // auto-refresh every minute while tab is visible
  });

  return {
    usage: usageQuery.data as LLMUsageResponse | undefined,
    isLoading: usageQuery.isLoading,
    error: usageQuery.error,
    refetch: usageQuery.refetch,
  };
}
