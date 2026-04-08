"use client";

import React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";
import type { PRGroupDefinition } from "@/lib/stores/shardPreviewStore";

interface ShardPreviewPRGroupProps {
  prGroup: PRGroupDefinition;
  /** 1-based index for display */
  prIndex: number;
  /** ShardRows rendered inside */
  children: React.ReactNode;
}

/**
 * ShardPreviewPRGroup — collapsible PR grouping section.
 * Header shows PR index, shard count, and total entity count.
 * Acts as a drop target for dragged shard rows.
 * D-05, UI-SPEC Component Inventory.
 */
export function ShardPreviewPRGroup({
  prGroup,
  prIndex,
  children,
}: ShardPreviewPRGroupProps) {
  const expandedPrIds = useShardPreviewStore((s) => s.expandedPrIds);
  const togglePrExpanded = useShardPreviewStore((s) => s.togglePrExpanded);

  const isExpanded = expandedPrIds.has(prGroup.id);

  const { setNodeRef, isOver } = useDroppable({
    id: prGroup.id,
    data: { type: "pr-group" },
  });

  const shardCount = prGroup.shardIds.length;

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      {/* PR group header — drop target */}
      <div
        ref={setNodeRef}
        className={[
          "flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800",
          isOver ? "ring-2 ring-inset ring-primary-500" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Chevron toggle */}
        <button
          type="button"
          onClick={() => togglePrExpanded(prGroup.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse PR ${prIndex}` : `Expand PR ${prIndex}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          )}
        </button>

        {/* PR label */}
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
          PR {prIndex}
        </span>

        {/* Shard + entity counts */}
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {shardCount} {shardCount === 1 ? "shard" : "shards"} &middot;{" "}
          {prGroup.suggestionCount}{" "}
          {prGroup.suggestionCount === 1 ? "suggestion" : "suggestions"}
        </span>
      </div>

      {/* Collapsible body */}
      <div
        className={[
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        aria-hidden={!isExpanded}
      >
        {children}
      </div>
    </div>
  );
}
