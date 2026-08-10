import { useEffect, useState } from "react";
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
  const pollingIdentity = `${projectId}\u0000${entityIri ?? ""}\u0000${branch}\u0000${accessToken ?? ""}`;
  const [outstanding, setOutstanding] = useState<{ predicate: OnDemandTranslationPredicate; startedAt: number; identity: string } | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [timedOutIdentity, setTimedOutIdentity] = useState<string | null>(null);
  const activeOutstanding = outstanding?.identity === pollingIdentity ? outstanding : null;
  const queryClient = useQueryClient();
  const queryKey = translationQueryKeys.entityState(projectId, entityIri, branch);
  const stateQuery = useQuery({
    queryKey: [...queryKey, accessToken ?? null],
    queryFn: async () => {
      const response = await translationsApi.getEntityState(projectId, entityIri!, branch, accessToken!);
      if (activeOutstanding && response.items.some((item) =>
        item.predicate === activeOutstanding.predicate && item.value !== null &&
        (item.state === "provisional" || item.state === "verified"))) {
        setOutstanding(null);
      }
      return response;
    },
    enabled: !!projectId && !!entityIri && !!accessToken,
    retry: false,
    refetchInterval: (query) =>
      timedOutIdentity !== pollingIdentity &&
      ((activeOutstanding && !query.state.error) || query.state.data?.items.some((item) => item.state === "pending")) ? 2_000 : false,
  });
  const translateMutation = useMutation({
    mutationFn: (predicate: OnDemandTranslationPredicate) =>
      translationsApi.translateField(
        projectId,
        { entity_iri: entityIri!, predicate, branch },
        accessToken!,
      ),
    retry: false,
    onSuccess: async (_response, predicate) => {
      setOutstanding({ predicate, startedAt: Date.now(), identity: pollingIdentity });
      setTimedOutIdentity(null);
      setPendingNotice(null);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const translationArrived = activeOutstanding ? stateQuery.data?.items.some((item) =>
    item.predicate === activeOutstanding.predicate && item.value !== null &&
    (item.state === "provisional" || item.state === "verified")) : false;
  const pollingOutstanding = activeOutstanding && !translationArrived && !stateQuery.error ? activeOutstanding : null;

  useEffect(() => {
    if (!pollingOutstanding) return;
    const remaining = Math.max(0, 5 * 60_000 - (Date.now() - pollingOutstanding.startedAt));
    const timer = window.setTimeout(() => {
      setOutstanding(null);
      setTimedOutIdentity(pollingIdentity);
      setPendingNotice("Translation is taking longer than expected. You can retry.");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [pollingIdentity, pollingOutstanding]);

  return {
    state: stateQuery.data,
    isLoading: stateQuery.isLoading,
    error: stateQuery.error,
    refetch: stateQuery.refetch,
    translateField: translateMutation.mutateAsync,
    isTranslating: translateMutation.isPending,
    translateError: translateMutation.error,
    isTranslationPending: !!pollingOutstanding,
    pendingNotice: stateQuery.error && activeOutstanding
      ? "Translation status could not be checked. Retry the translation."
      : timedOutIdentity === pollingIdentity ? pendingNotice : null,
    resetTranslation: () => { translateMutation.reset(); setOutstanding(null); setTimedOutIdentity(null); setPendingNotice(null); },
  };
}
