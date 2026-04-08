"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";
import type { ShardDefinition } from "@/lib/stores/shardPreviewStore";
import { getLocalName } from "@/lib/utils";

interface ShardPreviewEntityListProps {
  shard: ShardDefinition;
  /** All shard IDs (for "Move to..." dropdown) */
  allShardIds: string[];
  /** shardId -> label for dropdown display */
  shardLabels: Record<string, string>;
  /** When true (passed from ShardPreviewShardRow in split mode), show checkboxes */
  isSplitting?: boolean;
  /** Selected IRIs during split mode — passed from parent */
  splitSelectedIris?: Set<string>;
  /** Callback to toggle an IRI's selection during split mode */
  onSplitToggle?: (iri: string) => void;
}

/**
 * Individual entity row within a shard.
 * Draggable (move between shards) with keyboard fallback via "Move to..." dropdown.
 * D-06/D-07, UI-SPEC Component Inventory.
 */
function EntityRow({
  entityIri,
  shard,
  otherShards,
  shardLabels,
  isSplitting,
  isChecked,
  onToggle,
}: {
  entityIri: string;
  shard: ShardDefinition;
  otherShards: string[];
  shardLabels: Record<string, string>;
  isSplitting: boolean;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const moveEntity = useShardPreviewStore((s) => s.moveEntity);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entity-${entityIri}-${shard.id}`,
    data: { type: "entity", entityIri, fromShardId: shard.id },
  });

  const localName = getLocalName(entityIri);
  const displayName =
    localName.length > 48 ? localName.slice(0, 48) + "…" : localName;

  return (
    <div
      className={[
        "flex min-h-[44px] items-center gap-2 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800",
        isDragging ? "opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Drag handle or checkbox in split mode */}
      {isSplitting ? (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          aria-label={`Select ${localName} for split`}
          className="h-4 w-4 shrink-0 accent-primary-600"
        />
      ) : (
        <button
          ref={setNodeRef}
          type="button"
          aria-label={`Drag ${localName} to reorder`}
          className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3 w-3 text-slate-300 dark:text-slate-600" />
        </button>
      )}

      {/* Entity local name — monospace, truncated */}
      <span
        className="min-w-0 flex-1 truncate font-mono text-xs text-slate-900 dark:text-slate-100"
        title={entityIri}
      >
        {displayName}
      </span>

      {/* "Move to..." dropdown (keyboard-accessible fallback for drag) */}
      {!isSplitting && otherShards.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Move ${localName} to another shard`}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              Move to...
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-[70] min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              sideOffset={4}
            >
              {otherShards.map((targetShardId) => (
                <DropdownMenu.Item
                  key={targetShardId}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                  onSelect={() => moveEntity(entityIri, shard.id, targetShardId)}
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {shardLabels[targetShardId] ?? targetShardId}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

/**
 * ShardPreviewEntityList — sortable entity list inside a shard.
 * Shown when the shard row is expanded.
 * Supports split mode (checkboxes) passed from ShardPreviewShardRow.
 */
export function ShardPreviewEntityList({
  shard,
  allShardIds,
  shardLabels,
  isSplitting = false,
  splitSelectedIris = new Set(),
  onSplitToggle,
}: ShardPreviewEntityListProps) {
  // Local tracking only used when split state is not passed from parent
  const [localSplitSelected, setLocalSplitSelected] = useState<Set<string>>(new Set());

  const effectiveSplitSelected = isSplitting
    ? (onSplitToggle ? splitSelectedIris : localSplitSelected)
    : new Set<string>();

  function handleToggle(iri: string) {
    if (onSplitToggle) {
      onSplitToggle(iri);
    } else {
      setLocalSplitSelected((prev) => {
        const next = new Set(prev);
        if (next.has(iri)) {
          next.delete(iri);
        } else {
          next.add(iri);
        }
        return next;
      });
    }
  }

  const otherShards = allShardIds.filter((id) => id !== shard.id);

  return (
    <div className="pl-12 pr-4">
      {shard.entityIris.map((iri) => (
        <EntityRow
          key={iri}
          entityIri={iri}
          shard={shard}
          otherShards={otherShards}
          shardLabels={shardLabels}
          isSplitting={isSplitting}
          isChecked={effectiveSplitSelected.has(iri)}
          onToggle={() => handleToggle(iri)}
        />
      ))}
    </div>
  );
}
