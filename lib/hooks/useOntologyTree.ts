"use client";

import { useState, useCallback, useEffect } from "react";
import { projectOntologyApi, type OWLClassTreeNode as ApiTreeNode } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";

interface UseOntologyTreeOptions {
  projectId: string;
  accessToken?: string;
}

interface UseOntologyTreeReturn {
  nodes: ClassTreeNode[];
  totalClasses: number;
  isLoading: boolean;
  error: string | null;
  selectedIri: string | null;
  loadRootClasses: () => Promise<void>;
  expandNode: (iri: string) => Promise<void>;
  collapseNode: (iri: string) => void;
  selectNode: (iri: string) => void;
}

/**
 * Convert API tree node to internal tree node format
 */
function apiNodeToTreeNode(apiNode: ApiTreeNode): ClassTreeNode {
  return {
    iri: apiNode.iri,
    label: apiNode.label,
    children: [],
    isExpanded: false,
    isLoading: false,
    hasChildren: apiNode.child_count > 0,
  };
}

/**
 * Update a node in the tree (recursive)
 */
function updateNodeInTree(
  nodes: ClassTreeNode[],
  iri: string,
  updater: (node: ClassTreeNode) => ClassTreeNode
): ClassTreeNode[] {
  return nodes.map((node) => {
    if (node.iri === iri) {
      return updater(node);
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, iri, updater),
      };
    }
    return node;
  });
}

/**
 * Hook for managing ontology tree state with lazy-loading
 */
export function useOntologyTree({
  projectId,
  accessToken,
}: UseOntologyTreeOptions): UseOntologyTreeReturn {
  const [nodes, setNodes] = useState<ClassTreeNode[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIri, setSelectedIri] = useState<string | null>(null);

  /**
   * Load root classes
   */
  const loadRootClasses = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await projectOntologyApi.getRootClasses(projectId, accessToken);
      setNodes(response.nodes.map(apiNodeToTreeNode));
      setTotalClasses(response.total_classes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ontology tree";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken]);

  /**
   * Expand a node and load its children
   */
  const expandNode = useCallback(
    async (iri: string) => {
      // Mark node as loading
      setNodes((prev) =>
        updateNodeInTree(prev, iri, (node) => ({
          ...node,
          isLoading: true,
        }))
      );

      try {
        const response = await projectOntologyApi.getClassChildren(projectId, iri, accessToken);
        const children = response.nodes.map(apiNodeToTreeNode);

        // Update node with children
        setNodes((prev) =>
          updateNodeInTree(prev, iri, (node) => ({
            ...node,
            children,
            isExpanded: true,
            isLoading: false,
          }))
        );
      } catch (err) {
        // Mark as not loading on error
        setNodes((prev) =>
          updateNodeInTree(prev, iri, (node) => ({
            ...node,
            isLoading: false,
          }))
        );
        console.error("Failed to expand node:", err);
      }
    },
    [projectId, accessToken]
  );

  /**
   * Collapse a node
   */
  const collapseNode = useCallback((iri: string) => {
    setNodes((prev) =>
      updateNodeInTree(prev, iri, (node) => ({
        ...node,
        isExpanded: false,
      }))
    );
  }, []);

  /**
   * Select a node
   */
  const selectNode = useCallback((iri: string) => {
    setSelectedIri(iri);
  }, []);

  // Load root classes on mount
  useEffect(() => {
    loadRootClasses();
  }, [loadRootClasses]);

  return {
    nodes,
    totalClasses,
    isLoading,
    error,
    selectedIri,
    loadRootClasses,
    expandNode,
    collapseNode,
    selectNode,
  };
}
