"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";

interface ResizablePanelDividerProps {
  /** Current panel width in pixels */
  width: number;
  /** Called with new width as user drags */
  onWidthChange: (width: number) => void;
  /** Minimum width in pixels (default: 200) */
  minWidth?: number;
  /** Maximum width in pixels (default: 600) */
  maxWidth?: number;
}

export function ResizablePanelDivider({
  width,
  onWidthChange,
  minWidth = 200,
  maxWidth = 600,
}: ResizablePanelDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsDragging(true);
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Prevent text selection while dragging
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, minWidth, maxWidth, onWidthChange]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative z-10 flex w-0 cursor-col-resize items-center justify-center"
      title="Drag to resize"
    >
      {/* Invisible hit area — wider than the visual line for easy grabbing */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      {/* Visual border line — highlights on hover/drag */}
      <div
        className={`absolute inset-y-0 w-px transition-colors ${
          isDragging
            ? "bg-primary-500"
            : "bg-slate-200 group-hover:bg-primary-400 dark:bg-slate-700 dark:group-hover:bg-primary-500"
        }`}
      />
      {/* Grip handle — visible on hover/drag */}
      <div
        className={`relative z-10 flex h-8 w-4 items-center justify-center rounded-xs transition-opacity ${
          isDragging
            ? "bg-primary-500 text-white opacity-100"
            : "bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 dark:bg-slate-600 dark:text-slate-400"
        }`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
