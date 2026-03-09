"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import { useSimilarEntities } from "@/lib/hooks/useSimilarEntities";
import { cn, getLocalName } from "@/lib/utils";

const entityTypeBadges: Record<string, { letter: string; className: string }> = {
  class: { letter: "C", className: "bg-owl-class/10 border-owl-class/50 text-owl-class" },
  property: { letter: "P", className: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" },
  individual: { letter: "I", className: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400" },
};

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

interface SimilarConceptsPanelProps {
  projectId: string;
  classIri: string | null;
  accessToken?: string;
  branch?: string;
  onNavigateToClass?: (iri: string) => void;
}

export function SimilarConceptsPanel({
  projectId,
  classIri,
  accessToken,
  branch,
  onNavigateToClass,
}: SimilarConceptsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, error } = useSimilarEntities(
    projectId,
    classIri,
    accessToken,
    branch
  );

  if (!classIri) return null;

  const entities = data ?? [];
  const hasResults = !isLoading && entities.length > 0;
  // Only show "generate embeddings" hint for 404 (no embeddings configured),
  // not for generic network/auth/server errors
  const is404 = error && "status" in error && (error as { status: number }).status === 404;
  const noEmbeddings = is404 && !isLoading;
  const fetchError = error && !is404 && !isLoading;

  if (!isLoading && !hasResults && !noEmbeddings && !fetchError) return null;

  return (
    <div className="flex gap-4">
      <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
        <span className="text-slate-400 dark:text-slate-500">
          <Sparkles className="h-4 w-4" />
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="similar-concepts-panel"
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Similar ({isLoading ? "..." : entities.length})
        </button>
      </div>
      <div id="similar-concepts-panel" className="min-w-0 flex-1">
        {isLoading && (
          <div className="py-1">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        )}
        {isExpanded && noEmbeddings && (
          <p className="py-1 text-xs text-slate-500 dark:text-slate-400">
            Generate embeddings in project settings to see similar concepts.
          </p>
        )}
        {isExpanded && fetchError && (
          <p className="py-1 text-xs text-red-500 dark:text-red-400">
            Failed to load similar concepts.
          </p>
        )}
        {isExpanded && hasResults && (
          <div className="space-y-0.5">
            {entities.map((entity) => {
              const badge =
                entityTypeBadges[entity.entity_type] || entityTypeBadges.class;
              return (
                <button
                  key={entity.iri}
                  onClick={() => onNavigateToClass?.(entity.iri)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm",
                    "text-primary-600 hover:bg-slate-50 hover:text-primary-700",
                    "dark:text-primary-400 dark:hover:bg-slate-800 dark:hover:text-primary-300",
                    entity.deprecated && "opacity-60 line-through"
                  )}
                  title={entity.iri}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      badge.className
                    )}
                  >
                    <span className="text-[8px] font-bold">{badge.letter}</span>
                  </span>
                  <span className="flex-1 truncate">
                    {entity.label || getLocalName(entity.iri)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium tabular-nums",
                      scoreColor(entity.score)
                    )}
                  >
                    {Math.round(entity.score * 100)}%
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
