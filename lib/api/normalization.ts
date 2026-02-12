/**
 * Normalization API client
 */

import { api } from "./client";
import { NormalizationReport } from "./projects";

// Types
export interface NormalizationStatusResponse {
  needs_normalization: boolean;
  last_run: string | null;
  last_run_id: string | null;
  preview_report: NormalizationReport | null;
  error: string | null;
}

export interface NormalizationRunResponse {
  id: string;
  project_id: string;
  created_at: string;
  triggered_by: string | null;
  trigger_type: string;
  report: NormalizationReport;
  is_dry_run: boolean;
  commit_hash: string | null;
  // For dry runs, includes content for diff preview
  original_content: string | null;
  normalized_content: string | null;
}

export interface NormalizationHistoryResponse {
  items: NormalizationRunResponse[];
  total: number;
}

export interface NormalizationTriggerRequest {
  dry_run?: boolean;
}

// API functions
export const normalizationApi = {
  /**
   * Get normalization status for a project
   * Returns whether normalization is needed and a preview of what would change
   */
  getStatus: (projectId: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<NormalizationStatusResponse>(
      `/api/v1/projects/${projectId}/normalization/status`,
      { headers }
    );
  },

  /**
   * Trigger normalization on a project
   * @param projectId - The project ID
   * @param dryRun - If true, preview changes without applying them
   * @param token - Access token
   */
  runNormalization: (
    projectId: string,
    dryRun: boolean = false,
    token: string
  ) =>
    api.post<NormalizationRunResponse>(
      `/api/v1/projects/${projectId}/normalization`,
      { dry_run: dryRun },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Get normalization run history for a project
   * @param projectId - The project ID
   * @param limit - Maximum number of results
   * @param includeDryRuns - Include dry run records
   * @param token - Access token
   */
  getHistory: (
    projectId: string,
    limit: number = 10,
    includeDryRuns: boolean = false,
    token?: string
  ) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<NormalizationHistoryResponse>(
      `/api/v1/projects/${projectId}/normalization/history`,
      {
        params: { limit, include_dry_runs: includeDryRuns },
        headers,
      }
    );
  },

  /**
   * Get a specific normalization run
   * @param projectId - The project ID
   * @param runId - The normalization run ID
   * @param token - Access token
   */
  getRun: (projectId: string, runId: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<NormalizationRunResponse>(
      `/api/v1/projects/${projectId}/normalization/runs/${runId}`,
      { headers }
    );
  },
};
