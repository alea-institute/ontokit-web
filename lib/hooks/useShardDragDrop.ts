"use client";

import { useCallback } from "react";
import { useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";

interface ShardDragData {
  type: "entity" | "shard";
  entityIri?: string;
  fromShardId?: string;
  shardId?: string;
  fromPrId?: string;
}

/**
 * useShardDragDrop — encapsulates DnD sensor config and drag-end dispatch
 * for the ShardPreviewModal.
 *
 * Handles two drag types:
 *  - "entity": moves an entity IRI from one shard to another (CLUSTER-05/06)
 *  - "shard": moves a shard from one PR group to another
 *
 * Returns { sensors, handleDragEnd } for use in a DndContext.
 */
export function useShardDragDrop() {
  const moveEntity = useShardPreviewStore((s) => s.moveEntity);
  const moveShard = useShardPreviewStore((s) => s.moveShard);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const data = active.data.current as ShardDragData | undefined;
      if (!data) return;

      if (data.type === "entity" && data.entityIri && data.fromShardId) {
        const toShardId = String(over.id);
        if (toShardId === data.fromShardId) return; // no-op: same shard
        moveEntity(data.entityIri, data.fromShardId, toShardId);
      } else if (data.type === "shard" && data.shardId && data.fromPrId) {
        const toPrId = String(over.id);
        if (toPrId === data.fromPrId) return; // no-op: same PR group
        moveShard(data.shardId, data.fromPrId, toPrId);
      }
    },
    [moveEntity, moveShard],
  );

  return { sensors, handleDragEnd };
}
