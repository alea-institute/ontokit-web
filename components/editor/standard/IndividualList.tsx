"use client";

import { useState, useEffect } from "react";
import { cn, getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";

interface IndividualListProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  selectedIri: string | null;
  onSelect: (iri: string) => void;
}

export function IndividualList({
  projectId,
  accessToken,
  branch,
  selectedIri,
  onSelect,
}: IndividualListProps) {
  const [individuals, setIndividuals] = useState<EntitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchIndividuals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await projectOntologyApi.searchEntities(
          projectId,
          "*",
          accessToken,
          branch,
          "individual",
        );

        if (cancelled) return;
        setIndividuals(response.results);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load individuals");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchIndividuals();
    return () => { cancelled = true; };
  }, [projectId, accessToken, branch]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (individuals.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No individuals found in this ontology
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {individuals.map((ind) => (
        <button
          key={ind.iri}
          onClick={() => onSelect(ind.iri)}
          className={cn(
            "flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm",
            selectedIri === ind.iri
              ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
              : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400">
            <span className="text-[9px] font-bold">I</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {ind.label || getLocalName(ind.iri)}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {ind.iri}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
