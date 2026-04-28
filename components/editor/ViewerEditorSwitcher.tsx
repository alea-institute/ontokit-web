"use client";

import { Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import {
  readSelectionFromSearchParams,
  SELECTION_PARAM_BY_TYPE,
} from "@/lib/utils/selectionUrl";

interface ViewerEditorSwitcherProps {
  projectId: string;
  className?: string;
}

type Mode = "viewer" | "editor";

const modes: { value: Mode; label: string; icon: typeof Eye }[] = [
  { value: "viewer", label: "Viewer", icon: Eye },
  { value: "editor", label: "Editor", icon: Pencil },
];

export function ViewerEditorSwitcher({ projectId, className }: ViewerEditorSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isEditor = pathname?.endsWith("/editor") ?? false;
  const activeMode: Mode = isEditor ? "editor" : "viewer";

  // Prefer the in-memory selection store (reflects the active-tab selection
  // chosen by the user in this session). Fall back to URL params on initial
  // load, before any layout effect has populated the store.
  const storeIri = useSelectionStore((s) => s.iri);
  const storeType = useSelectionStore((s) => s.type);
  const selection =
    storeIri && storeType
      ? { iri: storeIri, type: storeType }
      : readSelectionFromSearchParams(searchParams);

  // Build the destination href by merging the selection key into the existing
  // query string instead of replacing it — this preserves params like ?branch=
  // and ?resumeSession= that the editor and viewer use.
  const hrefFor = (mode: Mode) => {
    const next = new URLSearchParams(searchParams.toString());
    // Drop all known selection keys before writing the new one so we never
    // emit two of them at once.
    for (const key of Object.values(SELECTION_PARAM_BY_TYPE)) {
      next.delete(key);
    }
    if (selection?.iri && selection.type) {
      next.set(SELECTION_PARAM_BY_TYPE[selection.type], selection.iri);
    }
    const qs = next.toString();
    const path = mode === "editor" ? `/projects/${projectId}/editor` : `/projects/${projectId}`;
    return qs ? `${path}?${qs}` : path;
  };

  return (
    <div
      role="group"
      aria-label="Project view"
      className={cn(
        "flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800",
        className,
      )}
    >
      {modes.map(({ value, label, icon: Icon }) => {
        const isActive = activeMode === value;
        const classes = cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
        );

        if (isActive) {
          return (
            <span key={value} aria-current="page" aria-label={label} className={classes}>
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </span>
          );
        }

        return (
          <Link
            key={value}
            href={hrefFor(value)}
            aria-label={label}
            className={classes}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
