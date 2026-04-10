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
  config: (projectId: string) => ["remoteSync", "config", projectId] as const,
  history: (projectId: string) => ["remoteSync", "history", projectId] as const,
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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Fetch config via React Query
  const configQuery = useQuery({
    queryKey: remoteSyncQueryKeys.config(projectId),
    queryFn: () => remoteSyncApi.getConfig(projectId, accessToken),
    enabled: !!projectId && enabled,
  });

  // Fetch history via React Query (only when config exists)
  const historyQuery = useQuery({
    queryKey: remoteSyncQueryKeys.history(projectId),
    queryFn: async () => {
      const data = await remoteSyncApi.getHistory(projectId, 20, accessToken);
      return data.items;
    },
    enabled: !!projectId && enabled && !!configQuery.data,
  });

  // Invalidate both queries
  const refetchAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: remoteSyncQueryKeys.config(projectId) }),
      queryClient.invalidateQueries({ queryKey: remoteSyncQueryKeys.history(projectId) }),
    ]);
  }, [queryClient, projectId]);

  // Poll for job status
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      jobIdRef.current = jobId;
      setIsChecking(true);

      pollTimerRef.current = setInterval(async () => {
        if (!jobIdRef.current) return;

        try {
          const status = await remoteSyncApi.getJobStatus(
            projectId,
            jobIdRef.current,
            accessToken,
          );

          if (status.status === "complete" || status.status === "failed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            jobIdRef.current = null;
            setIsChecking(false);

            if (status.status === "failed" && status.error) {
              setCheckError(status.error);
            }

            // Refresh data after job completes
            await refetchAll();
          }
        } catch {
          // Polling error — keep trying
        }
      }, JOB_POLL_INTERVAL);
    },
    [projectId, accessToken, refetchAll],
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
      queryClient.setQueryData(remoteSyncQueryKeys.config(projectId), updated);
    },
  });

  const saveConfig = useCallback(
    async (data: RemoteSyncConfigCreate | RemoteSyncConfigUpdate) => {
      if (!accessToken) return;
      setCheckError(null);
      try {
        await saveConfigMutation.mutateAsync(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save config";
        setCheckError(msg);
        throw err;
      }
    },
    [accessToken, saveConfigMutation],
  );

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => remoteSyncApi.deleteConfig(projectId, accessToken!),
    onSuccess: () => {
      queryClient.setQueryData(remoteSyncQueryKeys.config(projectId), null);
      queryClient.setQueryData(remoteSyncQueryKeys.history(projectId), []);
    },
  });

  const deleteConfig = useCallback(async () => {
    if (!accessToken) return;
    setCheckError(null);
    try {
      await deleteConfigMutation.mutateAsync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove config";
      setCheckError(msg);
      throw err;
    }
  }, [accessToken, deleteConfigMutation]);

  // Combine errors: prefer check/mutation errors, then fallback to query error
  const error =
    checkError ??
    (configQuery.error instanceof Error ? configQuery.error.message : null);

  return {
    config: configQuery.data ?? null,
    history: historyQuery.data ?? [],
    isLoading: configQuery.isLoading,
    isChecking,
    error,
    triggerCheck,
    saveConfig,
    deleteConfig,
    refetch: refetchAll,
  };
}
