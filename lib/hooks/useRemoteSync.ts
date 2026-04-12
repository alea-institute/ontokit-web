/**
 * React hook for remote sync management.
 *
 * Uses React Query for config/history fetching and cache management.
 * Keeps manual check triggering with job polling as mutations.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  remoteSyncApi,
  type RemoteSyncConfig,
  type RemoteSyncConfigCreate,
  type RemoteSyncConfigUpdate,
  type SyncEvent,
} from "@/lib/api/remoteSync";

const JOB_POLL_INTERVAL = 2000; // 2 seconds

export const remoteSyncQueryKeys = {
  config: (projectId: string, accessToken?: string) =>
    ["remoteSync", "config", projectId, accessToken] as const,
  history: (projectId: string, accessToken?: string) =>
    ["remoteSync", "history", projectId, accessToken] as const,
};

interface UseRemoteSyncOptions {
  projectId: string;
  accessToken?: string;
  /** Disable initial fetch (e.g. when user doesn't have permission) */
  enabled?: boolean;
}

interface UseRemoteSyncReturn {
  config: RemoteSyncConfig | null;
  history: SyncEvent[];
  isLoading: boolean;
  isChecking: boolean;
  error: string | null;
  triggerCheck: () => Promise<void>;
  saveConfig: (data: RemoteSyncConfigCreate | RemoteSyncConfigUpdate) => Promise<void>;
  deleteConfig: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useRemoteSync({
  projectId,
  accessToken,
  enabled = true,
}: UseRemoteSyncOptions): UseRemoteSyncReturn {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // Fetch config via React Query
  const configQuery = useQuery({
    queryKey: remoteSyncQueryKeys.config(projectId, accessToken),
    queryFn: () => remoteSyncApi.getConfig(projectId, accessToken),
    enabled: !!projectId && enabled && !!accessToken,
  });

  // Fetch history via React Query (only when config exists and loaded)
  const historyQuery = useQuery({
    queryKey: remoteSyncQueryKeys.history(projectId, accessToken),
    queryFn: async () => {
      const data = await remoteSyncApi.getHistory(projectId, 20, accessToken);
      return data.items;
    },
    enabled: !!projectId && enabled && !!accessToken && configQuery.isSuccess && !!configQuery.data,
  });

  // Invalidate both queries
  const refetchAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: remoteSyncQueryKeys.config(projectId, accessToken) }),
      queryClient.invalidateQueries({ queryKey: remoteSyncQueryKeys.history(projectId, accessToken) }),
    ]);
  }, [queryClient, projectId, accessToken]);

  // Poll for job status using recursive setTimeout to prevent overlapping calls
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }

      jobIdRef.current = jobId;
      setIsChecking(true);

      const poll = async () => {
        if (!jobIdRef.current) return;

        try {
          const status = await remoteSyncApi.getJobStatus(
            projectId,
            jobIdRef.current,
            accessTokenRef.current,
          );

          if (status.status === "complete" || status.status === "failed") {
            pollTimerRef.current = null;
            jobIdRef.current = null;
            setIsChecking(false);

            if (status.status === "failed" && status.error) {
              setCheckError(status.error);
            }

            // Refresh data after job completes
            await refetchAll();
            return;
          }
        } catch {
          // Polling error — keep trying
        }

        // Schedule next tick only after the current one completes
        pollTimerRef.current = setTimeout(poll, JOB_POLL_INTERVAL);
      };

      pollTimerRef.current = setTimeout(poll, JOB_POLL_INTERVAL);
    },
    [projectId, refetchAll],
  );

  // Trigger a manual check
  const triggerCheck = useCallback(async () => {
    if (!accessToken) return;

    setCheckError(null);
    setIsChecking(true);

    try {
      const response = await remoteSyncApi.triggerCheck(projectId, accessToken);
      startPolling(response.job_id);
    } catch (err) {
      setIsChecking(false);
      setCheckError(err instanceof Error ? err.message : "Failed to trigger check");
    }
  }, [projectId, accessToken, startPolling]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (data: RemoteSyncConfigCreate | RemoteSyncConfigUpdate) =>
      remoteSyncApi.saveConfig(projectId, data, accessToken!),
    onSuccess: (updated) => {
      queryClient.setQueryData(remoteSyncQueryKeys.config(projectId, accessToken), updated);
    },
  });

  const saveConfigRef = useRef(saveConfigMutation.mutateAsync);
  useEffect(() => {
    saveConfigRef.current = saveConfigMutation.mutateAsync;
  }, [saveConfigMutation.mutateAsync]);

  const saveConfig = useCallback(
    async (data: RemoteSyncConfigCreate | RemoteSyncConfigUpdate) => {
      if (!accessToken) return;
      setCheckError(null);
      try {
        await saveConfigRef.current(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save config";
        setCheckError(msg);
        throw err;
      }
    },
    [accessToken],
  );

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => remoteSyncApi.deleteConfig(projectId, accessToken!),
    onSuccess: () => {
      queryClient.setQueryData(remoteSyncQueryKeys.config(projectId, accessToken), null);
      queryClient.setQueryData(remoteSyncQueryKeys.history(projectId, accessToken), []);
    },
  });

  const deleteConfigRef = useRef(deleteConfigMutation.mutateAsync);
  useEffect(() => {
    deleteConfigRef.current = deleteConfigMutation.mutateAsync;
  }, [deleteConfigMutation.mutateAsync]);

  const deleteConfig = useCallback(async () => {
    if (!accessToken) return;
    setCheckError(null);
    try {
      await deleteConfigRef.current();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove config";
      setCheckError(msg);
      throw err;
    }
  }, [accessToken]);

  // Combine errors: prefer check/mutation errors, then history, then config
  const error =
    checkError ??
    (historyQuery.error instanceof Error ? historyQuery.error.message : null) ??
    (configQuery.error instanceof Error ? configQuery.error.message : null);

  return {
    config: configQuery.data ?? null,
    history: historyQuery.data ?? [],
    isLoading: configQuery.isLoading || historyQuery.isLoading,
    isChecking,
    error,
    triggerCheck,
    saveConfig,
    deleteConfig,
    refetch: refetchAll,
  };
}
