/**
 * User Settings API client — GitHub token management and repo listing.
 */

import { api } from "./client";

// Types

export interface GitHubTokenStatus {
  has_token: boolean;
  github_username?: string;
}

export interface GitHubTokenResponse {
  github_username?: string;
  token_scopes?: string;
  token_preview?: string;
  created_at: string;
  updated_at?: string;
}

export interface GitHubRepoInfo {
  full_name: string;
  owner: string;
  name: string;
  description?: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface GitHubRepoListResponse {
  items: GitHubRepoInfo[];
  total: number;
}

// API functions

export const userSettingsApi = {
  /** Check if the user has a stored GitHub token. */
  getGitHubTokenStatus: (token: string) =>
    api.get<GitHubTokenStatus>("/api/v1/users/me/github-token", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Validate and store a GitHub PAT. */
  saveGitHubToken: (pat: string, token: string) =>
    api.post<GitHubTokenResponse>(
      "/api/v1/users/me/github-token",
      { token: pat },
      { headers: { Authorization: `Bearer ${token}` } }
    ),

  /** Remove the stored GitHub PAT. */
  deleteGitHubToken: (token: string) =>
    api.delete("/api/v1/users/me/github-token", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** List GitHub repos accessible via the stored PAT. */
  listGitHubRepos: (
    token: string,
    query?: string,
    page = 1,
    perPage = 30
  ) =>
    api.get<GitHubRepoListResponse>("/api/v1/users/me/github-repos", {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, page, per_page: perPage },
    }),
};
