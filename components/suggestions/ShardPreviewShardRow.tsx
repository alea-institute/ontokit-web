"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  MoreVertical,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";
import type { ShardDefinition } from "@/lib/stores/shardPreviewStore";

interface ShardPreviewShardRowProps {
  shard: ShardDefinition;
  /** Which PR group this shard belongs to */
  prId: string;
  /** All shard IDs in the same PR group — for "Merge into..." submenu */
  allShardIds: string[];
  /** All PR group IDs — for "Move to PR..." submenu */
  allPrIds: string[];
  /** PR index (1-based) mapping for display labels */
  prIndexMap: Record<string, number>;
  /** Shard labels for display in submenus */
  shardLabels: Record<string, string>;
  /** Entity list rendered when expanded */
  children: React.ReactNode;
}

/**
 * ShardPreviewShardRow — individual shard row with drag handle, collapse chevron,
 * entity count badge, and ⋮ context menu for merge/split/move operations.
 * D-05/D-06/D-07, UI-SPEC Component Inventory.
 */
export function ShardPreviewShardRow({
  shard,
  prId,
  allShardIds,
  allPrIds,
  prIndexMap,
  shardLabels,
  children,
}: ShardPreviewShardRowProps) {
  const expandedShardIds = useShardPreviewStore((s) => s.expandedShardIds);
  const toggleShardExpanded = useShardPreviewStore((s) => s.toggleShardExpanded);
  const mergeShards = useShardPreviewStore((s) => s.mergeShards);
  const moveShard = useShardPreviewStore((s) => s.moveShard);
  const splitShard = useShardPreviewStore((s) => s.splitShard);
  const renameShard = useShardPreviewStore((s) => s.renameShard);

  const isExpanded = expandedShardIds.has(shard.id);

  // Split mode state
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitSelectedIris, setSplitSelectedIris] = useState<Set<string>>(new Set());

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(shard.label);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: shard.id,
    data: { type: "shard", shardId: shard.id, fromPrId: prId },
  });

  // Register shard as a drop target for entity drag-and-drop
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: shard.id,
    data: { type: "shard" },
  });

  // Other shards in same PR group (for merge submenu)
  const otherShardIds = allShardIds.filter((id) => id !== shard.id);

  // Other PR groups (for move submenu)
  const otherPrIds = allPrIds.filter((id) => id !== prId);

  function handleSplitToggle(iri: string) {
    setSplitSelectedIris((prev) => {
      const next = new Set(prev);
      if (next.has(iri)) {
        next.delete(iri);
      } else {
        next.add(iri);
      }
      return next;
    });
  }

  function handleSplitConfirm() {
    if (splitSelectedIris.size === 0) return;
    splitShard(shard.id, Array.from(splitSelectedIris), `${shard.label} — Part 2`);
    setIsSplitting(false);
    setSplitSelectedIris(new Set());
  }

  function handleSplitCancel() {
    setIsSplitting(false);
    setSplitSelectedIris(new Set());
  }

  const entityCount = shard.entityIris.length;

  return (
    <div
      ref={setDropRef}
      className={[
        "border-b border-slate-200 dark:border-slate-700",
        isDragging ? "opacity-50" : "",
        isDropOver ? "ring-2 ring-inset ring-primary-500" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Shard header row */}
      <div className="flex items-center gap-2 bg-white px-6 py-2 dark:bg-slate-900">
        {/* Drag handle */}
        <button
          ref={setDragRef}
          type="button"
          aria-label={`Drag ${shard.label} to reorder`}
          className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4 text-slate-300 dark:text-slate-600" />
        </button>

        {/* Collapse chevron */}
        <button
          type="button"
          onClick={() => toggleShardExpanded(shard.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${shard.label}` : `Expand ${shard.label}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          )}
        </button>

        {/* Shard label — special badges for misc and cross-cutting, inline rename */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                const trimmed = renameValue.trim();
                if (trimmed && trimmed !== shard.label) renameShard(shard.id, trimmed);
                setIsRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setRenameValue(shard.label);
                  setIsRenaming(false);
                }
              }}
              autoFocus
              aria-label={`Rename shard ${shard.label}`}
              className="min-w-0 flex-1 rounded border border-primary-400 bg-white px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary-600 dark:bg-slate-800 dark:text-slate-200"
            />
          ) : shard.isMisc ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              Miscellaneous improvements
            </span>
          ) : shard.isCrossCutting ? (
            <span className="rounded bg-violet-50 px-2 py-0.5 text-sm font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              Cross-cutting changes
            </span>
          ) : (
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {shard.label}
            </span>
          )}
        </div>

        {/* Entity count badge */}
        <span className="shrink-0 rounded-full bg-slate-600 px-2 py-0.5 text-xs text-white dark:bg-slate-500">
          {entityCount}
        </span>

        {/* Context menu trigger — ⋮ */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Shard options for ${shard.label}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MoreVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-[70] min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              sideOffset={4}
            >
              {/* Merge into... */}
              {otherShardIds.length > 0 && (
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                    Merge into...
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="z-[70] min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                      sideOffset={2}
                    >
                      {otherShardIds.map((targetId) => (
                        <DropdownMenu.Item
                          key={targetId}
                          className="cursor-pointer px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                          onSelect={() => mergeShards(shard.id, targetId)}
                        >
                          {shardLabels[targetId] ?? targetId}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )}

              {/* Split shard */}
              <DropdownMenu.Item
                className="cursor-pointer px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                onSelect={() => {
                  setIsSplitting(true);
                  // Ensure shard is expanded so checkboxes are visible
                  if (!isExpanded) toggleShardExpanded(shard.id);
                }}
              >
                Split shard
              </DropdownMenu.Item>

              {/* Rename shard */}
              <DropdownMenu.Item
                className="cursor-pointer px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                onSelect={() => {
                  setRenameValue(shard.label);
                  setIsRenaming(true);
                }}
              >
                Rename
              </DropdownMenu.Item>

              {/* Move to PR... */}
              {otherPrIds.length > 0 && (
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                    Move to PR...
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="z-[70] min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                      sideOffset={2}
                    >
                      {otherPrIds.map((targetPrId) => (
                        <DropdownMenu.Item
                          key={targetPrId}
                          className="cursor-pointer px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                          onSelect={() => moveShard(shard.id, prId, targetPrId)}
                        >
                          PR {prIndexMap[targetPrId] ?? targetPrId}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Collapsible entity list */}
      <div
        className={[
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
        aria-hidden={!isExpanded}
      >
        {/* Empty state */}
        {entityCount === 0 ? (
          <p className="pl-14 pr-4 py-2 text-sm italic text-slate-400 dark:text-slate-500">
            No suggestions in this shard.
          </p>
        ) : (
          <>
            {/* Split mode action bar */}
            {isSplitting && (
              <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50 px-14 py-2 dark:border-slate-700 dark:bg-amber-900/20">
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Select entities to split into a new shard
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSplitCancel}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSplitConfirm}
                    disabled={splitSelectedIris.size === 0}
                    className="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
                  >
                    Split selected ({splitSelectedIris.size})
                  </button>
                </div>
              </div>
            )}

            {/* Pass children with split state injected */}
            {React.Children.map(children, (child) => {
              if (!isSplitting) return child;
              // Pass isSplitting and selection state down to ShardPreviewEntityList
              if (React.isValidElement(child)) {
                return React.cloneElement(child as React.ReactElement<{
                  isSplitting?: boolean;
                  splitSelectedIris?: Set<string>;
                  onSplitToggle?: (iri: string) => void;
                }>, {
                  isSplitting,
                  splitSelectedIris,
                  onSplitToggle: handleSplitToggle,
                });
              }
              return child;
            })}
          </>
        )}
      </div>
    </div>
  );
}
