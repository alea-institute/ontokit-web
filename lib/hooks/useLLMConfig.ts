import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { llmApi, type LLMConfigUpdate, type LLMConfigResponse } from "@/lib/api/llm";

export function useLLMConfig(projectId: string, accessToken?: string) {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["llm-config", projectId],
    queryFn: () => llmApi.getConfig(projectId, accessToken!),
    enabled: !!accessToken && !!projectId,
    staleTime: 5 * 60_000, // 5 min — config changes rarely
  });

  const updateMutation = useMutation({
    mutationFn: (config: LLMConfigUpdate) =>
      llmApi.updateConfig(projectId, config, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm-config", projectId] });
      queryClient.invalidateQueries({ queryKey: ["llm-status", projectId] });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (byoKey?: string) =>
      llmApi.testConnection(projectId, accessToken!, byoKey),
  });

  return {
    config: configQuery.data as LLMConfigResponse | undefined,
    isLoading: configQuery.isLoading,
    error: configQuery.error,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    testConnection: testConnectionMutation.mutateAsync,
    isTesting: testConnectionMutation.isPending,
    testResult: testConnectionMutation.data,
  };
}
