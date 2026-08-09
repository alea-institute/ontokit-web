import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  translationsApi,
  type TranslationBackfillFilters,
} from "@/lib/api/translations";
import { translationQueryKeys } from "@/lib/hooks/useTranslationConfig";

export function useTranslationCoverage(
  projectId: string,
  branch: string,
  accessToken?: string,
) {
  const queryClient = useQueryClient();
  const coverageKey = translationQueryKeys.coverage(projectId, branch);
  const coverageQuery = useQuery({
    queryKey: [...coverageKey, accessToken ?? null],
    queryFn: () => translationsApi.getCoverage(projectId, branch, accessToken!),
    enabled: !!projectId && !!branch && !!accessToken,
    retry: false,
  });
  const jobQuery = useQuery({
    queryKey: [
      ...translationQueryKeys.backfillStatus(projectId, branch),
      accessToken ?? null,
    ],
    queryFn: () => translationsApi.getBackfillStatus(projectId, branch, accessToken!),
    enabled: !!projectId && !!branch && !!accessToken,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2_000 : false;
    },
  });
  const observedJob = useRef<{
    jobId: string;
    completed: number;
    terminal: boolean;
  } | null>(null);

  useEffect(() => {
    const job = jobQuery.data;
    if (!job) return;

    const terminal = job.status === "completed" || job.status === "failed";
    const previous = observedJob.current;
    const sameJob = previous?.jobId === job.job_id;
    const progressChanged = sameJob && previous.completed !== job.completed;
    const reachedTerminal = terminal && (!sameJob || !previous.terminal);

    observedJob.current = { jobId: job.job_id, completed: job.completed, terminal };
    if (progressChanged || reachedTerminal) {
      void queryClient.invalidateQueries({ queryKey: coverageKey });
    }
  }, [coverageKey, jobQuery.data, queryClient]);
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
    resetPreview: previewMutation.reset,
    launchBackfill: launchMutation.mutateAsync,
    isLaunching: launchMutation.isPending,
    launchError: launchMutation.error,
    resetLaunch: launchMutation.reset,
    job: jobQuery.data,
  };
}
