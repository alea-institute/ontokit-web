import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  translationsApi,
  type OnDemandTranslationPredicate,
} from "@/lib/api/translations";
import { translationQueryKeys } from "@/lib/hooks/useTranslationConfig";

export function useTranslationState(
  projectId: string,
  entityIri: string | null,
  branch: string,
  accessToken?: string,
) {
  const queryClient = useQueryClient();
  const queryKey = translationQueryKeys.entityState(projectId, entityIri, branch);
  const stateQuery = useQuery({
    queryKey: [...queryKey, accessToken ?? null],
    queryFn: () => translationsApi.getEntityState(projectId, entityIri!, branch, accessToken!),
    enabled: !!projectId && !!entityIri && !!accessToken,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => item.state === "pending") ? 2_000 : false,
  });
  const translateMutation = useMutation({
    mutationFn: (predicate: OnDemandTranslationPredicate) =>
      translationsApi.translateField(
        projectId,
        { entity_iri: entityIri!, predicate, branch },
        accessToken!,
      ),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    state: stateQuery.data,
    isLoading: stateQuery.isLoading,
    error: stateQuery.error,
    refetch: stateQuery.refetch,
    translateField: translateMutation.mutateAsync,
    isTranslating: translateMutation.isPending,
    translateError: translateMutation.error,
    resetTranslation: translateMutation.reset,
  };
}
