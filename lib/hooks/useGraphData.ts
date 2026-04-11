"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { graphApi, type EntityGraphResponse } from "@/lib/api/graph";

interface UseGraphDataOptions {
  focusIri: string | null;
  projectId: string;
  branch?: string;
}

interface UseGraphDataReturn {
  graphData: EntityGraphResponse | null;
  isLoading: boolean;
  showDescendants: boolean;
  setShowDescendants: (v: boolean) => void;
  expandNode: (iri: string) => void;
  resetGraph: () => void;
  resolvedCount: number;
}

export function useGraphData({
  focusIri,
  projectId,
  branch,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [graphData, setGraphData] = useState<EntityGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDescendants, setShowDescendants] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const expandedNodes = useRef(new Set<string>());

  // Fetch graph from backend BFS endpoint
  useEffect(() => {
    if (!focusIri) {
      setGraphData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    expandedNodes.current = new Set([focusIri]);

    graphApi
      .getEntityGraph(projectId, focusIri, {
        branch,
        ancestorsDepth: 5,
        descendantsDepth: showDescendants ? 2 : 0,
      })
      .then((data) => {
        if (!cancelled) setGraphData(data);
      })
      .catch(() => {
        if (!cancelled) setGraphData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [focusIri, projectId, branch, showDescendants, resetKey]);

  // Progressive expansion: fetch 1-hop neighborhood and merge
  const expandNode = useCallback(
    (iri: string) => {
      if (!graphData || expandedNodes.current.has(iri)) return;

      graphApi
        .getEntityGraph(projectId, iri, {
          branch,
          ancestorsDepth: 1,
          descendantsDepth: 1,
          maxNodes: 50,
        })
        .then((newData) => {
          expandedNodes.current.add(iri);
          setGraphData((prev) => {
            if (!prev) return newData;

            const existingNodeIds = new Set(prev.nodes.map((n) => n.id));
            const existingEdgeIds = new Set(prev.edges.map((e) => e.id));

            return {
              ...prev,
              nodes: [
                ...prev.nodes,
                ...newData.nodes.filter((n) => !existingNodeIds.has(n.id)),
              ],
              edges: [
                ...prev.edges,
                ...newData.edges.filter((e) => !existingEdgeIds.has(e.id)),
              ],
              truncated: prev.truncated || newData.truncated,
              total_concept_count:
                Math.max(prev.total_concept_count, newData.total_concept_count),
            };
          });
        })
        .catch(() => {
          // Expansion failed — node stays retryable
        });
    },
    [graphData, projectId, branch],
  );

  const resetGraph = useCallback(() => {
    expandedNodes.current = new Set();
    setGraphData(null);
    setResetKey((k) => k + 1);
  }, []);

  const resolvedCount = useMemo(
    () => graphData?.nodes.length ?? 0,
    [graphData],
  );

  return {
    graphData,
    isLoading,
    showDescendants,
    setShowDescendants,
    expandNode,
    resetGraph,
    resolvedCount,
  };
}
