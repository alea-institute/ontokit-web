/**
 * Upstream Sync API client
 *
 * Manages configuration and triggering of upstream source tracking
 * for external GitHub repositories (e.g., FOLIO).
 */

import { api } from "./client";

// --- Types ---

export type SyncFrequency = "6h" | "12h" | "24h" | "48h" | "weekly" | "manual";
export type SyncUpdateMode = "auto_apply" | "review_required";
export type UpstreamSyncStatus =
  | "idle"
  | "checking"
  | "update_available"
  | "up_to_date"
  | "error";

export interface UpstreamSyncConfig {
  id: string;
  project_id: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  file_path: string;
  frequency: SyncFrequency;
  enabled: boolean;
  update_mode: SyncUpdateMode;
  status: UpstreamSyncStatus;
  last_check_at: string | null;
  last_update_at: string | null;
  next_check_at: string | null;
  upstream_commit_sha: string | null;
  pending_pr_id: string | null;
  error_message: string | null;
}

export interface UpstreamSyncConfigCreate {
  repo_owner: string;
  repo_name: string;
  branch?: string;
  file_path: string;
  frequency?: SyncFrequency;
  enabled?: boolean;
  update_mode?: SyncUpdateMode;
}

export interface UpstreamSyncConfigUpdate {
  repo_owner?: string;
  repo_name?: string;
  branch?: string;
  file_path?: string;
  frequency?: SyncFrequency;
  enabled?: boolean;
  update_mode?: SyncUpdateMode;
}

export interface SyncEvent {
  id: string;
  project_id: string;
  config_id: string;
  event_type:
    | "check_no_changes"
    | "update_found"
    | "auto_applied"
    | "pr_created"
    | "error";
  upstream_commit_sha: string | null;
  pr_id: string | null;
  changes_summary: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SyncHistoryResponse {
  items: SyncEvent[];
  total: number;
}

export interface SyncCheckResponse {
  message: string;
  job_id: string;
  status: string;
}

export interface SyncJobStatusResponse {
  job_id: string;
  status: "pending" | "running" | "complete" | "failed" | "not_found";
  result: Record<string, unknown> | null;
  error: string | null;
}

// --- API ---

export const upstreamSyncApi = {
  /**
   * Get upstream sync configuration for a project.
   * Returns the config or throws 404 if not configured.
   */
  getConfig: (projectId: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<UpstreamSyncConfig | null>(
      `/api/v1/projects/${projectId}/upstream-sync`,
      { headers }
    );
  },

  /**
   * Create or update upstream sync configuration.
   */
  saveConfig: (
    projectId: string,
    data: UpstreamSyncConfigCreate | UpstreamSyncConfigUpdate,
    token: string
  ) =>
    api.put<UpstreamSyncConfig>(
      `/api/v1/projects/${projectId}/upstream-sync`,
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    ),

  /**
   * Remove upstream sync configuration.
   */
  deleteConfig: (projectId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/upstream-sync`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Trigger a manual upstream check. Returns a job ID for polling.
   */
  triggerCheck: (projectId: string, token: string) =>
    api.post<SyncCheckResponse>(
      `/api/v1/projects/${projectId}/upstream-sync/check`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    ),

  /**
   * Get status of a background check job.
   */
  getJobStatus: (projectId: string, jobId: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<SyncJobStatusResponse>(
      `/api/v1/projects/${projectId}/upstream-sync/jobs/${jobId}`,
      { headers }
    );
  },

  /**
   * Get sync event history for a project.
   */
  getHistory: (projectId: string, limit: number = 20, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<SyncHistoryResponse>(
      `/api/v1/projects/${projectId}/upstream-sync/history`,
      { params: { limit }, headers }
    );
  },
};
