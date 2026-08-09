import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  translationsApi,
  type TranslationBackfillFilters,
} from "@/lib/api/translations";

export const translationCoverageQueryKey = (projectId: string, branch: string) =>
  ["translation-coverage", projectId, branch] as const;

export function useTranslationCoverage(
  projectId: string,
  branch: string,
  accessToken?: string,
) {
  const queryClient = useQueryClient();
  const coverageKey = translationCoverageQueryKey(projectId, branch);
  const coverageQuery = useQuery({
    queryKey: [...coverageKey, accessToken ?? null],
    queryFn: () => translationsApi.getCoverage(projectId, branch, accessToken!),
    enabled: !!projectId && !!branch && !!accessToken,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.languages.some((language) => language.pending > 0) ? 2_000 : false,
  });
  const jobQuery = useQuery({
    queryKey: ["translation-backfill-status", projectId, branch, accessToken ?? null],
    queryFn: () => translationsApi.getBackfillStatus(projectId, branch, accessToken!),
    enabled: !!projectId && !!branch && !!accessToken,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2_000 : false;
    },
  });
  const previewMutation = useMutation({
    mutationFn: (filters: TranslationBackfillFilters) =>
      translationsApi.previewBackfill(projectId, filters, accessToken!),
    retry: false,
  });
  const launchMutation = useMutation({
    mutationFn: (filters: TranslationBackfillFilters) =>
      translationsApi.launchBackfill(projectId, filters, accessToken!),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        jobQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: coverageKey }),
      ]);
    },
  });

  return {
    coverage: coverageQuery.data,
    isLoading: coverageQuery.isLoading,
    error: coverageQuery.error,
    previewBackfill: previewMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    previewError: previewMutation.error,
    launchBackfill: launchMutation.mutateAsync,
    isLaunching: launchMutation.isPending,
    launchError: launchMutation.error,
    job: jobQuery.data,
  };
}
