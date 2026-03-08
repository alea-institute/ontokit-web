/**
 * React hook for upstream sync management.
 *
 * Handles config CRUD, manual check triggering with job polling,
 * and sync event history.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  upstreamSyncApi,
  type UpstreamSyncConfig,
  type UpstreamSyncConfigCreate,
  type UpstreamSyncConfigUpdate,
  type SyncEvent,
} from "@/lib/api/upstreamSync";
import { ApiError } from "@/lib/api/client";

const JOB_POLL_INTERVAL = 2000; // 2 seconds

interface UseUpstreamSyncOptions {
  projectId: string;
  accessToken?: string;
  /** Disable initial fetch (e.g. when user doesn't have permission) */
  enabled?: boolean;
}

interface UseUpstreamSyncReturn {
  config: UpstreamSyncConfig | null;
  history: SyncEvent[];
  isLoading: boolean;
  isChecking: boolean;
  error: string | null;
  triggerCheck: () => Promise<void>;
  saveConfig: (data: UpstreamSyncConfigCreate | UpstreamSyncConfigUpdate) => Promise<void>;
  deleteConfig: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUpstreamSync({
  projectId,
  accessToken,
  enabled = true,
}: UseUpstreamSyncOptions): UseUpstreamSyncReturn {
  const [config, setConfig] = useState<UpstreamSyncConfig | null>(null);
  const [history, setHistory] = useState<SyncEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch config + history
  const fetchData = useCallback(async () => {
    if (!projectId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const configData = await upstreamSyncApi.getConfig(projectId, accessToken);
      setConfig(configData);

      // Fetch history if config exists
      try {
        const historyData = await upstreamSyncApi.getHistory(projectId, 20, accessToken);
        setHistory(historyData.items);
      } catch {
        // History may be empty, ignore
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No config — that's fine
        setConfig(null);
        setHistory([]);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load upstream sync config");
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, accessToken, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          const status = await upstreamSyncApi.getJobStatus(
            projectId,
            jobIdRef.current,
            accessToken
          );

          if (status.status === "complete" || status.status === "failed") {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
            jobIdRef.current = null;
            setIsChecking(false);

            if (status.status === "failed" && status.error) {
              setError(status.error);
            }

            // Refresh data after job completes
            await fetchData();
          }
        } catch {
          // Polling error — keep trying
        }
      }, JOB_POLL_INTERVAL);
    },
    [projectId, accessToken, fetchData]
  );

  // Trigger a manual check
  const triggerCheck = useCallback(async () => {
    if (!accessToken) return;

    setError(null);
    setIsChecking(true);

    try {
      const response = await upstreamSyncApi.triggerCheck(projectId, accessToken);
      startPolling(response.job_id);
    } catch (err) {
      setIsChecking(false);
      setError(err instanceof Error ? err.message : "Failed to trigger check");
    }
  }, [projectId, accessToken, startPolling]);

  // Save config
  const saveConfig = useCallback(
    async (data: UpstreamSyncConfigCreate | UpstreamSyncConfigUpdate) => {
      if (!accessToken) return;

      setError(null);

      try {
        const updated = await upstreamSyncApi.saveConfig(projectId, data, accessToken);
        setConfig(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save config";
        setError(msg);
        throw err;
      }
    },
    [projectId, accessToken]
  );

  // Delete config
  const deleteConfig = useCallback(async () => {
    if (!accessToken) return;

    setError(null);

    try {
      await upstreamSyncApi.deleteConfig(projectId, accessToken);
      setConfig(null);
      setHistory([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove config";
      setError(msg);
      throw err;
    }
  }, [projectId, accessToken]);

  return {
    config,
    history,
    isLoading,
    isChecking,
    error,
    triggerCheck,
    saveConfig,
    deleteConfig,
    refetch: fetchData,
  };
}
