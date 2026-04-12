"use client";

import { useState, useCallback, useLayoutEffect, useMemo, useRef } from "react";
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
  showAllDescendants: boolean;
  setShowAllDescendants: (v: boolean) => void;
  expandNode: (iri: string) => void;
  resetGraph: () => void;
  resolvedCount: number;
}

function mergeExpansions(
  base: EntityGraphResponse,
  expansions: EntityGraphResponse[],
): EntityGraphResponse {
  if (expansions.length === 0) return base;

  const nodeIds = new Set(base.nodes.map((n) => n.id));
  const edgeIds = new Set(base.edges.map((e) => e.id));
  const mergedNodes = [...base.nodes];
  const mergedEdges = [...base.edges];
  let truncated = base.truncated;
  let totalConceptCount = base.total_concept_count;

  for (const expansion of expansions) {
    for (const node of expansion.nodes) {
      if (!nodeIds.has(node.id)) {
        nodeIds.add(node.id);
        mergedNodes.push(node);
      }
    }
    for (const edge of expansion.edges) {
      if (!edgeIds.has(edge.id)) {
        edgeIds.add(edge.id);
        mergedEdges.push(edge);
      }
    }
    truncated = truncated || expansion.truncated;
    totalConceptCount = Math.max(totalConceptCount, expansion.total_concept_count);
  }

  return {
    ...base,
    nodes: mergedNodes,
    edges: mergedEdges,
    truncated,
    total_concept_count: totalConceptCount,
  };
}

export function useGraphData({
  focusIri,
  projectId,
  branch,
  accessToken,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [expansions, setExpansions] = useState<EntityGraphResponse[]>([]);
  const [showAllDescendants, setShowAllDescendants] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const expandedNodes = useRef(new Set<string>());
  const graphEpoch = useRef(0);
  const expandingNodes = useRef(new Set<string>());

  const query = useQuery({
    queryKey: ["entityGraph", projectId, focusIri, branch, showAllDescendants, resetKey, !!accessToken],
    queryFn: () =>
      graphApi.getEntityGraph(projectId, focusIri!, {
        branch,
        ancestorsDepth: 5,
        descendantsDepth: showAllDescendants ? 2 : 1,
      }, accessToken),
    enabled: !!focusIri && !!accessToken,
    staleTime: 30_000,
  });

  // Reset expansion tracking synchronously in the commit phase so stale
  // expandNode() promise callbacks cannot pass the epoch guard before the reset.
  useLayoutEffect(() => {
    graphEpoch.current++;
    expandedNodes.current = focusIri ? new Set([focusIri]) : new Set();
    expandingNodes.current = new Set();
    setExpansions([]);
  }, [projectId, focusIri, branch, showAllDescendants, resetKey]);

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
          descendantsDepth: 1,
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
    [graphData, projectId, branch, accessToken],
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
    showAllDescendants,
    setShowAllDescendants,
    expandNode,
    resetGraph,
    resolvedCount,
  };
}
