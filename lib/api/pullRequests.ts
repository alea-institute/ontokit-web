/**
 * Pull Requests API client
 */

import { api } from "./client";

// Types

export type PRStatus = "open" | "merged" | "closed";
export type ReviewStatus = "approved" | "changes_requested" | "commented";

export interface PRUser {
  id: string;
  name?: string;
  email?: string;
}

export interface PullRequest {
  id: string;
  project_id: string;
  pr_number: number;
  title: string;
  description?: string;
  source_branch: string;
  target_branch: string;
  status: PRStatus;
  author_id: string;
  author?: PRUser;
  github_pr_number?: number;
  github_pr_url?: string;
  merged_by?: string;
  merged_by_user?: PRUser;
  merged_at?: string;
  merge_commit_hash?: string;
  base_commit_hash?: string;
  head_commit_hash?: string;
  created_at: string;
  updated_at?: string;
  review_count: number;
  approval_count: number;
  comment_count: number;
  commits_ahead: number;
  can_merge: boolean;
}

export interface PRListResponse {
  items: PullRequest[];
  total: number;
  skip: number;
  limit: number;
}

export interface PRCreate {
  title: string;
  description?: string;
  source_branch: string;
  target_branch?: string;
}

export interface PRUpdate {
  title?: string;
  description?: string;
}

export interface PRMergeRequest {
  merge_message?: string;
  delete_source_branch?: boolean;
}

export interface PRMergeResponse {
  success: boolean;
  message: string;
  merged_at?: string;
  merge_commit_hash?: string;
}

export interface Review {
  id: string;
  pull_request_id: string;
  reviewer_id: string;
  reviewer?: PRUser;
  status: ReviewStatus;
  body?: string;
  github_review_id?: number;
  created_at: string;
}

export interface ReviewListResponse {
  items: Review[];
  total: number;
}

export interface ReviewCreate {
  status: ReviewStatus;
  body?: string;
}

export interface Comment {
  id: string;
  pull_request_id: string;
  author_id: string;
  author?: PRUser;
  body: string;
  parent_id?: string;
  github_comment_id?: number;
  created_at: string;
  updated_at?: string;
  replies: Comment[];
}

export interface CommentListResponse {
  items: Comment[];
  total: number;
}

export interface CommentCreate {
  body: string;
  parent_id?: string;
}

export interface CommentUpdate {
  body: string;
}

export interface PRCommit {
  hash: string;
  short_hash: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: string;
}

export interface PRCommitListResponse {
  items: PRCommit[];
  total: number;
}

export interface PRFileChange {
  path: string;
  change_type: "added" | "modified" | "deleted" | "renamed";
  old_path?: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRDiffResponse {
  files: PRFileChange[];
  total_additions: number;
  total_deletions: number;
  files_changed: number;
}

export interface GitHubIntegration {
  id: string;
  project_id: string;
  repo_owner: string;
  repo_name: string;
  repo_url?: string;
  connected_by_user_id?: string;
  webhooks_enabled: boolean;
  default_branch: string;
  ontology_file_path?: string;
  turtle_file_path?: string;
  sync_enabled: boolean;
  sync_status: string; // "idle" | "syncing" | "conflict" | "error"
  sync_error?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface GitHubIntegrationCreate {
  repo_owner: string;
  repo_name: string;
  default_branch?: string;
  webhooks_enabled?: boolean;
}

export interface GitHubIntegrationUpdate {
  default_branch?: string;
  sync_enabled?: boolean;
  webhooks_enabled?: boolean;
  ontology_file_path?: string;
  turtle_file_path?: string;
}

export interface PRSettings {
  pr_approval_required: number;
  github_integration?: GitHubIntegration;
}

export interface PRSettingsUpdate {
  pr_approval_required: number;
}

// API functions
export const pullRequestsApi = {
  /**
   * List pull requests for a project
   */
  list: (
    projectId: string,
    token?: string,
    status?: PRStatus,
    authorId?: string,
    skip = 0,
    limit = 20
  ) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<PRListResponse>(
      `/api/v1/projects/${projectId}/pull-requests`,
      {
        params: { status, author_id: authorId, skip, limit },
        headers,
      }
    );
  },

  /**
   * Get a pull request by number
   */
  get: (projectId: string, prNumber: number, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<PullRequest>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}`,
      { headers }
    );
  },

  /**
   * Create a new pull request
   */
  create: (projectId: string, data: PRCreate, token: string) =>
    api.post<PullRequest>(
      `/api/v1/projects/${projectId}/pull-requests`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Update a pull request
   */
  update: (
    projectId: string,
    prNumber: number,
    data: PRUpdate,
    token: string
  ) =>
    api.patch<PullRequest>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Close a pull request
   */
  close: (projectId: string, prNumber: number, token: string) =>
    api.post<PullRequest>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/close`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Reopen a closed pull request
   */
  reopen: (projectId: string, prNumber: number, token: string) =>
    api.post<PullRequest>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/reopen`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Merge a pull request
   */
  merge: (
    projectId: string,
    prNumber: number,
    data: PRMergeRequest,
    token: string
  ) =>
    api.post<PRMergeResponse>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/merge`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Get commits for a pull request
   */
  getCommits: (projectId: string, prNumber: number, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<PRCommitListResponse>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/commits`,
      { headers }
    );
  },

  /**
   * Get diff for a pull request
   */
  getDiff: (projectId: string, prNumber: number, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<PRDiffResponse>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/diff`,
      { headers }
    );
  },

  // Reviews

  /**
   * List reviews for a pull request
   */
  listReviews: (projectId: string, prNumber: number, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<ReviewListResponse>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/reviews`,
      { headers }
    );
  },

  /**
   * Create a review
   */
  createReview: (
    projectId: string,
    prNumber: number,
    data: ReviewCreate,
    token: string
  ) =>
    api.post<Review>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/reviews`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  // Comments

  /**
   * List comments for a pull request
   */
  listComments: (projectId: string, prNumber: number, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<CommentListResponse>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/comments`,
      { headers }
    );
  },

  /**
   * Create a comment
   */
  createComment: (
    projectId: string,
    prNumber: number,
    data: CommentCreate,
    token: string
  ) =>
    api.post<Comment>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/comments`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Update a comment
   */
  updateComment: (
    projectId: string,
    prNumber: number,
    commentId: string,
    data: CommentUpdate,
    token: string
  ) =>
    api.patch<Comment>(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/comments/${commentId}`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Delete a comment
   */
  deleteComment: (
    projectId: string,
    prNumber: number,
    commentId: string,
    token: string
  ) =>
    api.delete(
      `/api/v1/projects/${projectId}/pull-requests/${prNumber}/comments/${commentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};

// GitHub Integration API
export const githubIntegrationApi = {
  /**
   * Get GitHub integration for a project
   */
  get: (projectId: string, token: string) =>
    api.get<GitHubIntegration | null>(
      `/api/v1/projects/${projectId}/github-integration`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Create GitHub integration
   */
  create: (projectId: string, data: GitHubIntegrationCreate, token: string) =>
    api.post<GitHubIntegration>(
      `/api/v1/projects/${projectId}/github-integration`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Update GitHub integration
   */
  update: (projectId: string, data: GitHubIntegrationUpdate, token: string) =>
    api.patch<GitHubIntegration>(
      `/api/v1/projects/${projectId}/github-integration`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Delete GitHub integration
   */
  delete: (projectId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/github-integration`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// PR Settings API
export const prSettingsApi = {
  /**
   * Get PR settings for a project
   */
  get: (projectId: string, token: string) =>
    api.get<PRSettings>(`/api/v1/projects/${projectId}/pr-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Update PR settings
   */
  update: (projectId: string, data: PRSettingsUpdate, token: string) =>
    api.patch<PRSettings>(`/api/v1/projects/${projectId}/pr-settings`, data, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
