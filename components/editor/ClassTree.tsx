"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Circle, Plus } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import type { ClassTreeNode } from "@/lib/ontology/types";

interface ClassTreeProps {
  nodes: ClassTreeNode[];
  selectedIri?: string;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
}

export function ClassTree({
  nodes,
  selectedIri,
  onSelect,
  onExpand,
  onAddChild,
}: ClassTreeProps) {
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
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

interface ClassTreeItemProps {
  node: ClassTreeNode;
  depth: number;
  selectedIri?: string;
  onSelect: (iri: string) => void;
  onExpand: (iri: string) => void;
  onAddChild?: (parentIri: string) => void;
}

function ClassTreeItem({
  node,
  depth,
  selectedIri,
  onSelect,
  onExpand,
  onAddChild,
}: ClassTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedIri === node.iri;
  const hasChildren = node.hasChildren || node.children.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand(node.iri);
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
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
