"use client";

import { Pencil } from "lucide-react";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { cn } from "@/lib/utils";

export function ContinuousEditingToggle() {
  const continuousEditing = useEditorModeStore((s) => s.continuousEditing);
  const setContinuousEditing = useEditorModeStore((s) => s.setContinuousEditing);

  return (
    <button
      type="button"
      aria-pressed={continuousEditing}
      aria-label={
        continuousEditing
          ? "Continuous editing ON — classes open in edit mode"
          : "Continuous editing OFF — classes open read-only"
      }
      onClick={() => setContinuousEditing(!continuousEditing)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        continuousEditing
          ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300",
      )}
      title={continuousEditing ? "Continuous editing ON — classes open in edit mode" : "Continuous editing OFF — classes open read-only"}
    >
      <Pencil className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Continuous</span>
    </button>
  );
}
