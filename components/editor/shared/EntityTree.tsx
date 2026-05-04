"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EntityTreeNodeRow } from "./EntityTreeNode";
import type { EntityTreeNode } from "@/lib/ontology/types";
import type { DragState } from "@/lib/hooks/useTreeDragDrop";

interface EntityTreeProps {
  nodes: EntityTreeNode[];
  selectedIri?: string | null;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onCollapse: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
  draftIris?: Set<string>;
  searchQuery?: string;
  enableKeyboardNav?: boolean;
  /** Drag state for drag-and-drop reparenting. Undefined = drag disabled. */
  dragState?: DragState;
  /** Called when drag hovers over a node (for auto-expand) */
  onDragEnterNode?: (iri: string) => void;
  /** Called when drag leaves a node */
  onDragLeaveNode?: () => void;
}

/**
 * Flatten visible nodes (expanded only) into an ordered list of IRIs for keyboard navigation.
 */
function flattenVisible(nodes: EntityTreeNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.iri);
    if (node.isExpanded && node.children.length > 0) {
      result.push(...flattenVisible(node.children));
    }
  }
  return result;
}

/**
 * Find a node by IRI in the tree.
 */
function findNode(
  nodes: EntityTreeNode[],
  iri: string,
): EntityTreeNode | null {
  for (const node of nodes) {
    if (node.iri === iri) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, iri);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find the parent IRI of a given node.
 */
function findParentIri(
  nodes: EntityTreeNode[],
  targetIri: string,
  parentIri: string | null = null,
): string | null {
  for (const node of nodes) {
    if (node.iri === targetIri) return parentIri;
    if (node.children.length > 0) {
      const found = findParentIri(node.children, targetIri, node.iri);
      if (found !== null) return found;
    }
  }
  return null;
}

export function EntityTree({
  nodes,
  selectedIri,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
  draftIris,
  searchQuery,
  enableKeyboardNav = false,
  dragState,
  onDragEnterNode,
  onDragLeaveNode,
}: EntityTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIri, setFocusedIri] = useState<string | null>(null);

  const visibleIris = useMemo(() => flattenVisible(nodes), [nodes]);

  const scrollToIri = useCallback((iri: string) => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-iri="${CSS.escape(iri)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableKeyboardNav) return;

      const currentIri = focusedIri || selectedIri;
      const currentIdx = currentIri ? visibleIris.indexOf(currentIri) : -1;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, visibleIris.length - 1);
          if (nextIdx >= 0) {
            setFocusedIri(visibleIris[nextIdx]);
            scrollToIri(visibleIris[nextIdx]);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          if (prevIdx >= 0 && visibleIris.length > 0) {
            setFocusedIri(visibleIris[prevIdx]);
            scrollToIri(visibleIris[prevIdx]);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (currentIri) {
            const node = findNode(nodes, currentIri);
            if (node && (node.hasChildren || node.children.length > 0)) {
              if (!node.isExpanded) {
                onExpand(currentIri);
              } else if (node.children.length > 0) {
                setFocusedIri(node.children[0].iri);
                scrollToIri(node.children[0].iri);
              }
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (currentIri) {
            const node = findNode(nodes, currentIri);
            if (node && node.isExpanded) {
              onCollapse(currentIri);
            } else {
              const parentIri = findParentIri(nodes, currentIri);
              if (parentIri) {
                setFocusedIri(parentIri);
                scrollToIri(parentIri);
              }
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const iriToSelect = focusedIri || currentIri;
          if (iriToSelect) {
            onSelect(iriToSelect);
            setFocusedIri(null);
          }
          break;
        }
      }
    },
    [enableKeyboardNav, focusedIri, selectedIri, visibleIris, nodes, onExpand, onCollapse, onSelect, scrollToIri],
  );

  const activeDescendantId = focusedIri
    ? `tree-item-${focusedIri.replace(/[^a-zA-Z0-9-_]/g, "_")}`
    : undefined;

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="Ontology class hierarchy"
      aria-activedescendant={enableKeyboardNav ? activeDescendantId : undefined}
      tabIndex={enableKeyboardNav ? 0 : undefined}
      onKeyDown={enableKeyboardNav ? handleKeyDown : undefined}
      onBlur={() => setFocusedIri(null)}
      className="py-2 outline-hidden"
    >
      {nodes.map((node, index) => (
        <EntityTreeNodeRow
          key={`${node.iri}-${index}`}
          node={node}
          depth={0}
          selectedIri={selectedIri}
          focusedIri={focusedIri}
          searchQuery={searchQuery}
          onSelect={onSelect}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onAddChild={onAddChild}
          onCopyIri={onCopyIri}
          onDelete={onDelete}
          onViewInSource={onViewInSource}
          draftIris={draftIris}
          dragState={dragState}
          onDragEnterNode={onDragEnterNode}
          onDragLeaveNode={onDragLeaveNode}
        />
      ))}
    </div>
  );
}
