/**
 * API client for OntoKit backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Default headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  // Retry loop for 5xx errors (max 2 retries with exponential backoff)
  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url.toString(), {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new ApiError(response.status, response.statusText, message);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // This should never be reached due to the throw in the catch block,
  // but TypeScript needs it for type safety
  throw new Error("Unexpected: retry loop exited without returning or throwing");
}

/**
 * Upload a file using multipart/form-data
 */
async function uploadFile<T>(
  endpoint: string,
  formData: FormData,
  options: Omit<RequestOptions, "body"> = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Don't set Content-Type - browser will set it with boundary for FormData
  const headers = new Headers(fetchOptions.headers);
  headers.delete("Content-Type");

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, response.statusText, message);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  phase: "uploading" | "processing";
}

interface UploadWithProgressOptions {
  headers?: Record<string, string>;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Upload a file with progress tracking using XMLHttpRequest
 */
function uploadFileWithProgress<T>(
  endpoint: string,
  formData: FormData,
  options: UploadWithProgressOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${API_BASE}${endpoint}`;

    // 5-minute timeout for large file uploads + server-side processing
    xhr.timeout = 300000;

    // Track upload progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
          phase: "uploading",
        });
      }
    });

    // When upload completes, switch to processing phase
    xhr.upload.addEventListener("load", () => {
      if (options.onProgress) {
        options.onProgress({
          loaded: 100,
          total: 100,
          percentage: 100,
          phase: "processing",
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
          resolve(response as T);
        } catch {
          resolve(undefined as T);
        }
      } else {
        reject(new ApiError(xhr.status, xhr.statusText, xhr.responseText));
      }
    });

    xhr.addEventListener("error", async () => {
      // XHR "error" fires for both true network failures and CORS-blocked
      // server errors (e.g. a 500 without CORS headers). Probe the API root
      // to distinguish the two cases so the user gets an actionable message.
      let serverReachable = false;
      try {
        await fetch(`${API_BASE}/`, { method: "HEAD", mode: "cors" });
        serverReachable = true;
      } catch {
        // probe failed — server truly unreachable
      }

      reject(
        new ApiError(
          0,
          "Network Error",
          serverReachable
            ? "The server encountered an error processing your upload. Please try again or check the server logs."
            : "Could not reach the server. Please check that the API server is running and accessible."
        )
      );
    });

    xhr.addEventListener("timeout", () => {
      reject(
        new ApiError(
          0,
          "Timeout",
          "The upload timed out. The file may be too large for the server to process, or the server is not responding."
        )
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiError(0, "Aborted", "Upload was cancelled"));
    });

    xhr.open("POST", url);

    // Set headers (except Content-Type which is auto-set for FormData)
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "content-type") {
          xhr.setRequestHeader(key, value);
        }
      });
    }

    xhr.send(formData);
  });
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData, options?: Omit<RequestOptions, "body">) =>
    uploadFile<T>(endpoint, formData, options),

  uploadWithProgress: <T>(
    endpoint: string,
    formData: FormData,
    options?: UploadWithProgressOptions
  ) => uploadFileWithProgress<T>(endpoint, formData, options),
};

// Type-safe API methods for specific endpoints
export const ontologyApi = {
  list: (skip = 0, limit = 20) =>
    api.get<OntologyListResponse>("/api/v1/ontologies", { params: { skip, limit } }),

  get: (id: string, format = "application/ld+json") =>
    api.get<Ontology>(`/api/v1/ontologies/${id}`, {
      headers: { Accept: format },
    }),

  create: (data: OntologyCreate) =>
    api.post<Ontology>("/api/v1/ontologies", data),

  update: (id: string, data: OntologyUpdate) =>
    api.put<Ontology>(`/api/v1/ontologies/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/ontologies/${id}`),

  getHistory: (id: string, limit = 50) =>
    api.get<CommitHistory[]>(`/api/v1/ontologies/${id}/history`, { params: { limit } }),
};

export const classApi = {
  list: (ontologyId: string, parentIri?: string) =>
    api.get<OWLClassListResponse>(`/api/v1/ontologies/${ontologyId}/classes`, {
      params: { parent_iri: parentIri },
    }),

  get: (ontologyId: string, classIri: string) =>
    api.get<OWLClass>(`/api/v1/ontologies/${ontologyId}/classes/${encodeURIComponent(classIri)}`),

  create: (ontologyId: string, data: OWLClassCreate) =>
    api.post<OWLClass>(`/api/v1/ontologies/${ontologyId}/classes`, data),

  update: (ontologyId: string, classIri: string, data: OWLClassUpdate) =>
    api.put<OWLClass>(
      `/api/v1/ontologies/${ontologyId}/classes/${encodeURIComponent(classIri)}`,
      data
    ),

  delete: (ontologyId: string, classIri: string) =>
    api.delete(`/api/v1/ontologies/${ontologyId}/classes/${encodeURIComponent(classIri)}`),
};

// Types
export interface Ontology {
  id: string;
  iri: string;
  title: string;
  description?: string;
  prefix: string;
  created_at: string;
  updated_at: string;
  class_count: number;
  property_count: number;
  individual_count: number;
}

export interface OntologyListResponse {
  items: Ontology[];
  total: number;
  skip: number;
  limit: number;
}

export interface OntologyCreate {
  iri: string;
  title: string;
  description?: string;
  prefix: string;
}

export interface OntologyUpdate {
  title?: string;
  description?: string;
}

export interface OWLClass {
  iri: string;
  labels: LocalizedString[];
  comments: LocalizedString[];
  deprecated: boolean;
  parent_iris: string[];
  child_count: number;
  instance_count: number | null;
}

export interface OWLClassListResponse {
  items: OWLClass[];
  total: number;
}

export interface OWLClassCreate {
  iri: string;
  labels?: LocalizedString[];
  parent_iris?: string[];
}

export interface OWLClassUpdate {
  labels?: LocalizedString[];
  comments?: LocalizedString[];
  parent_iris?: string[];
}

export interface LocalizedString {
  value: string;
  lang: string;
}

export interface CommitHistory {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: string;
}

// Project ontology tree types
export interface OWLClassTreeNode {
  iri: string;
  label: string;
  child_count: number;
  deprecated: boolean;
}

export interface OWLClassTreeResponse {
  nodes: OWLClassTreeNode[];
  total_classes: number;
}

export interface AnnotationProperty {
  property_iri: string;
  property_label: string;
  values: LocalizedString[];
}

export interface OWLClassDetail {
  iri: string;
  labels: LocalizedString[];
  comments: LocalizedString[];
  deprecated: boolean;
  parent_iris: string[];
  parent_labels: Record<string, string>;  // Map of IRI to resolved label
  equivalent_iris: string[] | null;
  disjoint_iris: string[] | null;
  child_count: number;
  instance_count: number | null;
  is_defined: boolean;
  source_ontology?: string;
  annotations: AnnotationProperty[];  // DC, SKOS, and other annotation properties
}

// Project ontology tree API
export const projectOntologyApi = {
  /**
   * Get the root classes of the ontology tree
   */
  getRootClasses: (projectId: string, token?: string, branch?: string) =>
    api.get<OWLClassTreeResponse>(`/api/v1/projects/${projectId}/ontology/tree`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      params: { branch },
    }),

  /**
   * Get children of a specific class
   */
  getClassChildren: (projectId: string, classIri: string, token?: string, branch?: string) =>
    api.get<OWLClassTreeResponse>(
      `/api/v1/projects/${projectId}/ontology/tree/${encodeURIComponent(classIri)}/children`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  /**
   * Get ancestor path from root to a specific class
   */
  getClassAncestors: (projectId: string, classIri: string, token?: string, branch?: string) =>
    api.get<OWLClassTreeResponse>(
      `/api/v1/projects/${projectId}/ontology/tree/${encodeURIComponent(classIri)}/ancestors`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  /**
   * Get details of a specific class
   */
  getClassDetail: (projectId: string, classIri: string, token?: string, branch?: string) =>
    api.get<OWLClassDetail>(
      `/api/v1/projects/${projectId}/ontology/classes/${encodeURIComponent(classIri)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  /**
   * Search for entities in the ontology
   */
  searchEntities: (
    projectId: string,
    query: string,
    token?: string,
    branch?: string,
    entityTypes?: string,
  ) =>
    api.get<EntitySearchResponse>(
      `/api/v1/projects/${projectId}/ontology/search`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { q: query, branch, entity_types: entityTypes },
      }
    ),

  /**
   * Update a class in the ontology (labels, comments, parent classes)
   */
  updateClass: (
    projectId: string,
    classIri: string,
    data: ClassUpdatePayload,
    commitMessage: string,
    token: string,
    branch?: string
  ) =>
    api.patch<OWLClassDetail>(
      `/api/v1/projects/${projectId}/ontology/classes/${encodeURIComponent(classIri)}`,
      { ...data, commit_message: commitMessage },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),

  /**
   * Delete a class from the ontology
   */
  deleteClass: (
    projectId: string,
    classIri: string,
    commitMessage: string,
    token: string,
    branch?: string
  ) =>
    api.delete(`/api/v1/projects/${projectId}/ontology/classes/${encodeURIComponent(classIri)}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { commit_message: commitMessage, branch },
    }),

  /**
   * Trigger a reindex of the ontology's PostgreSQL search index.
   * Only available to project owners and admins.
   * Returns 202 Accepted when the reindex job is queued.
   */
  reindex: (projectId: string, token: string, branch?: string) =>
    api.post<ReindexResponse>(
      `/api/v1/projects/${projectId}/ontology/reindex`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),

  /**
   * Get the current index status for a project branch.
   */
  getIndexStatus: (projectId: string, token?: string, branch?: string) =>
    api.get<IndexStatusResponse>(
      `/api/v1/projects/${projectId}/ontology/index-status`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  /**
   * Save ontology source content
   */
  saveSource: (
    projectId: string,
    content: string,
    commitMessage: string,
    token: string,
    branch?: string
  ) =>
    api.put<SourceContentSaveResponse>(
      `/api/v1/projects/${projectId}/source`,
      { content, commit_message: commitMessage },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),
};

// Re-export semantic search / quality / analytics / remote sync APIs for convenience
export { embeddingsApi } from "./embeddings";
export { qualityApi } from "./quality";
export { analyticsApi } from "./analytics";
export { remoteSyncApi } from "./remoteSync";

// Annotation update — a single annotation property with its values
export interface AnnotationUpdate {
  property_iri: string;
  values: LocalizedString[];
}

// Class update payload for structured editing
export interface ClassUpdatePayload {
  labels: LocalizedString[];
  comments: LocalizedString[];
  parent_iris: string[];
  annotations?: AnnotationUpdate[];
  // Preserved fields (not edited by form, but needed for Turtle source generation)
  deprecated?: boolean;
  equivalent_iris?: string[];
  disjoint_iris?: string[];
}

// Entity search types
export interface EntitySearchResult {
  iri: string;
  label: string;
  entity_type: "class" | "property" | "individual";
  deprecated: boolean;
}

export interface EntitySearchResponse {
  results: EntitySearchResult[];
  total: number;
}

// Ontology index types
export interface ReindexResponse {
  status: "accepted";
  branch: string;
}

export type IndexStatus = "pending" | "indexing" | "ready" | "failed";

export interface IndexStatusResponse {
  project_id: string;
  branch: string;
  status: IndexStatus;
  entity_count: number | null;
  commit_hash: string | null;
  error_message: string | null;
  indexed_at: string | null;
}

// Source content types
export interface SourceContentSaveResponse {
  success: boolean;
  commit_hash: string;
  commit_message: string;
  branch: string;
}
