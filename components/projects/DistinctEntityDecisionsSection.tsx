"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RotateCcw, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/lib/context/ToastContext";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  distinctDecisionsApi,
  type DistinctDecision,
} from "@/lib/api/duplicateCheck";
import { getLocalName } from "@/lib/utils";

interface DistinctEntityDecisionsSectionProps {
  projectId: string;
  accessToken?: string;
}

const DECISION_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const decisionsKey = (projectId: string, includeInactive: boolean) =>
  ["distinctEntityDecisions", projectId, includeInactive] as const;

interface DecisionListProps {
  decisions: DistinctDecision[];
  onRevoke: (decision: DistinctDecision) => void;
}

function DecisionList({ decisions, onRevoke }: DecisionListProps) {
  return (
    <div className="space-y-3">
      {decisions.map((decision) => {
        const active = !decision.revoked_at;
        return (
          <article
            key={decision.id}
            className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100" title={decision.iri_a}>
                    {getLocalName(decision.iri_a)}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    is distinct from
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100" title={decision.iri_b}>
                    {getLocalName(decision.iri_b)}
                  </span>
                  <span className={active
                    ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }>
                    {active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {decision.reason}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Marked {DECISION_DATE_FORMAT.format(new Date(decision.marked_at))} by {decision.marked_by}
                  {decision.revoked_at
                    ? ` · Revoked ${DECISION_DATE_FORMAT.format(new Date(decision.revoked_at))}`
                    : ""}
                </p>
              </div>
              {active && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRevoke(decision)}
                  className="shrink-0 gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Revoke
                </Button>
              )}
            </div>
          </article>
        );
      })}
      <p className="text-xs text-slate-500">Showing the 50 most recent decisions.</p>
    </div>
  );
}

export function DistinctEntityDecisionsSection({
  projectId,
  accessToken,
}: DistinctEntityDecisionsSectionProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [decisionToRevoke, setDecisionToRevoke] = useState<DistinctDecision | null>(null);

  const decisionsQuery = useQuery({
    queryKey: decisionsKey(projectId, includeInactive),
    queryFn: () => distinctDecisionsApi.list(projectId, accessToken!, { includeInactive }),
    enabled: !!accessToken,
    retry: false,
  });

  const revokeMutation = useMutation({
    mutationFn: (decision: DistinctDecision) =>
      distinctDecisionsApi.revoke(projectId, decision.id, accessToken!),
    onSuccess: (revoked) => {
      queryClient.setQueryData<DistinctDecision[]>(
        decisionsKey(projectId, false),
        (current) => current?.filter((decision) => decision.id !== revoked.id),
      );
      queryClient.setQueryData<DistinctDecision[]>(
        decisionsKey(projectId, true),
        (current) => current?.map((decision) => decision.id === revoked.id ? revoked : decision),
      );
      toast.success(
        "Distinct decision revoked",
        "The duplicate detector will evaluate this pair again.",
      );
      setDecisionToRevoke(null);
    },
    onError: (mutationError) => {
      toast.error(
        "Could not revoke decision",
        getApiErrorMessage(mutationError, "Try again, or check your project role."),
      );
    },
  });

  let content: ReactNode;
  if (decisionsQuery.isLoading) {
    content = (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading decisions…
      </div>
    );
  } else if (decisionsQuery.isError) {
    content = (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
        <p>{getApiErrorMessage(decisionsQuery.error, "Could not load distinct decisions.")}</p>
        <button type="button" onClick={() => decisionsQuery.refetch()} className="mt-1 font-medium underline">
          Try again
        </button>
      </div>
    );
  } else if (decisionsQuery.data?.length) {
    content = <DecisionList decisions={decisionsQuery.data} onRevoke={setDecisionToRevoke} />;
  } else {
    content = (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-600">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {includeInactive ? "No distinct-entity decisions yet" : "No active distinct-entity decisions"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Editors can create one from a duplicate warning by choosing “Not the same.”
        </p>
      </div>
    );
  }

  return (
    <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Unlink2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Distinct entity decisions
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Review pairs that editors explicitly marked as different concepts. A decision stops
            matching duplicate warnings only while the relevant entity content remains unchanged.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIncludeInactive((current) => !current)}
          className="shrink-0 gap-1.5"
        >
          <History className="h-4 w-4" />
          {includeInactive ? "Active only" : "Show history"}
        </Button>
      </div>

      <div className="mt-5">{content}</div>

      <ConfirmDialog
        open={decisionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !revokeMutation.isPending) setDecisionToRevoke(null);
        }}
        onConfirm={async () => {
          if (decisionToRevoke) await revokeMutation.mutateAsync(decisionToRevoke);
        }}
        title="Revoke distinct decision"
        description="The duplicate detector will evaluate this pair again. The prior decision remains in the audit history."
        confirmLabel="Revoke decision"
        variant="danger"
      />
    </section>
  );
}
