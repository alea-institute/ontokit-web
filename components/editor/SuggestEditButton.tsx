"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import {
  readSelectionFromSearchParams,
  SELECTION_PARAM_BY_TYPE,
} from "@/lib/utils/selectionUrl";

interface SuggestEditButtonProps {
  projectId: string;
  className?: string;
}

/**
 * Viewer entry point into anonymous proposal mode. Links to the editor with
 * `?propose=1` (the editor starts the anonymous proposal session and drops
 * the param) while carrying the current selection the same way the
 * Viewer/Editor switcher does: the in-memory selection first, then the URL,
 * merged into the existing query string so ?branch= and friends survive.
 *
 * The caller decides visibility (`canPropose`); this component only renders.
 */
export function SuggestEditButton({ projectId, className }: SuggestEditButtonProps) {
  const searchParams = useSearchParams();
  const storeIri = useSelectionStore((s) => s.iri);
  const storeType = useSelectionStore((s) => s.type);
  const selection =
    storeIri && storeType
      ? { iri: storeIri, type: storeType }
      : readSelectionFromSearchParams(searchParams);

  const next = new URLSearchParams(searchParams.toString());
  for (const key of Object.values(SELECTION_PARAM_BY_TYPE)) {
    next.delete(key);
  }
  if (selection?.iri && selection.type) {
    next.set(SELECTION_PARAM_BY_TYPE[selection.type], selection.iri);
  }
  next.set("propose", "1");
  const href = `/projects/${projectId}/editor?${next.toString()}`;

  return (
    <Link
      href={href}
      data-testid="viewer-suggest-edit"
      title="Propose a change for the project maintainers to review"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400",
        className,
      )}
    >
      <PencilLine aria-hidden="true" className="h-4 w-4" />
      Suggest an edit
    </Link>
  );
}
