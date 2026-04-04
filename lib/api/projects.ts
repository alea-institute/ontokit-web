/**
 * Projects API client
 */

import { api, type UploadProgress } from "./client";

// Types
export type ProjectRole = "owner" | "admin" | "editor" | "suggester" | "viewer";

export interface ProjectOwner {
  id: string;
  name?: string;
  email?: string;
}

export interface NormalizationReport {
  original_format: string;
  original_filename: string;
  original_size_bytes: number;
  normalized_size_bytes: number;
  triple_count: number;
  prefixes_before: string[];
  prefixes_after: string[];
  prefixes_removed: string[];
  prefixes_added: string[];
  format_converted: boolean;
  notes: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  owner_id: string;
  owner?: ProjectOwner;
  created_at: string;
  updated_at?: string;
  member_count: number;
  user_role?: ProjectRole;
  is_superadmin?: boolean;  // Whether the current user is a superadmin
  // Import-related fields (optional, only set when project was created via import)
  source_file_path?: string;
  git_ontology_path?: string;
  ontology_iri?: string;
  // Label preferences for ontology display
  label_preferences?: string[];
  // Normalization report from initial import
  normalization_report?: NormalizationReport;
  // Exemplar ontology fields
  is_exemplar?: boolean;
  exemplar_slug?: string;
  exemplar_source_url?: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  skip: number;
  limit: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  is_public?: boolean;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  is_public?: boolean;
  label_preferences?: string[];
}

export interface MemberUser {
  id: string;
  name?: string;
  email?: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  user?: MemberUser;
  created_at: string;
}

export interface MemberListResponse {
  items: ProjectMember[];
  total: number;
}

export interface MemberCreate {
  user_id: string;
  role?: ProjectRole;
}

export interface MemberUpdate {
  role: ProjectRole;
}

export interface TransferOwnership {
  new_owner_id: string;
}

export interface ProjectImportResponse extends Project {
  ontology_iri?: string;
  file_path: string;
}

export interface ProjectImportData {
  file: File;
  is_public: boolean;
  name?: string;
  description?: string;
}

// GitHub clone types
export interface GitHubRepoFileInfo {
  path: string;
  name: string;
  size: number;
}

export interface GitHubRepoFilesResponse {
  items: GitHubRepoFileInfo[];
  total: number;
}

export interface ProjectCreateFromGitHub {
  repo_owner: string;
  repo_name: string;
  ontology_file_path: string;
  turtle_file_path?: string;
  is_public: boolean;
  name?: string;
  description?: string;
  default_branch?: string;
}

// API functions
export const projectApi = {
  /**
   * List accessible projects
   * @param skip - Pagination offset
   * @param limit - Maximum results
   * @param filter - Filter type: 'public', 'mine', or undefined for all accessible
   * @param token - Access token for authentication
   */
  list: (skip = 0, limit = 20, filter?: "public" | "mine", token?: string, search?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<ProjectListResponse>("/api/v1/projects", {
      params: { skip, limit, filter, search: search || undefined },
      headers,
    });
  },

  /**
   * Get a project by ID
   */
  get: (id: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return api.get<Project>(`/api/v1/projects/${id}`, { headers });
  },

  /**
   * Create a new project
   */
  create: (data: ProjectCreate, token: string) =>
    api.post<Project>("/api/v1/projects", data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Import a project from an ontology file
   * @param data - Import data including file and metadata
   * @param token - Access token
   * @param onProgress - Optional progress callback for upload tracking
   */
  import: (
    data: ProjectImportData,
    token: string,
    onProgress?: (progress: UploadProgress) => void
  ) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("is_public", String(data.is_public));
    if (data.name) {
      formData.append("name", data.name);
    }
    if (data.description) {
      formData.append("description", data.description);
    }

    // Use progress-enabled upload if callback provided
    if (onProgress) {
      return api.uploadWithProgress<ProjectImportResponse>(
        "/api/v1/projects/import",
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
          onProgress,
        }
      );
    }

    return api.upload<ProjectImportResponse>("/api/v1/projects/import", formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Update a project
   */
  update: (id: string, data: ProjectUpdate, token: string) =>
    api.patch<Project>(`/api/v1/projects/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Delete a project
   */
  delete: (id: string, token: string) =>
    api.delete(`/api/v1/projects/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Scan a GitHub repo for ontology files
   */
  scanGitHubRepoFiles: (
    owner: string,
    repo: string,
    token: string,
    ref?: string
  ) =>
    api.get<GitHubRepoFilesResponse>("/api/v1/projects/github/scan-files", {
      params: { owner, repo, ref },
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Create a project from a GitHub repository
   */
  createFromGitHub: (data: ProjectCreateFromGitHub, token: string) =>
    api.post<ProjectImportResponse>("/api/v1/projects/from-github", data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Member management

  /**
   * List project members
   */
  listMembers: (projectId: string, token: string) =>
    api.get<MemberListResponse>(`/api/v1/projects/${projectId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Add a member to a project
   */
  addMember: (projectId: string, data: MemberCreate, token: string) =>
    api.post<ProjectMember>(`/api/v1/projects/${projectId}/members`, data, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Update a member's role
   */
  updateMember: (
    projectId: string,
    userId: string,
    data: MemberUpdate,
    token: string
  ) =>
    api.patch<ProjectMember>(
      `/api/v1/projects/${projectId}/members/${userId}`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Remove a member from a project
   */
  removeMember: (projectId: string, userId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/members/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Transfer project ownership to an admin member
   * @param force - If true, proceed even if GitHub integration will be disconnected
   */
  transferOwnership: (
    projectId: string,
    data: TransferOwnership,
    token: string,
    force?: boolean
  ) =>
    api.post<MemberListResponse>(
      `/api/v1/projects/${projectId}/transfer-ownership`,
      data,
      {
        params: { force },
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};
