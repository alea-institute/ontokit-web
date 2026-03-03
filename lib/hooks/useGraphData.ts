"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { projectOntologyApi, type OWLClassDetail } from "@/lib/api/client";
import { buildGraphFromClassDetail } from "@/lib/graph/buildGraphData";
import type { GraphData } from "@/lib/graph/types";

const MAX_RESOLVED_NODES = 100;

interface UseGraphDataOptions {
  focusIri: string | null;
  projectId: string;
  accessToken?: string;
  branch?: string;
  initialDepth?: number;
}

interface UseGraphDataReturn {
  graphData: GraphData | null;
  isLoading: boolean;
  expandNode: (iri: string) => void;
  resetGraph: () => void;
  resolvedCount: number;
}

export function useGraphData({
  focusIri,
  projectId,
  accessToken,
  branch,
  initialDepth = 2,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const resolvedNodesRef = useRef<Map<string, OWLClassDetail>>(new Map());
  const [resolvedCount, setResolvedCount] = useState(0);

  const fetchDetail = useCallback(
    async (iri: string): Promise<OWLClassDetail | null> => {
      if (resolvedNodesRef.current.has(iri)) {
        return resolvedNodesRef.current.get(iri)!;
      }
      if (resolvedNodesRef.current.size >= MAX_RESOLVED_NODES) return null;
      try {
        const detail = await projectOntologyApi.getClassDetail(
          projectId,
          iri,
          accessToken,
          branch,
        );
        resolvedNodesRef.current.set(iri, detail);
        return detail;
      } catch {
        return null;
      }
    },
    [projectId, accessToken, branch],
  );

  const fetchNeighbors = useCallback(
    async (iris: string[]): Promise<string[]> => {
      const unresolved = iris.filter(
        (iri) =>
          !resolvedNodesRef.current.has(iri) &&
          resolvedNodesRef.current.size < MAX_RESOLVED_NODES,
      );
      if (unresolved.length === 0) return [];

      const results = await Promise.allSettled(
        unresolved.map((iri) => fetchDetail(iri)),
      );

      const newNeighborIris: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          const detail = result.value;
          for (const parentIri of detail.parent_iris) {
            if (!resolvedNodesRef.current.has(parentIri)) {
              newNeighborIris.push(parentIri);
            }
          }
          for (const eqIri of detail.equivalent_iris) {
            if (!resolvedNodesRef.current.has(eqIri)) {
              newNeighborIris.push(eqIri);
            }
          }
          for (const djIri of detail.disjoint_iris) {
            if (!resolvedNodesRef.current.has(djIri)) {
              newNeighborIris.push(djIri);
            }
          }
        }
      }
      return [...new Set(newNeighborIris)];
    },
    [fetchDetail],
  );

  const buildGraph = useCallback(
    (focus: string) => {
      const data = buildGraphFromClassDetail(focus, resolvedNodesRef.current);
      setGraphData(data);
      setResolvedCount(resolvedNodesRef.current.size);
    },
    [],
  );

  // Initial load when focus changes
  useEffect(() => {
    if (!focusIri || !accessToken) {
      setGraphData(null);
      return;
    }

    let cancelled = false;

    async function loadGraph() {
      setIsLoading(true);
      resolvedNodesRef.current = new Map();

      try {
        // Depth 0: focus node
        const focusDetail = await fetchDetail(focusIri!);
        if (cancelled || !focusDetail) {
          if (!cancelled) {
            // Even without detail, show a single-node graph
            buildGraph(focusIri!);
          }
          return;
        }

        // Depth 1: immediate neighbors
        const depth1Iris = [
          ...focusDetail.parent_iris,
          ...focusDetail.equivalent_iris,
          ...focusDetail.disjoint_iris,
        ];
        const depth2Candidates = await fetchNeighbors(depth1Iris);
        if (cancelled) return;

        // Depth 2: neighbors of neighbors (if initialDepth >= 2)
        if (initialDepth >= 2 && depth2Candidates.length > 0) {
          await fetchNeighbors(depth2Candidates);
          if (cancelled) return;
        }

        buildGraph(focusIri!);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [focusIri, accessToken, branch, fetchDetail, fetchNeighbors, buildGraph, initialDepth]);

  const expandNode = useCallback(
    async (iri: string) => {
      if (!focusIri) return;
      setIsLoading(true);

      try {
        const detail = await fetchDetail(iri);
        if (detail) {
          const neighborIris = [
            ...detail.parent_iris,
            ...detail.equivalent_iris,
            ...detail.disjoint_iris,
          ];
          await fetchNeighbors(neighborIris);
        }

        buildGraph(focusIri);
      } finally {
        setIsLoading(false);
      }
    },
    [focusIri, fetchDetail, fetchNeighbors, buildGraph],
  );

  const resetGraph = useCallback(() => {
    resolvedNodesRef.current = new Map();
    setGraphData(null);
    setResolvedCount(0);
  }, []);

  return { graphData, isLoading, expandNode, resetGraph, resolvedCount };
}
