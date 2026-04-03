"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Link } from "lucide-react";
import { useCrossReferences } from "@/lib/hooks/useCrossReferences";
import { cn, getLocalName } from "@/lib/utils";
import type { CrossReferenceGroup, ReferenceContext } from "@/lib/ontology/qualityTypes";

const CONTEXT_LABELS: Record<ReferenceContext, string> = {
  parent_iris: "As parent class",
  domain_iris: "As domain",
  range_iris: "As range",
  type_iris: "As type",
  equivalent_iris: "As equivalent class",
  disjoint_iris: "As disjoint class",
  some_values_from: "In restriction",
  annotation_value: "In annotation",
  see_also: "As see also",
  inverse_of: "As inverse property",
};

const entityTypeBadges: Record<string, { letter: string; className: string }> = {
  class: { letter: "C", className: "bg-owl-class/10 border-owl-class/50 text-owl-class" },
  property: { letter: "P", className: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" },
  individual: { letter: "I", className: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400" },
};

interface CrossReferencesPanelProps {
  projectId: string;
  entityIri: string | null;
  accessToken?: string;
  branch?: string;
  onNavigateToClass?: (iri: string) => void;
}

export function CrossReferencesPanel({
  projectId,
  entityIri,
  accessToken,
  branch,
  onNavigateToClass,
}: CrossReferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = useCrossReferences(
    projectId,
    entityIri,
    accessToken,
    branch
  );

  if (!entityIri) return null;

  const total = data?.total ?? 0;

  if (!isLoading && total === 0) return null;

  return (
    <div className="flex gap-4">
      <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
        <span className="text-slate-400 dark:text-slate-500">
          <Link className="h-4 w-4" />
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Used By ({isLoading ? "..." : total})
        </button>
      </div>
      <div className="min-w-0 flex-1">
        {isLoading && (
          <div className="py-1">
            <div className="h-4 w-24 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
          </div>
        )}
        {isExpanded && data && (
          <div className="space-y-2">
            {data.groups.map((group: CrossReferenceGroup) => (
              <ReferenceGroup
                key={group.context}
                group={group}
                onNavigate={onNavigateToClass}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceGroup({
  group,
  onNavigate,
}: {
  group: CrossReferenceGroup;
  onNavigate?: (iri: string) => void;
}) {
  const label = CONTEXT_LABELS[group.context] || group.context_label;

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label} ({group.references.length})
      </p>
      <div className="mt-1 space-y-0.5">
        {group.references.map((ref) => {
          const badge = entityTypeBadges[ref.source_type] || entityTypeBadges.class;
          return (
            <button
              key={`${ref.source_iri}-${ref.reference_context}`}
              onClick={() => onNavigate?.(ref.source_iri)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm",
                "text-primary-600 hover:bg-slate-50 hover:text-primary-700",
                "dark:text-primary-400 dark:hover:bg-slate-800 dark:hover:text-primary-300"
              )}
              title={ref.source_iri}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  badge.className
                )}
              >
                <span className="text-[8px] font-bold">{badge.letter}</span>
              </span>
              <span className="truncate">
                {ref.source_label || getLocalName(ref.source_iri)}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
