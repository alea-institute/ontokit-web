"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { derivePermissions, useProject } from "@/lib/hooks/useProject";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import {
  buildSelectionQuery,
  readSelectionFromSearchParams,
} from "@/lib/utils/selectionUrl";

/**
 * Resolve the URL that should land the user "back at the project" — the
 * viewer or the editor, carrying the active entity selection (?classIri= /
 * ?propertyIri= / ?individualIri=) so cross-page round-trips don't lose the
 * user's place.
 *
 * Mode resolution, in order:
 *   1. The `mode` field in useSelectionStore — set whenever the user is on
 *      the viewer or editor page. This makes Back-to-project semantically
 *      "go back where I just was," matching user expectation regardless of
 *      whether the user explicitly switched mode mid-session.
 *   2. Fallback to the global preferEditMode preference (when the side page
 *      is the user's first project surface, e.g. via a deep link).
 *
 * Permission gate: editor mode requires `canSuggest` — read-only viewer-role
 * users and unauthenticated visitors are always routed to the viewer so the
 * affordance can never land someone where they have no rights.
 */
export function useProjectHomeHref(projectId: string): string {
  const { data: session } = useSession();
  const { project } = useProject(projectId, session?.accessToken);
  const { canSuggest } = derivePermissions(project, session?.accessToken);
  const preferEditMode = useEditorModeStore((s) => s.preferEditMode);

  // Mirror ViewerEditorSwitcher: prefer the in-memory selection store
  // (populated by the viewer/editor the user came from), fall back to URL
  // params for first render or hard-deep-link cases.
  const searchParams = useSearchParams();
  const storeIri = useSelectionStore((s) => s.iri);
  const storeType = useSelectionStore((s) => s.type);
  const storeMode = useSelectionStore((s) => s.mode);
  const selection =
    storeIri && storeType
      ? { iri: storeIri, type: storeType }
      : readSelectionFromSearchParams(searchParams);

  const wantsEditor = storeMode ? storeMode === "editor" : preferEditMode;
  const base =
    wantsEditor && canSuggest
      ? `/projects/${projectId}/editor`
      : `/projects/${projectId}`;
  return `${base}${buildSelectionQuery(selection)}`;
}
