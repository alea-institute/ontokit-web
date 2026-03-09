"use client";

import { useState, useEffect, useRef } from "react";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import type { EntityTreeNode } from "@/lib/ontology/types";

const MAX_MATCHES = 20;

interface UseFilteredTreeOptions {
  searchResults: EntitySearchResult[] | null;
  projectId: string;
  accessToken?: string;
  branch?: string;
}

interface UseFilteredTreeReturn {
  filteredNodes: EntityTreeNode[] | null;
  isBuilding: boolean;
  firstMatchIri: string | null;
  truncated: boolean;
}

/**
 * Build a filtered tree that shows search-matched classes in their ancestor context.
 * Non-class results are excluded (handled separately as flat results).
 */
export function useFilteredTree({
  searchResults,
  projectId,
  accessToken,
  branch,
}: UseFilteredTreeOptions): UseFilteredTreeReturn {
  const [filteredNodes, setFilteredNodes] = useState<EntityTreeNode[] | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [firstMatchIri, setFirstMatchIri] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const buildIdRef = useRef(0);

  useEffect(() => {
    if (!searchResults) {
      ++buildIdRef.current;
      setFilteredNodes(null);
      setIsBuilding(false);
      setFirstMatchIri(null);
      setTruncated(false);
      return;
    }

    const classResults = searchResults.filter((r) => r.entity_type === "class");
    if (classResults.length === 0) {
      ++buildIdRef.current;
      setFilteredNodes(null);
      setIsBuilding(false);
      setFirstMatchIri(null);
      setTruncated(false);
      return;
    }

    const limitedResults = classResults.slice(0, MAX_MATCHES);
    const isTruncated = classResults.length > MAX_MATCHES;
    const buildId = ++buildIdRef.current;

    setIsBuilding(true);

    (async () => {
      try {
        // Fetch ancestors for each class result
        const ancestorPaths = await Promise.all(
          limitedResults.map(async (result) => {
            try {
              const response = await projectOntologyApi.getClassAncestors(
                projectId,
                result.iri,
                accessToken,
                branch,
              );
              return {
                matchIri: result.iri,
                matchLabel: result.label,
                ancestors: response.nodes,
              };
            } catch {
              return {
                matchIri: result.iri,
                matchLabel: result.label,
                ancestors: [],
              };
            }
          }),
        );

        if (buildId !== buildIdRef.current) return;

        // Merge all ancestor paths into a unified tree
        const tree = mergePathsIntoTree(ancestorPaths);

        setFilteredNodes(tree);
        setFirstMatchIri(limitedResults[0]?.iri ?? null);
        setTruncated(isTruncated);
      } catch {
        if (buildId === buildIdRef.current) {
          setFilteredNodes(null);
        }
      } finally {
        if (buildId === buildIdRef.current) {
          setIsBuilding(false);
        }
      }
    })();
  }, [searchResults, projectId, accessToken, branch]);

  return { filteredNodes, isBuilding, firstMatchIri, truncated };
}

export interface AncestorPath {
  matchIri: string;
  matchLabel: string;
  ancestors: Array<{ iri: string; label: string; child_count: number }>;
}

/**
 * Merge multiple ancestor paths into a unified EntityTreeNode tree.
 * Matched nodes get `isSearchMatch: true`, all ancestors are `isExpanded: true`.
 */
export function mergePathsIntoTree(paths: AncestorPath[]): EntityTreeNode[] {
  // nodeMap: iri -> EntityTreeNode
  const nodeMap = new Map<string, EntityTreeNode>();
  // childrenMap: parentIri -> Set<childIri>
  const childrenMap = new Map<string, Set<string>>();
  // rootIris: nodes with no parent in the tree
  const rootIris = new Set<string>();
  // matchIris: the actual search result IRIs
  const matchIris = new Set<string>();

  for (const path of paths) {
    matchIris.add(path.matchIri);

    // Ancestors are ordered root-first (or just ancestor list)
    const fullPath = [
      ...path.ancestors.map((a) => ({ iri: a.iri, label: a.label, hasChildren: a.child_count > 0 })),
      { iri: path.matchIri, label: path.matchLabel, hasChildren: false },
    ];

    for (let i = 0; i < fullPath.length; i++) {
      const item = fullPath[i];

      if (!nodeMap.has(item.iri)) {
        nodeMap.set(item.iri, {
          iri: item.iri,
          label: item.label,
          children: [],
          isExpanded: true,
          isLoading: false,
          hasChildren: item.hasChildren,
          entityType: "class",
          isSearchMatch: matchIris.has(item.iri),
        });
      } else {
        const existing = nodeMap.get(item.iri)!;
        existing.hasChildren = existing.hasChildren || item.hasChildren;
        if (matchIris.has(item.iri)) {
          existing.isSearchMatch = true;
        }
      }

      if (i === 0) {
        rootIris.add(item.iri);
      }

      if (i > 0) {
        const parentIri = fullPath[i - 1].iri;
        if (!childrenMap.has(parentIri)) {
          childrenMap.set(parentIri, new Set());
        }
        childrenMap.get(parentIri)!.add(item.iri);
        // Remove from roots if it has a parent
        rootIris.delete(item.iri);
      }
    }
  }

  // Build the tree from nodeMap + childrenMap
  const buildChildren = (parentIri: string): EntityTreeNode[] => {
    const childIris = childrenMap.get(parentIri);
    if (!childIris) return [];

    return Array.from(childIris).map((childIri) => {
      const node = nodeMap.get(childIri)!;
      return {
        ...node,
        children: buildChildren(childIri),
      };
    });
  };

  return Array.from(rootIris).map((rootIri) => {
    const node = nodeMap.get(rootIri)!;
    return {
      ...node,
      children: buildChildren(rootIri),
    };
  });
}
