"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { qualityApi } from "@/lib/api/quality";
import { getLocalName } from "@/lib/utils";
import type { CrossReferencesResponse, CrossReferenceGroup } from "@/lib/ontology/qualityTypes";

interface DeleteImpactAnalysisProps {
  projectId: string;
  entityIri: string | null;
  accessToken?: string;
  branch?: string;
  onAcknowledge: (acknowledged: boolean) => void;
}

export function DeleteImpactAnalysis({
  projectId,
  entityIri,
  accessToken,
  branch,
  onAcknowledge,
}: DeleteImpactAnalysisProps) {
  const [data, setData] = useState<CrossReferencesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!entityIri || !projectId) {
      setData(null);
      setIsExpanded(false);
      setAcknowledged(false);
      onAcknowledge(false);
      setIsLoading(false);
      setFetchError(false);
      return;
    }
    setIsLoading(true);
    setAcknowledged(false);
    onAcknowledge(false);
    setFetchError(false);
    qualityApi
      .getCrossReferences(projectId, entityIri, accessToken, branch)
      .then(setData)
      .catch(() => setFetchError(true))
      .finally(() => setIsLoading(false));
  }, [entityIri, projectId, accessToken, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        Checking references...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/10">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-800 dark:text-red-300">
            Failed to check references. Proceed with caution.
          </p>
        </div>
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              This entity is referenced by {total} other {total === 1 ? "entity" : "entities"}
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs text-amber-700 hover:underline dark:text-amber-400"
            >
              {isExpanded ? "Hide references" : "Show references"}
            </button>
          </div>
        </div>

        {isExpanded && data && (
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-amber-200 pt-2 dark:border-amber-800">
            {data.groups.map((group: CrossReferenceGroup) =>
              group.references.map((ref) => (
                <div
                  key={`${ref.source_iri}-${ref.reference_context}`}
                  className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300"
                >
                  <span className="truncate">{ref.source_label || getLocalName(ref.source_iri)}</span>
                  <span className="text-amber-600/60 dark:text-amber-400/60">
                    ({group.context_label})
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => {
            setAcknowledged(e.target.checked);
            onAcknowledge(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          I understand this will create dangling references
        </span>
      </label>
    </div>
  );
}
