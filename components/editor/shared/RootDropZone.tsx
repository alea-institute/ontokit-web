"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface RootDropZoneProps {
  isActive: boolean;
}

export function RootDropZone({ isActive }: RootDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: "root-drop-zone",
  });

  if (!isActive) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 my-1 flex h-8 items-center justify-center rounded-md border-2 border-dashed transition-colors",
        isOver
          ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20"
          : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50",
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          isOver
            ? "text-primary-600 dark:text-primary-400"
            : "text-slate-400 dark:text-slate-500",
        )}
      >
        Drop here to make root class
      </span>
    </div>
  );
}
