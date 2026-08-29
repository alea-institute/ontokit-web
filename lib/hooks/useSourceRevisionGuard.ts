import { useCallback, useState } from "react";
import {
  getSourceRevisionConflict,
  projectOntologyApi,
  type SourceContentSaveResponse,
  type SourceRevisionConflictDetail,
} from "@/lib/api/client";
import type { RevisionFileResponse } from "@/lib/api/revisions";

export interface SourceRevisionConflictState {
  detail: SourceRevisionConflictDetail;
  draftContent: string;
}

export class SourceRevisionConflictError extends Error {
  constructor(public readonly conflict: SourceRevisionConflictState) {
    super(`${conflict.detail.message} Your draft is preserved. Load the latest source before saving again.`);
    this.name = "SourceRevisionConflictError";
  }
}

interface UseSourceRevisionGuardOptions {
  projectId: string;
  accessToken?: string;
  activeBranch?: string;
  sourceRevision: string | null;
  setSourceSnapshot: (content: string, revision: string) => void;
  reloadSourceContent: () => Promise<RevisionFileResponse | undefined>;
  onLoadLatest?: (content: string) => void;
}

export function useSourceRevisionGuard({
  projectId,
  accessToken,
  activeBranch,
  sourceRevision,
  setSourceSnapshot,
  reloadSourceContent,
  onLoadLatest,
}: UseSourceRevisionGuardOptions) {
  const [storedConflict, setStoredConflict] = useState<SourceRevisionConflictState | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const conflict = storedConflict?.detail.branch === activeBranch ? storedConflict : null;

  const captureConflict = useCallback((error: unknown, draftContent: string): Error | null => {
    const detail = getSourceRevisionConflict(error);
    if (!detail) return null;
    const state = { detail, draftContent };
    setStoredConflict(state);
    return new SourceRevisionConflictError(state);
  }, []);

  const saveSource = useCallback(async (
    content: string,
    commitMessage: string,
    baseRevisionOverride?: string,
  ): Promise<SourceContentSaveResponse> => {
    if (conflict) throw new SourceRevisionConflictError(conflict);
    if (!accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");
    const baseRevision = baseRevisionOverride ?? sourceRevision;
    if (!baseRevision) {
      throw new Error("The source revision is unavailable. Load the latest source before saving.");
    }

    try {
      const response = await projectOntologyApi.saveSource(
        projectId,
        content,
        commitMessage,
        accessToken,
        activeBranch,
        baseRevision,
      );
      setSourceSnapshot(content, response.commit_hash);
      setStoredConflict(null);
      return response;
    } catch (error) {
      const conflictError = captureConflict(error, content);
      throw conflictError ?? error;
    }
  }, [
    accessToken,
    activeBranch,
    captureConflict,
    conflict,
    projectId,
    setSourceSnapshot,
    sourceRevision,
  ]);

  const loadLatest = useCallback(async () => {
    setIsLoadingLatest(true);
    try {
      const response = await reloadSourceContent();
      if (!response) throw new Error("No source snapshot is available for this branch.");
      setSourceSnapshot(response.content, response.revision);
      onLoadLatest?.(response.content);
      setStoredConflict(null);
      return response;
    } finally {
      setIsLoadingLatest(false);
    }
  }, [onLoadLatest, reloadSourceContent, setSourceSnapshot]);

  return {
    conflict,
    isLoadingLatest,
    saveSource,
    loadLatest,
    captureConflict,
  };
}
