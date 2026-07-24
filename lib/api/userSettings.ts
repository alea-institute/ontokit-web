/**
 * User Settings API client.
 *
 * The GitHub PAT WRITE surface is retired (R3/KD6): all mirror operations now
 * authenticate as the system mirror identity, and a lay contributor should
 * never be asked for a GitHub credential. `getGitHubTokenStatus` remains
 * read-only for one release so a project mid-migration renders coherently.
 *
 * `commitIdentity` is what replaces it in the UI: how a contributor's commits
 * are credited in public git history (R14, R15).
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

export interface CommitIdentity {
  display_name?: string | null;
  /** The synthetic alias used by default. Never a real address. */
  noreply_alias: string;
  commit_email?: string | null;
  commit_email_verified: boolean;
  use_verified_email: boolean;
  /** The address that will actually appear in the next commit. */
  effective_email: string;
}

export interface CommitIdentityUpdate {
  commit_email?: string | null;
  use_verified_email?: boolean;
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

export interface UserSearchResult {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
}

export interface UserSearchResponse {
  items: UserSearchResult[];
  total: number;
}

// API functions

export const userSettingsApi = {
  /** Check if the user has a stored GitHub token. */
  getGitHubTokenStatus: (token: string) =>
    api.get<GitHubTokenStatus>("/api/v1/users/me/github-token", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** How this contributor's commits are authored in public git history. */
  getCommitIdentity: (token: string) =>
    api.get<CommitIdentity>("/api/v1/users/me/commit-identity", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Set the opt-in authoring address, or toggle its use. */
  updateCommitIdentity: (data: CommitIdentityUpdate, token: string) =>
    api.patch<CommitIdentity>("/api/v1/users/me/commit-identity", data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Search Zitadel users by username, email, or display name. */
  searchUsers: (token: string, query: string, limit = 10) =>
    api.get<UserSearchResponse>("/api/v1/users/search", {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, limit },
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
