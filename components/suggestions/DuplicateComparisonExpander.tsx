"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { projectOntologyApi, type OWLClassDetail } from "@/lib/api/client";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

interface DuplicateComparisonExpanderProps {
  proposedLabel: string;
  proposedIri: string;
  candidateIri: string;
  candidateLabel: string;
  candidateScore: number;
  projectId: string;
  accessToken?: string;
  branch?: string;
}

export function DuplicateComparisonExpander({
  proposedLabel,
  proposedIri,
  candidateIri,
  candidateLabel,
  candidateScore,
  projectId,
  accessToken,
  branch,
}: DuplicateComparisonExpanderProps) {
  const [entityDetail, setEntityDetail] = useState<OWLClassDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMoreAnnotations, setShowMoreAnnotations] = useState<Set<number>>(new Set());

  const fetchEntityDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const detail = await projectOntologyApi.getClassDetail(
        projectId,
        candidateIri,
        accessToken,
        branch
      );
      setEntityDetail(detail);
    } catch {
      setError("Failed to load entity details. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIri, projectId, branch]);

  const toggleShowMore = (index: number) => {
    setShowMoreAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Determine if proposed label matches any existing entity label
  const existingLabels = entityDetail?.labels ?? [];
  const proposedLabelLower = proposedLabel.toLowerCase();
  const hasMatchingLabel = existingLabels.some(
    (l) => l.value.toLowerCase() === proposedLabelLower
  );

  // Get preferred English label from existing entity
  const preferredExistingLabel =
    existingLabels.find((l) => l.lang === "en")?.value ??
    existingLabels[0]?.value ??
    candidateLabel;

  return (
    <div
      role="region"
      aria-label={`Comparison: ${proposedLabel} vs ${candidateLabel}`}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900"
    >
      {/* Header row with title and score badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Duplicate comparison
        </span>
        <span
          className={cn(
            "text-[10px] font-medium tabular-nums",
            scoreColor(candidateScore)
          )}
        >
          {Math.round(candidateScore * 100)}% match
        </span>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <span>{error}</span>
          <button
            onClick={fetchEntityDetail}
            className="text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && entityDetail && (
        <div className="max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* Left column: Proposed entity */}
            <div className="min-w-[200px]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Proposed
              </div>
              <div className="space-y-2">
                <div>
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    Label
                  </div>
                  <span
                    className={cn(
                      "text-sm text-slate-800 dark:text-slate-200",
                      hasMatchingLabel && "rounded bg-amber-100 px-1 dark:bg-amber-900/30"
                    )}
                  >
                    {proposedLabel}
                  </span>
                </div>
                <div>
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    IRI
                  </div>
                  <span className="break-all text-xs text-slate-500 dark:text-slate-400">
                    {proposedIri}
                  </span>
                </div>
              </div>
            </div>

            {/* Right column: Existing entity */}
            <div className="min-w-[200px]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Existing
              </div>
              <div className="space-y-2">
                {/* Labels */}
                <div>
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    Labels
                  </div>
                  <div className="space-y-0.5">
                    {existingLabels.length > 0 ? (
                      existingLabels.map((label, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span
                            className={cn(
                              "text-sm text-slate-800 dark:text-slate-200",
                              label.value.toLowerCase() === proposedLabelLower &&
                                "rounded bg-amber-100 px-1 dark:bg-amber-900/30"
                            )}
                          >
                            {label.value}
                          </span>
                          {label.lang && (
                            <span className="text-[10px] text-slate-400">
                              [{label.lang}]
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        {preferredExistingLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comments */}
                {entityDetail.comments.length > 0 && (
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Comments
                    </div>
                    <div className="space-y-0.5">
                      {entityDetail.comments.map((comment, i) => (
                        <p
                          key={i}
                          className="text-xs text-slate-600 dark:text-slate-400"
                        >
                          {comment.value}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parent classes */}
                {Object.keys(entityDetail.parent_labels).length > 0 && (
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Parents
                    </div>
                    <div className="space-y-0.5">
                      {Object.entries(entityDetail.parent_labels).map(
                        ([iri, label]) => (
                          <span
                            key={iri}
                            className="block text-xs text-slate-600 dark:text-slate-400"
                            title={iri}
                          >
                            {label}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Annotations */}
                {entityDetail.annotations.length > 0 && (
                  <div>
                    <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Annotations ({entityDetail.annotations.length})
                    </div>
                    <div className="space-y-1">
                      {entityDetail.annotations.slice(0, 3).map((annotation, i) => {
                        const firstValue = annotation.values[0]?.value ?? "";
                        return (
                          <div key={i} className="text-xs">
                            <span className="text-slate-400">{annotation.property_label ?? annotation.property_iri}:</span>{" "}
                            <span
                              className={cn(
                                "text-slate-600 dark:text-slate-400",
                                !showMoreAnnotations.has(i) && "line-clamp-3"
                              )}
                            >
                              {firstValue}
                            </span>
                            {firstValue.length > 150 && (
                              <button
                                onClick={() => toggleShowMore(i)}
                                className="ml-1 text-primary-600 hover:underline dark:text-primary-400"
                              >
                                {showMoreAnnotations.has(i) ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
