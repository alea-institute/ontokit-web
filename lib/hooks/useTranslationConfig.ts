import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  translationsApi,
  type TranslationConfigUpdate,
} from "@/lib/api/translations";

export const translationQueryKeys = {
  config: (projectId: string) => ["translation-config", projectId] as const,
  palette: ["translation-palette"] as const,
};

export function useTranslationConfig(projectId: string, accessToken?: string) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: [...translationQueryKeys.config(projectId), accessToken ?? null],
    queryFn: () => translationsApi.getConfig(projectId, accessToken!),
    enabled: !!projectId && !!accessToken,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const paletteQuery = useQuery({
    queryKey: translationQueryKeys.palette,
    queryFn: translationsApi.getPalette,
    enabled: !!projectId && !!accessToken,
    staleTime: 60 * 60_000,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: (config: TranslationConfigUpdate) =>
      translationsApi.updateConfig(projectId, config, accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: translationQueryKeys.config(projectId),
      }),
  });

  return {
    config: configQuery.data,
    palette: paletteQuery.data ?? [],
    isLoading: configQuery.isLoading || paletteQuery.isLoading,
    error: configQuery.error || paletteQuery.error,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}
