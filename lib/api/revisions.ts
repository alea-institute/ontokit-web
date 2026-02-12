/**
 * Revisions and Branches API client
 */

import { api } from "./client";

// Types

export interface RevisionCommit {
  hash: string;
  short_hash: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: string;
  is_merge?: boolean;
  merged_branch?: string;
  parent_hashes: string[];
}

export interface RevisionHistoryResponse {
  project_id: string;
  commits: RevisionCommit[];
  total: number;
}

export interface RevisionDiffChange {
  path: string;
  change_type: string;
  old_path?: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface RevisionDiffResponse {
  project_id: string;
  from_version: string;
  to_version: string;
  files_changed: number;
  changes: RevisionDiffChange[];
}

export interface RevisionFileResponse {
  project_id: string;
  version: string;
  filename: string;
  content: string;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_default: boolean;
  commit_hash?: string;
  commit_message?: string;
  commit_date?: string;
  commits_ahead: number;
  commits_behind: number;
}

export interface BranchListResponse {
  items: BranchInfo[];
  current_branch: string;
  default_branch: string;
}

export interface BranchCreate {
  name: string;
  from_branch?: string;
}

export interface TripleChange {
  subject: string;
  predicate: string;
  object: string;
  change_type: "added" | "removed";
}

export interface SemanticDiffResponse {
  added: TripleChange[];
  removed: TripleChange[];
  total_added: number;
  total_removed: number;
}

// API functions
export const revisionsApi = {
  /**
   * Get revision history for a project
   */
  getHistory: (projectId: string, token?: string, limit = 50) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<RevisionHistoryResponse>(
      `/api/v1/projects/${projectId}/revisions`,
      {
        params: { limit },
        headers,
      }
    );
  },

  /**
   * Get file content at a specific revision
   */
  getFileAtVersion: (
    projectId: string,
    version: string,
    token?: string,
    filename = "ontology.ttl"
  ) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<RevisionFileResponse>(
      `/api/v1/projects/${projectId}/revisions/${version}/file`,
      {
        params: { filename },
        headers,
      }
    );
  },

  /**
   * Get diff between two revisions
   */
  getDiff: (
    projectId: string,
    fromVersion: string,
    toVersion = "HEAD",
    token?: string
  ) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<RevisionDiffResponse>(
      `/api/v1/projects/${projectId}/revisions/diff`,
      {
        params: { from_version: fromVersion, to_version: toVersion },
        headers,
      }
    );
  },
};

export const branchesApi = {
  /**
   * List all branches for a project
   */
  list: (projectId: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<BranchListResponse>(
      `/api/v1/projects/${projectId}/branches`,
      { headers }
    );
  },

  /**
   * Create a new branch
   */
  create: (projectId: string, data: BranchCreate, token: string) =>
    api.post<BranchInfo>(`/api/v1/projects/${projectId}/branches`, data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Switch to a different branch
   */
  switch: (projectId: string, branchName: string, token: string) =>
    api.post<BranchInfo>(
      `/api/v1/projects/${projectId}/branches/${encodeURIComponent(branchName)}/checkout`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Delete a branch
   */
  delete: (projectId: string, branchName: string, token: string, force = false) =>
    api.delete(
      `/api/v1/projects/${projectId}/branches/${encodeURIComponent(branchName)}`,
      {
        params: { force },
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};
