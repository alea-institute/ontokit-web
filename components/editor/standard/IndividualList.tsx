"use client";

import { useState, useEffect, useMemo } from "react";
import { getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import { EntityTree } from "@/components/editor/shared/EntityTree";
import type { EntityTreeNode } from "@/lib/ontology/types";

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

  // Convert individuals to EntityTreeNode[] (flat list)
  const entityNodes = useMemo((): EntityTreeNode[] => {
    return individuals.map((ind) => ({
      iri: ind.iri,
      label: ind.label || getLocalName(ind.iri),
      children: [],
      isExpanded: false,
      isLoading: false,
      hasChildren: false,
      entityType: "individual" as const,
      deprecated: ind.deprecated,
    }));
  }, [individuals]);

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
    <EntityTree
      nodes={entityNodes}
      selectedIri={selectedIri}
      onSelect={onSelect}
      onExpand={() => {}}
      onCollapse={() => {}}
    />
  );
}
