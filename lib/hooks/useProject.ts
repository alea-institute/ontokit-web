import { useQuery } from "@tanstack/react-query";
import { projectApi, type Project } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";

export type ProjectErrorKind = "private-403" | "no-access" | "not-found" | "generic";

export const projectQueryKeys = {
  detail: (projectId: string, isAuthenticated: boolean) =>
    ["project", projectId, isAuthenticated] as const,
};

export function useProject(projectId: string, accessToken?: string) {
  const query = useQuery({
    queryKey: projectQueryKeys.detail(projectId, !!accessToken),
    queryFn: () => projectApi.get(projectId, accessToken),
    enabled: !!projectId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return false;
      return failureCount < 3;
    },
  });

  // Derive error kind from the query error
  let errorKind: ProjectErrorKind | null = null;
  let errorMessage: string | null = null;

  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 403) {
      if (!accessToken) {
        errorKind = "private-403";
        errorMessage = "This is a private project. Sign in to request access.";
      } else {
        errorKind = "no-access";
        errorMessage = "You don't have access to this project";
      }
    } else if (query.error instanceof ApiError && query.error.status === 404) {
      errorKind = "not-found";
      errorMessage = "Project not found";
    } else {
      errorKind = "generic";
      errorMessage = query.error instanceof Error ? query.error.message : "Failed to load project";
    }
  }

  return {
    project: query.data ?? null,
    isLoading: query.isLoading,
    error: errorMessage,
    errorKind,
    refetch: query.refetch,
  };
}

/**
 * Derive common permission flags from a Project object.
 *
 * `capabilities` carries the server's trust-tier answer (see
 * `useTrustCapabilities`). Minting is sourced from it rather than re-derived
 * from roles: the server gate and the UI affordance must read the same
 * resolution, and a second derivation drifts. When it is absent — the caller
 * has not fetched capabilities, or they are still loading — `canMintEntities`
 * is false, which is the fail-safe direction (R8, KTD3).
 */
export function derivePermissions(
  project: Project | null,
  accessToken?: string,
  capabilities?: { can_suggest?: boolean; can_mint_entities: boolean } | null,
) {
  const canManage = project?.user_role === "owner" || project?.user_role === "admin" || !!project?.is_superadmin;
  const hasExplicitRole = !!project?.user_role;
  const canEdit = project?.user_role === "owner" || project?.user_role === "admin" || project?.user_role === "editor" || !!project?.is_superadmin;
  const isSuggester = project?.user_role === "suggester" ||
    (!canEdit && capabilities?.can_suggest === true) ||
    (!hasExplicitRole && !!accessToken);
  const canSuggest = canEdit || isSuggester;
  const hasValidAccess = !!accessToken;
  const hasOntology = !!project?.source_file_path;
  const isSuggestionMode = isSuggester && !canEdit;
  const canMintEntities = capabilities?.can_mint_entities === true;

  return { canManage, canEdit, canSuggest, canMintEntities, isSuggester, isSuggestionMode, hasValidAccess, hasOntology, hasExplicitRole };
}

export function shouldRedirectFromEditor({
  sessionStatus,
  projectLoaded,
  canSuggest,
  canPropose,
  capabilitiesSettled,
}: {
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  projectLoaded: boolean;
  canSuggest: boolean;
  canPropose: boolean;
  capabilitiesSettled: boolean;
}) {
  if (!capabilitiesSettled || canPropose) return false;
  return (sessionStatus === "unauthenticated" && !canSuggest) ||
    (projectLoaded && !canSuggest);
}
