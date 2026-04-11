"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphApi, type EntityGraphResponse } from "@/lib/api/graph";

interface UseGraphDataOptions {
  focusIri: string | null;
  projectId: string;
  branch?: string;
  accessToken?: string;
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

function mergeExpansions(
  base: EntityGraphResponse,
  expansions: EntityGraphResponse[],
): EntityGraphResponse {
  if (expansions.length === 0) return base;

  let result = base;
  for (const expansion of expansions) {
    const existingNodeIds = new Set(result.nodes.map((n) => n.id));
    const existingEdgeIds = new Set(result.edges.map((e) => e.id));
    result = {
      ...result,
      nodes: [
        ...result.nodes,
        ...expansion.nodes.filter((n) => !existingNodeIds.has(n.id)),
      ],
      edges: [
        ...result.edges,
        ...expansion.edges.filter((e) => !existingEdgeIds.has(e.id)),
      ],
      truncated: result.truncated || expansion.truncated,
      total_concept_count: Math.max(
        result.total_concept_count,
        expansion.total_concept_count,
      ),
    };
  }
  return result;
}

export function useGraphData({
  focusIri,
  projectId,
  branch,
  accessToken,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [expansions, setExpansions] = useState<EntityGraphResponse[]>([]);
  const [showDescendants, setShowDescendants] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const expandedNodes = useRef(new Set<string>());
  const graphEpoch = useRef(0);
  const expandingNodes = useRef(new Set<string>());

  const query = useQuery({
    queryKey: ["entityGraph", projectId, focusIri, branch, showDescendants, resetKey, !!accessToken],
    queryFn: () =>
      graphApi.getEntityGraph(projectId, focusIri!, {
        branch,
        ancestorsDepth: 5,
        descendantsDepth: showDescendants ? 2 : 0,
      }, accessToken),
    enabled: !!focusIri,
    staleTime: 30_000,
  });

  // Reset expansion tracking when the base query result changes
  useEffect(() => {
    if (query.data) {
      graphEpoch.current++;
      expandedNodes.current = new Set([focusIri!]);
      expandingNodes.current = new Set();
      setExpansions([]);
    }
  }, [query.data, focusIri]);

  // Merge base query data with accumulated expansions
  const graphData = useMemo(() => {
    if (!query.data) return null;
    return mergeExpansions(query.data, expansions);
  }, [query.data, expansions]);

  // Progressive expansion: fetch 1-hop neighborhood and merge
  const expandNode = useCallback(
    (iri: string) => {
      if (!graphData || expandedNodes.current.has(iri) || expandingNodes.current.has(iri)) return;

      const epoch = graphEpoch.current;
      expandingNodes.current.add(iri);

      graphApi
        .getEntityGraph(projectId, iri, {
          branch,
          ancestorsDepth: 1,
          descendantsDepth: showDescendants ? 1 : 0,
          maxNodes: 50,
        }, accessToken)
        .then((newData) => {
          // Drop stale responses from a previous graph context
          if (graphEpoch.current !== epoch || !expandingNodes.current.has(iri)) return;

          expandingNodes.current.delete(iri);
          expandedNodes.current.add(iri);
          setExpansions((prev) => [...prev, newData]);
        })
        .catch(() => {
          expandingNodes.current.delete(iri);
        });
    },
    [graphData, projectId, branch, accessToken, showDescendants],
  );

  const resetGraph = useCallback(() => {
    expandedNodes.current = new Set();
    setExpansions([]);
    setResetKey((k) => k + 1);
  }, []);

  const resolvedCount = useMemo(
    () => graphData?.nodes.length ?? 0,
    [graphData],
  );

  return {
    graphData,
    isLoading: query.isLoading,
    showDescendants,
    setShowDescendants,
    expandNode,
    resetGraph,
    resolvedCount,
  };
}
