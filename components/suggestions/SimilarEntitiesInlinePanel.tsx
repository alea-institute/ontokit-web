"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DuplicateCandidate } from "@/lib/api/generation";
import { DuplicateComparisonExpander } from "./DuplicateComparisonExpander";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

interface SimilarEntitiesInlinePanelProps {
  entityIri: string;
  entityLabel: string;
  candidates: DuplicateCandidate[];
  projectId: string;
  accessToken?: string;
  branch?: string;
}

export function SimilarEntitiesInlinePanel({
  entityIri,
  entityLabel,
  candidates,
  projectId,
  accessToken,
  branch,
}: SimilarEntitiesInlinePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCandidateIri, setExpandedCandidateIri] = useState<string | null>(null);

  // Filter candidates above the 0.40 threshold per D-04
  const visibleCandidates = candidates.filter((c) => c.score > 0.40);

  // Return null if no candidates meet the threshold — no render
  if (visibleCandidates.length === 0) return null;

  const panelId = `similar-entities-${entityIri}`;

  return (
    <div className="transition-all duration-150 ease-in-out">
      {/* Collapsible trigger — matches SimilarConceptsPanel pattern exactly */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Similar existing entities ({visibleCandidates.length})
      </button>

      {/* Expanded candidate list */}
      {isExpanded && (
        <div id={panelId} className="mt-1.5 space-y-1">
          {visibleCandidates.map((candidate) => (
            <div key={candidate.iri}>
              {/* Candidate row */}
              <button
                onClick={() =>
                  setExpandedCandidateIri((prev) =>
                    prev === candidate.iri ? null : candidate.iri
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-xs",
                  "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  expandedCandidateIri === candidate.iri &&
                    "bg-slate-100 dark:bg-slate-800"
                )}
              >
                <span className="truncate">{candidate.label}</span>
                <span
                  className={cn(
                    "ml-2 shrink-0 text-[10px] font-medium tabular-nums",
                    scoreColor(candidate.score)
                  )}
                >
                  {Math.round(candidate.score * 100)}%
                </span>
              </button>

              {/* Inline comparison expander — accordion: only one open at a time */}
              {expandedCandidateIri === candidate.iri && (
                <div className="mt-1.5 px-1">
                  <DuplicateComparisonExpander
                    proposedLabel={entityLabel}
                    proposedIri={entityIri}
                    candidateIri={candidate.iri}
                    candidateLabel={candidate.label}
                    candidateScore={candidate.score}
                    projectId={projectId}
                    accessToken={accessToken}
                    branch={branch}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
