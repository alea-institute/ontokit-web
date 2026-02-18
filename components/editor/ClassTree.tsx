"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Circle, Plus } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { EntitySearchResult } from "@/lib/api/client";

interface ClassTreeProps {
  nodes: ClassTreeNode[];
  selectedIri?: string | null;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onCollapse: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
  searchResults?: EntitySearchResult[] | null;
  isSearching?: boolean;
  onSearchSelect?: (iri: string) => void;
}

export function ClassTree({
  nodes,
  selectedIri,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
  searchResults,
  isSearching,
  onSearchSelect,
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
}

function ClassTreeItem({
  node,
  depth,
  selectedIri,
  onSelect,
  onExpand,
  onCollapse,
  onAddChild,
}: ClassTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);
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

  return (
    <div>
      <div
        className={cn(
          "tree-item group",
          isSelected && "selected"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.iri)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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

        {/* Add child button */}
        {onAddChild && isHovered && (
          <button
            onClick={handleAddChild}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Add subclass"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
