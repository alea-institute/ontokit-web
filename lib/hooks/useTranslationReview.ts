import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { translationsApi, type ProvisionalTranslationRecord } from "@/lib/api/translations";

export const translationReviewKeys = {
  queue: (projectId: string, branch: string) => ["translation-review-queue", projectId, branch] as const,
};

export function useTranslationReview(projectId: string, branch: string, canManage: boolean, accessToken?: string) {
  const queryClient = useQueryClient();
  const queueKey = translationReviewKeys.queue(projectId, branch);
  const queueQuery = useQuery({
    queryKey: [...queueKey, canManage, accessToken ?? null],
    enabled: !!projectId && !!branch && !!accessToken,
    retry: false,
    queryFn: async () => {
      const [languagesResponse, adminQueue] = canManage
        ? await Promise.all([
            translationsApi.getMyReviewerLanguages(projectId, accessToken!),
            translationsApi.listProvisional(projectId, undefined, branch, accessToken!),
          ])
        : [await translationsApi.getMyReviewerLanguages(projectId, accessToken!), null] as const;
      const { languages } = languagesResponse;
      const queues = adminQueue
        ? [adminQueue]
        : await Promise.all(languages.map((language) => translationsApi.listProvisional(projectId, language, branch, accessToken!)));
      const records = [...new Map(queues.flat().map((record) => [record.record_id, record])).values()];
      return { reviewerLanguages: languages, records };
    },
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queueKey });
  const confirmMutation = useMutation({
    mutationFn: (recordId: string) => translationsApi.confirmRecord(projectId, recordId, branch, accessToken!),
    onSuccess: invalidate,
  });
  const rejectMutation = useMutation({
    mutationFn: (recordId: string) => translationsApi.rejectRecord(projectId, recordId, branch, accessToken!),
    onSuccess: invalidate,
  });
  const bulkMutation = useMutation({
    mutationFn: (recordIds: string[]) => translationsApi.confirmBulk(projectId, recordIds, branch, accessToken!),
    onSuccess: invalidate,
  });
  const removeRecords = (recordIds: string[]) => {
    const removed = new Set(recordIds);
    queryClient.setQueriesData<{ reviewerLanguages: string[]; records: ProvisionalTranslationRecord[] }>(
      { queryKey: queueKey },
      (current) => current ? { ...current, records: current.records.filter((record) => !removed.has(record.record_id)) } : current,
    );
  };
  return {
    records: queueQuery.data?.records ?? [],
    reviewerLanguages: queueQuery.data?.reviewerLanguages ?? [],
    isLoading: queueQuery.isLoading,
    error: queueQuery.error,
    confirmRecord: confirmMutation.mutateAsync,
    rejectRecord: rejectMutation.mutateAsync,
    confirmBulk: bulkMutation.mutateAsync,
    removeRecords,
  };
}
