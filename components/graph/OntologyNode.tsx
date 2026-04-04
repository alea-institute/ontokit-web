"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ExternalLink, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphNodeType } from "@/lib/graph/types";

export interface OntologyNodeData {
  [key: string]: unknown;
  label: string;
  nodeType: GraphNodeType;
  deprecated?: boolean;
  childCount?: number;
  isExpanded?: boolean;
  onNavigate?: (iri: string) => void;
  onExpandNode?: (iri: string) => void;
}

type OntologyNodeProps = NodeProps & {
  data: OntologyNodeData;
};

const nodeStyles: Record<GraphNodeType, string> = {
  focus:
    "border-2 border-primary-500 bg-primary-50 dark:bg-primary-950/40 dark:border-primary-400 font-semibold shadow-md",
  class:
    "border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600",
  root:
    "border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/70 font-medium",
  individual:
    "border border-pink-300 bg-pink-50 dark:bg-pink-950/30 dark:border-pink-500/60",
  property:
    "border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500/60",
  external:
    "border border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 text-slate-500 dark:text-slate-400",
  unexplored:
    "border border-dashed border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600",
};

const typeBadge: Partial<Record<GraphNodeType, { letter: string; className: string }>> = {
  individual: {
    letter: "I",
    className: "bg-pink-200 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  },
  property: {
    letter: "P",
    className: "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
};

export const OntologyNode = memo(function OntologyNode({
  data,
  id,
}: OntologyNodeProps) {
  const { label, nodeType, deprecated, childCount, isExpanded, onNavigate, onExpandNode } = data;

  const handleClick = () => {
    if (nodeType === "external") return;
    onNavigate?.(id);
  };

  const handleDoubleClick = () => {
    if (nodeType === "unexplored") {
      onExpandNode?.(id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (nodeType === "unexplored") {
        onExpandNode?.(id);
      } else {
        handleClick();
      }
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "rounded-lg px-3 py-2 text-sm transition-shadow hover:shadow-lg cursor-pointer min-w-[120px] max-w-[200px]",
        nodeStyles[nodeType],
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${label}${nodeType === "unexplored" ? " (click to expand)" : ""}`}
    >
      <Handle type="target" position={Position.Bottom} className="bg-slate-400! w-2! h-2! border-0!" />

      <div className="flex items-center gap-1.5">
        {typeBadge[nodeType] && (
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
              typeBadge[nodeType]!.className,
            )}
          >
            {typeBadge[nodeType]!.letter}
          </span>
        )}
        <span
          className={cn(
            "flex-1 truncate text-slate-900 dark:text-white",
            deprecated && "line-through opacity-60",
            nodeType === "focus" && "font-semibold",
            nodeType === "external" && "text-slate-500 dark:text-slate-400",
          )}
        >
          {label}
        </span>

        {nodeType === "external" && (
          <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
        )}
        {nodeType === "unexplored" && !isExpanded && (
          <Expand className="h-3 w-3 shrink-0 text-slate-400" />
        )}
      </div>

      {childCount !== undefined && childCount > 0 && nodeType !== "external" && (
        <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
          {childCount} {childCount === 1 ? "child" : "children"}
        </span>
      )}

      <Handle type="source" position={Position.Top} className="bg-slate-400! w-2! h-2! border-0!" />
    </div>
  );
});
