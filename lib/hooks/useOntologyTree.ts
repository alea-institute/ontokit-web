"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { projectOntologyApi, type OWLClassTreeNode as ApiTreeNode } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";

interface UseOntologyTreeOptions {
  projectId: string;
  accessToken?: string;
  /** When this value changes, the tree reloads from scratch */
  branchKey?: string;
}

interface ReparentSnapshot {
  previousNodes: ClassTreeNode[];
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
  navigateToNode: (iri: string) => Promise<void>;
  /** Optimistically insert a new node into the tree (before the save round-trips to the API) */
  addOptimisticNode: (iri: string, label: string, parentIri?: string) => void;
  /** Optimistically remove a node from the tree by IRI */
  removeOptimisticNode: (iri: string) => void;
  /** Update a node's label in-place without affecting tree expansion state */
  updateNodeLabel: (iri: string, newLabel: string) => void;
  /** Collapse all expanded nodes */
  collapseAll: () => void;
  /** Collapse one level: collapse leaf-expanded nodes (expanded with no expanded children) */
  collapseOneLevel: () => void;
  /** Expand one level deeper (visible unexpanded nodes) */
  expandOneLevel: () => Promise<void>;
  /** Expand all nodes fully (loops until tree is fully expanded) */
  expandAllFully: () => Promise<void>;
  /** Whether any visible node can still be expanded */
  hasExpandableNodes: boolean;
  /** Whether any node is currently expanded */
  hasExpandedNodes: boolean;
  /** Whether expandAllFully is currently running */
  isExpandingAll: boolean;
  /** Optimistically move a node from one parent to another. Returns snapshot for rollback. */
  reparentOptimistic: (iri: string, oldParentIri: string | null, newParentIri: string | null) => ReparentSnapshot;
  /** Rollback a reparent using the snapshot */
  rollbackReparent: (snapshot: ReparentSnapshot) => void;
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
  branchKey,
}: UseOntologyTreeOptions): UseOntologyTreeReturn {
  const [nodes, setNodes] = useState<ClassTreeNode[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIri, setSelectedIri] = useState<string | null>(null);

  // Reset tree state when branch changes
  useEffect(() => {
    setNodes([]);
    setTotalClasses(0);
    setSelectedIri(null);
    setError(null);
  }, [branchKey]);

  /**
   * Load root classes
   */
  const loadRootClasses = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await projectOntologyApi.getRootClasses(projectId, accessToken, branchKey);
      setNodes(response.nodes.map(apiNodeToTreeNode));
      setTotalClasses(response.total_classes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ontology tree";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken, branchKey]);

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
        const response = await projectOntologyApi.getClassChildren(projectId, iri, accessToken, branchKey);
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
    [projectId, accessToken, branchKey]
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

  /**
   * Navigate to a node by expanding its ancestors and selecting it
   */
  const navigateToNode = useCallback(
    async (iri: string) => {
      try {
        // Fetch the ancestor path
        const response = await projectOntologyApi.getClassAncestors(projectId, iri, accessToken, branchKey);
        const ancestorNodes = response.nodes;

        // Expand each ancestor in sequence
        // We always expand to ensure children are loaded, even if already expanded
        for (const ancestor of ancestorNodes) {
          await expandNode(ancestor.iri);
        }

        // Select the target node
        setSelectedIri(iri);
      } catch (err) {
        console.error("Failed to navigate to node:", err);
        // Still try to select the node even if navigation failed
        setSelectedIri(iri);
      }
    },
    [projectId, accessToken, branchKey, expandNode]
  );

  /**
   * Optimistically add a new node to the tree.
   * If parentIri is given, the node is inserted as a child (parent is expanded).
   * Otherwise it is appended to the root list.
   */
  const addOptimisticNode = useCallback(
    (iri: string, label: string, parentIri?: string) => {
      const newNode: ClassTreeNode = {
        iri,
        label,
        children: [],
        isExpanded: false,
        isLoading: false,
        hasChildren: false,
      };

      if (parentIri) {
        // Insert as a child of the parent and expand the parent
        setNodes((prev) =>
          updateNodeInTree(prev, parentIri, (parent) => ({
            ...parent,
            children: [...parent.children, newNode],
            hasChildren: true,
            isExpanded: true,
          }))
        );
      } else {
        // Append to root list
        setNodes((prev) => [...prev, newNode]);
      }

      setTotalClasses((prev) => prev + 1);
      setSelectedIri(iri);
    },
    []
  );

  /**
   * Optimistically remove a node from the tree by IRI.
   * Clears selection if the removed node was selected.
   */
  const removeOptimisticNode = useCallback(
    (iri: string) => {
      const filterNodes = (items: ClassTreeNode[]): ClassTreeNode[] =>
        items
          .filter((node) => node.iri !== iri)
          .map((node) =>
            node.children.length > 0
              ? { ...node, children: filterNodes(node.children) }
              : node
          );

      setNodes((prev) => filterNodes(prev));
      setTotalClasses((prev) => Math.max(0, prev - 1));
      setSelectedIri((prev) => (prev === iri ? null : prev));
    },
    []
  );

  /**
   * Update a node's label in-place without affecting tree expansion state.
   */
  const updateNodeLabel = useCallback(
    (iri: string, newLabel: string) => {
      setNodes((prev) =>
        updateNodeInTree(prev, iri, (node) => ({
          ...node,
          label: newLabel,
        }))
      );
    },
    []
  );

  /**
   * Collapse all expanded nodes in the tree.
   */
  const collapseAll = useCallback(() => {
    const collapseTree = (items: ClassTreeNode[]): ClassTreeNode[] =>
      items.map((node) => ({
        ...node,
        isExpanded: false,
        children: node.children.length > 0 ? collapseTree(node.children) : node.children,
      }));
    setNodes((prev) => collapseTree(prev));
  }, []);

  /**
   * Collapse one level: collapses "leaf-expanded" nodes (expanded with no expanded children).
   * This is the inverse of expandOneLevel — it peels back the expansion frontier.
   */
  const collapseOneLevel = useCallback(() => {
    setNodes((prev) => {
      const collapse = (items: ClassTreeNode[]): ClassTreeNode[] =>
        items.map((node) => {
          if (!node.isExpanded) return node;
          const hasExpandedChild = node.children.some((c) => c.isExpanded);
          if (!hasExpandedChild) return { ...node, isExpanded: false };
          return { ...node, children: collapse(node.children) };
        });
      return collapse(prev);
    });
  }, []);

  /**
   * Collect all visible unexpanded nodes that have children.
   */
  const collectUnexpanded = useCallback((items: ClassTreeNode[]): string[] => {
    const result: string[] = [];
    for (const node of items) {
      if ((node.hasChildren || node.children.length > 0) && !node.isExpanded) {
        result.push(node.iri);
      }
      if (node.isExpanded && node.children.length > 0) {
        result.push(...collectUnexpanded(node.children));
      }
    }
    return result;
  }, []);

  /**
   * Expand one level deeper (visible unexpanded nodes).
   */
  const expandOneLevel = useCallback(async () => {
    const irisToExpand = collectUnexpanded(nodes);
    await Promise.all(irisToExpand.map((iri) => expandNode(iri)));
  }, [nodes, expandNode, collectUnexpanded]);

  // Loading state for expandAllFully
  const [isExpandingAll, setIsExpandingAll] = useState(false);

  /**
   * Expand all nodes fully by looping expansion rounds until the tree is fully expanded.
   * Caps at MAX_ROUNDS rounds or MAX_NODES visible nodes to avoid runaway expansion.
   */
  const expandAllFully = useCallback(async () => {
    const MAX_ROUNDS = 20;
    const MAX_NODES = 500;
    setIsExpandingAll(true);
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        // Peek at latest state via setNodes functional updater
        const frontier = await new Promise<string[]>((resolve) => {
          setNodes((currentNodes) => {
            const countVisible = (items: ClassTreeNode[]): number => {
              let count = items.length;
              for (const node of items) {
                if (node.isExpanded && node.children.length > 0) {
                  count += countVisible(node.children);
                }
              }
              return count;
            };
            if (countVisible(currentNodes) >= MAX_NODES) {
              resolve([]);
              return currentNodes;
            }
            resolve(collectUnexpanded(currentNodes));
            return currentNodes; // no-op — same reference, no re-render
          });
        });
        if (frontier.length === 0) break;
        await Promise.all(frontier.map((iri) => expandNode(iri)));
      }
    } finally {
      setIsExpandingAll(false);
    }
  }, [expandNode, collectUnexpanded]);

  // Computed booleans for disabled state
  const hasExpandableNodes = useMemo(() => {
    const check = (items: ClassTreeNode[]): boolean => {
      for (const node of items) {
        if ((node.hasChildren || node.children.length > 0) && !node.isExpanded) return true;
        if (node.isExpanded && node.children.length > 0 && check(node.children)) return true;
      }
      return false;
    };
    return check(nodes);
  }, [nodes]);

  const hasExpandedNodes = useMemo(() => {
    return nodes.some((node) => node.isExpanded);
  }, [nodes]);

  /**
   * Optimistically reparent a node: remove from old parent, add under new parent.
   * Returns a snapshot that can be used to rollback.
   */
  const reparentOptimistic = useCallback(
    (iri: string, oldParentIri: string | null, newParentIri: string | null): ReparentSnapshot => {
      let snapshot: ReparentSnapshot = { previousNodes: [] };

      setNodes((prev) => {
        snapshot = { previousNodes: prev };

        // Find the node to move (deep clone its subtree)
        const findAndClone = (items: ClassTreeNode[]): ClassTreeNode | null => {
          for (const node of items) {
            if (node.iri === iri) return { ...node };
            if (node.children.length > 0) {
              const found = findAndClone(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const movingNode = findAndClone(prev);
        if (!movingNode) return prev;

        // Step 1: Remove from old location
        const removeFromTree = (items: ClassTreeNode[]): ClassTreeNode[] => {
          const filtered = items.filter((n) => n.iri !== iri);
          return filtered.map((n) => {
            if (n.children.length > 0) {
              const newChildren = removeFromTree(n.children);
              const lostChild = n.children.length !== newChildren.length;
              return {
                ...n,
                children: newChildren,
                hasChildren: newChildren.length > 0 || (n.hasChildren && !lostChild),
              };
            }
            return n;
          });
        };

        let result = removeFromTree(prev);

        // Step 2: Insert under new parent (or root)
        if (newParentIri) {
          result = updateNodeInTree(result, newParentIri, (parent) => ({
            ...parent,
            children: [...parent.children, movingNode],
            hasChildren: true,
            isExpanded: true,
          }));
        } else {
          // Add to root
          result = [...result, movingNode];
        }

        return result;
      });

      return snapshot;
    },
    [],
  );

  /**
   * Rollback a reparent using the snapshot.
   */
  const rollbackReparent = useCallback((snapshot: ReparentSnapshot) => {
    setNodes(snapshot.previousNodes);
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
    navigateToNode,
    addOptimisticNode,
    removeOptimisticNode,
    updateNodeLabel,
    collapseAll,
    collapseOneLevel,
    expandOneLevel,
    expandAllFully,
    hasExpandableNodes,
    hasExpandedNodes,
    isExpandingAll,
    reparentOptimistic,
    rollbackReparent,
  };
}
