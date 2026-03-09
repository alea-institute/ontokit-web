"use client";

import { Code, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorModeStore, type EditorMode } from "@/lib/stores/editorModeStore";

interface ModeSwitcherProps {
  className?: string;
}

const modes: { value: EditorMode; label: string; icon: typeof Code }[] = [
  { value: "standard", label: "Standard", icon: LayoutGrid },
  { value: "developer", label: "Developer", icon: Code },
];

export function ModeSwitcher({ className }: ModeSwitcherProps) {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const setEditorMode = useEditorModeStore((s) => s.setEditorMode);

  return (
    <div
      role="group"
      aria-label="Editor mode"
      className={cn(
        "flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800",
        className,
      )}
    >
      {modes.map(({ value, label, icon: Icon }) => (
        <button
          type="button"
          key={value}
          onClick={() => setEditorMode(value)}
          aria-label={label}
          aria-pressed={editorMode === value}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            editorMode === value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
