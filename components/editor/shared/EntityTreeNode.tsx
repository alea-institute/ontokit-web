"use client";

import { memo, useCallback } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronRight, ChevronDown, Circle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { TreeNodeContextMenu } from "@/components/editor/TreeNodeContextMenu";
import type { EntityTreeNode as EntityTreeNodeType } from "@/lib/ontology/types";
import type { DragState } from "@/lib/hooks/useTreeDragDrop";

interface EntityTreeNodeProps {
  node: EntityTreeNodeType;
  depth: number;
  selectedIri?: string | null;
  focusedIri?: string | null;
  searchQuery?: string;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onCollapse: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
  draftIris?: Set<string>;
  /** Drag state for drag-and-drop reparenting. Undefined = drag disabled. */
  dragState?: DragState;
  /** Called when drag hovers over this node (for auto-expand) */
  onDragEnterNode?: (iri: string) => void;
  /** Called when drag leaves this node */
  onDragLeaveNode?: () => void;
}

function highlightMatch(text: string, query: string | undefined): React.ReactNode {
  if (!query || !query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const EntityTreeNodeRow = memo(function EntityTreeNodeRow({
  node,
  depth,
  selectedIri,
  focusedIri,
  searchQuery,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
  draftIris,
  dragState,
  onDragEnterNode,
  onDragLeaveNode,
}: EntityTreeNodeProps) {
  const isSelected = selectedIri === node.iri;
  const isFocused = focusedIri === node.iri;
  const hasChildren = node.hasChildren || node.children.length > 0;
  const isRoot = depth === 0;

  // Drag-and-drop hooks (only when dragState is provided)
  const isDndEnabled = !!dragState;
  const { attributes: dragAttributes, listeners: dragListeners, setNodeRef: setDragRef } = useDraggable({
    id: node.iri,
    disabled: !isDndEnabled,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.iri,
    disabled: !isDndEnabled,
  });

  // Combine refs for the row element
  const setRowRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (isDndEnabled) {
        setDragRef(el);
        setDropRef(el);
      }
    },
    [isDndEnabled, setDragRef, setDropRef],
  );

  // Drag state for this specific node
  const isBeingDragged = dragState?.draggedIri === node.iri;
  const isDropTarget = dragState?.dropTargetIri === node.iri;
  const isValidDrop = isDropTarget && dragState?.isValidDropTarget;
  const isInvalidDrop = isDropTarget && !dragState?.isValidDropTarget;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.isExpanded) {
        onCollapse(node.iri);
      } else {
        onExpand(node.iri);
      }
    },
    [node.iri, node.isExpanded, onExpand, onCollapse],
  );

  const handleDoubleClick = useCallback(() => {
    if (hasChildren) {
      if (node.isExpanded) {
        onCollapse(node.iri);
      } else {
        onExpand(node.iri);
      }
    }
  }, [hasChildren, node.iri, node.isExpanded, onExpand, onCollapse]);

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddChild?.(node.iri);
    },
    [node.iri, onAddChild],
  );

  // Group headers: uppercase label + count, click only toggles expand
  if (node.isGroupHeader) {
    return (
      <div>
        <button
          onClick={handleToggle}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50"
          role="treeitem"
          aria-selected={false}
          aria-expanded={node.isExpanded}
          data-iri={node.iri}
        >
          {node.isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {node.label}
          <span className="ml-auto font-normal text-slate-400">
            {node.children.length}
          </span>
        </button>
        {node.isExpanded && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <EntityTreeNodeRow
                key={child.iri}
                node={child}
                depth={depth + 1}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const hasContextMenu = onCopyIri || onDelete || onViewInSource || onAddChild;

  const rowContent = (
    <div
      ref={isDndEnabled ? setRowRef : undefined}
      className={cn(
        "tree-item group",
        isSelected && "selected",
        isRoot && "tree-item-root",
        isFocused && "tree-item-focused",
        node.isSearchMatch && "tree-search-match",
        node.deprecated && "opacity-60",
        isBeingDragged && "tree-item-dragging",
        isValidDrop && "tree-item-drop-valid",
        isInvalidDrop && "tree-item-drop-invalid",
      )}
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
      onClick={() => onSelect(node.iri)}
      onDoubleClick={handleDoubleClick}
      onPointerEnter={isOver && isDndEnabled ? () => onDragEnterNode?.(node.iri) : undefined}
      onPointerLeave={isDndEnabled && dragState?.isDragActive ? onDragLeaveNode : undefined}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? node.isExpanded : undefined}
      data-iri={node.iri}
      {...(isDndEnabled ? { ...dragAttributes, ...dragListeners, role: "treeitem" } : { role: "treeitem" })}
    >
      {/* Expand/collapse chevron or leaf dot — same 16px box for alignment */}
      {hasChildren ? (
        <button
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0"
          tabIndex={-1}
          aria-hidden="true"
        >
          {node.isLoading ? (
            <Circle className="w-3 h-3 animate-pulse" />
          ) : node.isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      ) : (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <span className="tree-leaf-dot" />
        </span>
      )}

      {/* Label */}
      <span
        className={cn(
          "flex-1 truncate text-sm",
          node.deprecated && "line-through",
        )}
      >
        {node.isSearchMatch && searchQuery
          ? highlightMatch(node.label, searchQuery)
          : node.label}
      </span>

      {/* Draft indicator */}
      {draftIris?.has(node.iri) && (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
          title="Unsaved draft"
        />
      )}

      {/* Add child button — visible on hover */}
      {onAddChild && (
        <button
          onClick={handleAddChild}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Add subclass"
          tabIndex={-1}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div>
      {hasContextMenu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
          <TreeNodeContextMenu
            node={node}
            onAddChild={onAddChild}
            onCopyIri={onCopyIri}
            onDelete={onDelete}
            onViewInSource={onViewInSource}
          />
        </ContextMenu>
      ) : (
        rowContent
      )}

      {/* Children — rendered flat; indentation handled by each row's paddingLeft */}
      {node.isExpanded && node.children.length > 0 &&
        node.children.map((child) => (
          <EntityTreeNodeRow
            key={child.iri}
            node={child}
            depth={depth + 1}
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
});
