"use client";

import { useMemo } from "react";
import { cn, getLocalName } from "@/lib/utils";
import { EntityTree } from "@/components/editor/shared/EntityTree";
import { classTreeNodesToEntityNodes } from "@/lib/ontology/types";
import type { ClassTreeNode, EntityTreeNode } from "@/lib/ontology/types";
import type { EntitySearchResult } from "@/lib/api/client";
import type { DragState } from "@/lib/hooks/useTreeDragDrop";

interface ClassTreeProps {
  nodes: ClassTreeNode[];
  selectedIri?: string | null;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onCollapse: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
  searchResults?: EntitySearchResult[] | null;
  isSearching?: boolean;
  onSearchSelect?: (iri: string) => void;
  searchQuery?: string;
  /** IRIs that have uncommitted drafts — shown with amber dot indicator */
  draftIris?: Set<string>;
  /** Pre-built filtered tree from useFilteredTree (ancestor-path search results) */
  filteredTree?: EntityTreeNode[] | null;
  /** Whether the filtered tree is still being built */
  isFilteredTreeBuilding?: boolean;
  /** Whether search results were truncated */
  filteredTreeTruncated?: boolean;
  /** Drag state for drag-and-drop reparenting. Not passed during search mode. */
  dragState?: DragState;
  /** Called when drag hovers over a node (for auto-expand) */
  onDragEnterNode?: (iri: string) => void;
  /** Called when drag leaves a node */
  onDragLeaveNode?: () => void;
}

export function ClassTree({
  nodes,
  selectedIri,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
  searchResults,
  isSearching,
  onSearchSelect,
  searchQuery,
  draftIris,
  filteredTree,
  isFilteredTreeBuilding,
  filteredTreeTruncated,
  dragState,
  onDragEnterNode,
  onDragLeaveNode,
}: ClassTreeProps) {
  // Convert ClassTreeNode[] to EntityTreeNode[]
  const entityNodes = useMemo(
    () => classTreeNodesToEntityNodes(nodes),
    [nodes],
  );

  // Show search results when available
  if (searchResults !== null && searchResults !== undefined) {
    const classResults = searchResults.filter((r) => r.entity_type === "class");
    const nonClassResults = searchResults.filter((r) => r.entity_type !== "class");

    return (
      <div className="py-2">
        {isSearching || isFilteredTreeBuilding ? (
          <div className="flex h-20 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No results found
            </p>
          </div>
        ) : (
          <>
            {/* Filtered tree view for class results */}
            {filteredTree && filteredTree.length > 0 && (
              <>
                <EntityTree
                  nodes={filteredTree}
                  selectedIri={selectedIri}
                  onSelect={onSearchSelect || onSelect}
                  onExpand={onExpand}
                  onCollapse={onCollapse}
                  searchQuery={searchQuery}
                  enableKeyboardNav
                />
                {filteredTreeTruncated && (
                  <p className="px-4 py-1 text-xs text-slate-400 dark:text-slate-500">
                    Showing top {classResults.length > 20 ? 20 : classResults.length} matches in tree context
                  </p>
                )}
              </>
            )}

            {/* Flat list fallback for class results when no filtered tree */}
            {(!filteredTree || filteredTree.length === 0) && classResults.length > 0 && (
              classResults.map((result) => (
                <SearchResultItem
                  key={result.iri}
                  result={result}
                  onSelect={onSearchSelect || onSelect}
                />
              ))
            )}

            {/* Non-class results always shown as flat list */}
            {nonClassResults.length > 0 && (
              <>
                {((filteredTree && filteredTree.length > 0) || classResults.length > 0) && nonClassResults.length > 0 && (
                  <div className="mx-4 my-2 border-t border-slate-200 dark:border-slate-700" />
                )}
                {nonClassResults.map((result) => (
                  <SearchResultItem
                    key={result.iri}
                    result={result}
                    onSelect={onSearchSelect || onSelect}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // Normal tree view
  return (
    <EntityTree
      nodes={entityNodes}
      selectedIri={selectedIri}
      onSelect={onSelect}
      onExpand={onExpand}
      onCollapse={onCollapse}
      onAddChild={onAddChild}
      onCopyIri={onCopyIri}
      onDelete={onDelete}
      onViewInSource={onViewInSource}
      draftIris={draftIris}
      enableKeyboardNav
      dragState={dragState}
      onDragEnterNode={onDragEnterNode}
      onDragLeaveNode={onDragLeaveNode}
    />
  );
}

interface SearchResultItemProps {
  result: EntitySearchResult;
  onSelect: (iri: string) => void;
}

function SearchResultItem({ result, onSelect }: SearchResultItemProps) {
  const localName = getLocalName(result.iri);
  const showLocalName = localName !== result.label;

  const typeIcon = {
    class: { letter: "C", color: "bg-owl-class/20 border-owl-class text-owl-class" },
    property: { letter: "P", color: "bg-emerald-100 border-emerald-500 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-400 dark:text-emerald-400" },
    individual: { letter: "I", color: "bg-purple-100 border-purple-500 text-purple-600 dark:bg-purple-900/30 dark:border-purple-400 dark:text-purple-400" },
  }[result.entity_type];

  return (
    <button
      className="tree-item group w-full text-left"
      style={{ paddingLeft: "8px" }}
      onClick={() => onSelect(result.iri)}
    >
      {/* Entity type icon */}
      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0", typeIcon.color)}>
        <span className="text-[10px] font-bold">{typeIcon.letter}</span>
      </div>

      {/* Label and local name */}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm truncate block", result.deprecated && "line-through opacity-60")}>
          {result.label}
        </span>
        {showLocalName && (
          <span className="text-xs text-slate-400 dark:text-slate-500 truncate block">
            {localName}
          </span>
        )}
      </div>

      {/* Entity type badge */}
      <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 flex-shrink-0">
        {result.entity_type}
      </span>
    </button>
  );
}
