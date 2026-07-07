"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { graphApi, type EntityGraphResponse } from "@/lib/api/graph";

interface UseGraphDataOptions {
  focusIri: string | null;
  projectId: string;
  branch?: string;
  /**
   * OIDC access token. Threaded to the graph endpoint (OptionalUser) so private
   * projects authorize; public projects still resolve when it is undefined.
   */
  token?: string;
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
  token,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [graphData, setGraphData] = useState<EntityGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDescendants, setShowDescendants] = useState(false);
  const expandedNodes = useRef(new Set<string>());
  // Bumped every time the focus graph is (re)fetched. In-flight expansions
  // capture the current value and bail on merge if it has changed, so a focus/
  // branch/descendants change can't contaminate the new graph with stale nodes.
  const requestGeneration = useRef(0);

  // Fetch graph from backend BFS endpoint
  useEffect(() => {
    if (!focusIri) {
      setGraphData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    requestGeneration.current += 1;
    expandedNodes.current = new Set([focusIri]);

    graphApi
      .getEntityGraph(
        projectId,
        focusIri,
        {
          branch,
          ancestorsDepth: 5,
          descendantsDepth: showDescendants ? 2 : 0,
        },
        token,
      )
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
  }, [focusIri, projectId, branch, showDescendants, token]);

  // Progressive expansion: fetch 1-hop neighborhood and merge
  const expandNode = useCallback(
    (iri: string) => {
      if (!graphData || expandedNodes.current.has(iri)) return;
      expandedNodes.current.add(iri);
      const generation = requestGeneration.current;

      graphApi
        .getEntityGraph(
          projectId,
          iri,
          {
            branch,
            ancestorsDepth: 1,
            descendantsDepth: 1,
            maxNodes: 50,
          },
          token,
        )
        .then((newData) => {
          // A newer focus/branch/descendants fetch superseded this expansion —
          // discard it rather than merge stale nodes into the current graph.
          if (generation !== requestGeneration.current) return;
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
              // Preserve the backend's discovered-total from the focus fetch;
              // merging 1-hop neighborhoods must not inflate the truncation count.
              total_concept_count: prev.total_concept_count,
            };
          });
        })
        .catch(() => {
          // Silently fail expansion
        });
    },
    [graphData, projectId, branch, token],
  );

  const resetGraph = useCallback(() => {
    expandedNodes.current = new Set();
    setGraphData(null);
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
