"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { projectOntologyApi, type OWLClassDetail } from "@/lib/api/client";
import { buildGraphFromClassDetail, getSeeAlsoIris } from "@/lib/graph/buildGraphData";
import { getLocalName } from "@/lib/utils";
import type { GraphData } from "@/lib/graph/types";

const MAX_RESOLVED_NODES = 100;

interface UseGraphDataOptions {
  focusIri: string | null;
  projectId: string;
  accessToken?: string;
  branch?: string;
  initialDepth?: number;
  labelHints?: Map<string, string>;
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
  labelHints,
}: UseGraphDataOptions): UseGraphDataReturn {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const resolvedNodesRef = useRef<Map<string, OWLClassDetail>>(new Map());
  // IRIs that failed getClassDetail (non-class entities) — don't retry
  const failedIrisRef = useRef<Set<string>>(new Set());
  // Labels + entity types discovered for non-class entities via search API
  const nonClassLabelsRef = useRef<Map<string, { label: string; entityType: string }>>(new Map());
  const [resolvedCount, setResolvedCount] = useState(0);

  const fetchDetail = useCallback(
    async (iri: string): Promise<OWLClassDetail | null> => {
      if (resolvedNodesRef.current.has(iri)) {
        return resolvedNodesRef.current.get(iri)!;
      }
      if (failedIrisRef.current.has(iri)) return null;
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
        failedIrisRef.current.add(iri);
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
          !failedIrisRef.current.has(iri) &&
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
          for (const seeAlsoIri of getSeeAlsoIris(detail)) {
            if (!resolvedNodesRef.current.has(seeAlsoIri)) {
              newNeighborIris.push(seeAlsoIri);
            }
          }
        }
      }
      return [...new Set(newNeighborIris)];
    },
    [fetchDetail],
  );

  /**
   * Resolve full ancestry for all currently resolved class nodes.
   * Calls the ancestors endpoint for each class, adds missing ancestor nodes.
   */
  const resolveAncestry = useCallback(async () => {
    const classIris = [...resolvedNodesRef.current.keys()];
    const MAX_ANCESTOR_CALLS = 50;
    let callCount = 0;

    // Collect all ancestor IRIs we need to resolve
    const ancestorIrisToResolve = new Set<string>();

    await Promise.allSettled(
      classIris.map(async (iri) => {
        if (callCount >= MAX_ANCESTOR_CALLS) return;
        callCount++;
        try {
          const response = await projectOntologyApi.getClassAncestors(
            projectId,
            iri,
            accessToken,
            branch,
          );
          for (const node of response.nodes) {
            if (!resolvedNodesRef.current.has(node.iri) && !failedIrisRef.current.has(node.iri)) {
              ancestorIrisToResolve.add(node.iri);
            }
          }
        } catch {
          // Ancestors endpoint failed — skip this node
        }
      }),
    );

    // Fetch full details for discovered ancestors
    if (ancestorIrisToResolve.size > 0) {
      await Promise.allSettled(
        [...ancestorIrisToResolve].map((iri) => fetchDetail(iri)),
      );
    }
  }, [projectId, accessToken, branch, fetchDetail]);

  /** Collect all IRIs referenced by resolved nodes that are still unresolved. */
  const getUnresolvedReferenced = useCallback((): string[] => {
    const referenced = new Set<string>();
    for (const detail of resolvedNodesRef.current.values()) {
      for (const iri of detail.parent_iris) referenced.add(iri);
      for (const iri of detail.equivalent_iris) referenced.add(iri);
      for (const iri of detail.disjoint_iris) referenced.add(iri);
      for (const iri of getSeeAlsoIris(detail)) referenced.add(iri);
    }
    return [...referenced].filter(
      (iri) => !resolvedNodesRef.current.has(iri) && !failedIrisRef.current.has(iri),
    );
  }, []);

  /**
   * Resolve labels for non-class entities (individuals, properties) via search API.
   * Searches by each IRI's local name and matches by exact IRI in results.
   */
  const resolveNonClassLabels = useCallback(async () => {
    const needLabels = [...failedIrisRef.current].filter(
      (iri) => !nonClassLabelsRef.current.has(iri),
    );
    if (needLabels.length === 0) return;

    await Promise.allSettled(
      needLabels.map(async (iri) => {
        try {
          const localName = getLocalName(iri);
          const response = await projectOntologyApi.searchEntities(
            projectId,
            localName,
            accessToken,
            branch,
          );
          const match = response.results.find((r) => r.iri === iri);
          if (match) {
            nonClassLabelsRef.current.set(iri, {
              label: match.label || getLocalName(iri),
              entityType: match.entity_type,
            });
          }
        } catch {
          // Search failed for this IRI — label will fall back to getLocalName
        }
      }),
    );
  }, [projectId, accessToken, branch]);

  const buildGraph = useCallback(
    (focus: string) => {
      // Merge all label sources: caller hints + non-class entity labels
      let mergedHints = labelHints;
      let entityTypes: Map<string, string> | undefined;
      if (nonClassLabelsRef.current.size > 0) {
        mergedHints = new Map(labelHints);
        entityTypes = new Map();
        for (const [iri, info] of nonClassLabelsRef.current) {
          if (!mergedHints.has(iri)) mergedHints.set(iri, info.label);
          entityTypes.set(iri, info.entityType);
        }
      }
      const data = buildGraphFromClassDetail(focus, resolvedNodesRef.current, mergedHints, entityTypes);
      setGraphData(data);
      setResolvedCount(resolvedNodesRef.current.size);
    },
    [labelHints],
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
      failedIrisRef.current = new Set();
      nonClassLabelsRef.current = new Map();

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

        // Depth 1: immediate neighbors (including seeAlso/isDefinedBy targets)
        const depth1Iris = [
          ...focusDetail.parent_iris,
          ...focusDetail.equivalent_iris,
          ...focusDetail.disjoint_iris,
          ...getSeeAlsoIris(focusDetail),
        ];
        const depth2Candidates = await fetchNeighbors(depth1Iris);
        if (cancelled) return;

        // Depth 2: neighbors of neighbors (if initialDepth >= 2)
        if (initialDepth >= 2 && depth2Candidates.length > 0) {
          await fetchNeighbors(depth2Candidates);
          if (cancelled) return;
        }

        // Label resolution pass: fetch details for any remaining unresolved
        // relationship targets so graph nodes show labels instead of opaque IDs
        const unresolved = getUnresolvedReferenced();
        if (unresolved.length > 0) {
          await Promise.allSettled(unresolved.map((iri) => fetchDetail(iri)));
          if (cancelled) return;
        }

        // Ancestry resolution: trace all displayed classes back to root
        await resolveAncestry();
        if (cancelled) return;

        // Resolve labels for non-class entities (individuals/properties)
        if (failedIrisRef.current.size > 0) {
          await resolveNonClassLabels();
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
  }, [focusIri, accessToken, branch, fetchDetail, fetchNeighbors, getUnresolvedReferenced, resolveAncestry, resolveNonClassLabels, buildGraph, initialDepth]);

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
            ...getSeeAlsoIris(detail),
          ];
          await fetchNeighbors(neighborIris);

          // Label resolution pass for newly discovered relationship targets
          const unresolved = getUnresolvedReferenced();
          if (unresolved.length > 0) {
            await Promise.allSettled(unresolved.map((i) => fetchDetail(i)));
          }

          // Ancestry resolution for newly discovered nodes
          await resolveAncestry();

          // Resolve labels for non-class entities
          if (failedIrisRef.current.size > 0) {
            await resolveNonClassLabels();
          }
        }

        buildGraph(focusIri);
      } finally {
        setIsLoading(false);
      }
    },
    [focusIri, fetchDetail, fetchNeighbors, getUnresolvedReferenced, resolveAncestry, resolveNonClassLabels, buildGraph],
  );

  const resetGraph = useCallback(() => {
    resolvedNodesRef.current = new Map();
    failedIrisRef.current = new Set();
    nonClassLabelsRef.current = new Map();
    setGraphData(null);
    setResolvedCount(0);
  }, []);

  return { graphData, isLoading, expandNode, resetGraph, resolvedCount };
}
