"use client";

import { ChevronRight, ChevronDown, Circle, Plus } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { TreeNodeContextMenu } from "@/components/editor/TreeNodeContextMenu";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { EntitySearchResult } from "@/lib/api/client";

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
  /** IRIs that have uncommitted drafts — shown with amber dot indicator */
  draftIris?: Set<string>;
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
  draftIris,
}: ClassTreeProps) {
  // Show search results when available
  if (searchResults !== null && searchResults !== undefined) {
    return (
      <div className="py-2">
        {isSearching ? (
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
          searchResults.map((result) => (
            <SearchResultItem
              key={result.iri}
              result={result}
              onSelect={onSearchSelect || onSelect}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="py-2">
      {nodes.map((node) => (
        <ClassTreeItem
          key={node.iri}
          node={node}
          depth={0}
          selectedIri={selectedIri}
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

interface ClassTreeItemProps {
  node: ClassTreeNode;
  depth: number;
  selectedIri?: string | null;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onCollapse: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
  draftIris?: Set<string>;
}

function ClassTreeItem({
  node,
  depth,
  selectedIri,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
  draftIris,
}: ClassTreeItemProps) {
  const isSelected = selectedIri === node.iri;
  const hasChildren = node.hasChildren || node.children.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isExpanded) {
      onCollapse(node.iri);
    } else {
      onExpand(node.iri);
    }
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChild?.(node.iri);
  };

  const hasContextMenu = onCopyIri || onDelete || onViewInSource || onAddChild;

  const rowContent = (
    <div
      className={cn(
        "tree-item group",
        isSelected && "selected"
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelect(node.iri)}
    >
      {/* Expand/collapse button */}
      <button
        onClick={handleToggle}
        className={cn(
          "w-4 h-4 flex items-center justify-center",
          !hasChildren && "invisible"
        )}
      >
        {node.isLoading ? (
          <Circle className="w-3 h-3 animate-pulse" />
        ) : node.isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Class icon */}
      <div className="w-4 h-4 rounded-full bg-owl-class/20 border border-owl-class flex items-center justify-center">
        <span className="text-[10px] font-bold text-owl-class">C</span>
      </div>

      {/* Label */}
      <span className="flex-1 truncate text-sm">
        {node.label || getLocalName(node.iri)}
      </span>

      {/* Draft indicator */}
      {draftIris?.has(node.iri) && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Unsaved draft" />
      )}

      {/* Add child button — always rendered to reserve space, visible on hover */}
      {onAddChild && (
        <button
          onClick={handleAddChild}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Add subclass"
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
          <ContextMenuTrigger asChild>
            {rowContent}
          </ContextMenuTrigger>
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

      {/* Children */}
      {node.isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <ClassTreeItem
              key={child.iri}
              node={child}
              depth={depth + 1}
              selectedIri={selectedIri}
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
