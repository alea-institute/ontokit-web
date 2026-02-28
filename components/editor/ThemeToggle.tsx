"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorModeStore, type ThemePreference } from "@/lib/stores/editorModeStore";

interface ThemeToggleProps {
  className?: string;
}

const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useEditorModeStore((s) => s.theme);
  const setTheme = useEditorModeStore((s) => s.setTheme);

  return (
    <div
      className={cn(
        "flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800",
        className,
      )}
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
            theme === value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
