"use client";

import { useSession } from "next-auth/react";
import { derivePermissions, useProject } from "@/lib/hooks/useProject";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";

/**
 * Resolve the URL that should land the user "back at the project" — either
 * the read-only viewer or the editor, depending on the user's
 * preferEditMode preference and their permissions on this project.
 *
 * Used by every "Back to project" link in side pages (settings, PRs,
 * analytics, suggestions, dashboard) so that a user who has prefer-edit-mode
 * enabled and the right permissions returns to the editor — not always to
 * the viewer like the previous hard-coded `/projects/${projectId}` href did.
 *
 * Read-only viewer-role users and unauthenticated visitors always get the
 * viewer URL regardless of preference, so the affordance can never land
 * someone where they have no rights.
 */
export function useProjectHomeHref(projectId: string): string {
  const { data: session } = useSession();
  const { project } = useProject(projectId, session?.accessToken);
  const { canSuggest } = derivePermissions(project, session?.accessToken);
  const preferEditMode = useEditorModeStore((s) => s.preferEditMode);

  return preferEditMode && canSuggest
    ? `/projects/${projectId}/editor`
    : `/projects/${projectId}`;
}
