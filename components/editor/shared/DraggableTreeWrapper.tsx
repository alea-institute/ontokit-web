"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { RootDropZone } from "./RootDropZone";
import type { DragMode } from "@/lib/hooks/useTreeDragDrop";

interface DraggableTreeWrapperProps {
  children: React.ReactNode;
  isDragActive: boolean;
  draggedLabel: string | null;
  dragMode: DragMode;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

/**
 * Pointer-tracking overlay that sticks to the cursor 1:1.
 * Bypasses DragOverlay's coordinate system entirely for reliable positioning.
 */
function PointerOverlay({ label, mode }: { label: string; mode: DragMode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    // Capture initial position immediately
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, []);

  // Don't render until we have a real position
  if (pos.x === 0 && pos.y === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: pos.x + 12,
        top: pos.y - 18,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <div className="tree-drag-overlay">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate text-sm font-medium">{label}</span>
        {mode === "add" && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">
            <Plus className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function DraggableTreeWrapper({
  children,
  isDragActive,
  draggedLabel,
  dragMode,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: DraggableTreeWrapperProps) {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(pointerSensor, keyboardSensor);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <RootDropZone isActive={isDragActive} />
      {children}

      {isDragActive && draggedLabel && (
        <PointerOverlay label={draggedLabel} mode={dragMode} />
      )}
    </DndContext>
  );
}
