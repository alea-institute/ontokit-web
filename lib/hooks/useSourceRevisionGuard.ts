import { useCallback, useRef, useState } from "react";
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
  const scopeKey = `${projectId}\0${activeBranch ?? ""}`;
  const scopeRef = useRef({ key: scopeKey, epoch: 0 });
  if (scopeRef.current.key !== scopeKey) {
    scopeRef.current = { key: scopeKey, epoch: scopeRef.current.epoch + 1 };
  }
  const scopeEpoch = scopeRef.current.epoch;
  const [storedConflict, setStoredConflict] = useState<{
    scopeEpoch: number;
    state: SourceRevisionConflictState;
  } | null>(null);
  const loadLatestRequestIdRef = useRef(0);
  const [loadingLatest, setLoadingLatest] = useState<{
    scopeEpoch: number;
    requestId: number;
  } | null>(null);
  const isLoadingLatest = loadingLatest?.scopeEpoch === scopeEpoch;
  const conflict = storedConflict?.scopeEpoch === scopeEpoch
    && storedConflict.state.detail.branch === activeBranch
    ? storedConflict.state
    : null;

  const captureConflict = useCallback((error: unknown, draftContent: string): Error | null => {
    const detail = getSourceRevisionConflict(error);
    if (!detail) return null;
    const state = { detail, draftContent };
    if (scopeRef.current.epoch === scopeEpoch) {
      setStoredConflict({ scopeEpoch, state });
    }
    return new SourceRevisionConflictError(state);
  }, [scopeEpoch]);

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
      if (scopeRef.current.epoch === scopeEpoch) {
        setSourceSnapshot(content, response.commit_hash);
      }
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
    scopeEpoch,
    sourceRevision,
  ]);

  const loadLatest = useCallback(async () => {
    const requestId = ++loadLatestRequestIdRef.current;
    setLoadingLatest({ scopeEpoch, requestId });
    try {
      const response = await reloadSourceContent();
      if (!response) throw new Error("No source snapshot is available for this branch.");
      if (
        scopeRef.current.epoch === scopeEpoch
        && requestId === loadLatestRequestIdRef.current
      ) {
        onLoadLatest?.(response.content);
        setStoredConflict(null);
      }
      return response;
    } finally {
      if (
        scopeRef.current.epoch === scopeEpoch
        && requestId === loadLatestRequestIdRef.current
      ) {
        setLoadingLatest((current) => (
          current?.scopeEpoch === scopeEpoch && current.requestId === requestId
            ? null
            : current
        ));
      }
    }
  }, [onLoadLatest, reloadSourceContent, scopeEpoch]);

  return {
    conflict,
    isLoadingLatest,
    saveSource,
    loadLatest,
    captureConflict,
  };
}
