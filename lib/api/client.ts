/**
 * API client for Axigraph backend
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

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
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
  instance_count: number;
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
  equivalent_iris: string[];
  disjoint_iris: string[];
  child_count: number;
  instance_count: number;
  is_defined: boolean;
  source_ontology?: string;
  annotations: AnnotationProperty[];  // DC, SKOS, and other annotation properties
}

// Project ontology tree API
export const projectOntologyApi = {
  /**
   * Get the root classes of the ontology tree
   */
  getRootClasses: (projectId: string, token?: string) =>
    api.get<OWLClassTreeResponse>(`/api/v1/projects/${projectId}/ontology/tree`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),

  /**
   * Get children of a specific class
   */
  getClassChildren: (projectId: string, classIri: string, token?: string) =>
    api.get<OWLClassTreeResponse>(
      `/api/v1/projects/${projectId}/ontology/tree/${encodeURIComponent(classIri)}/children`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),

  /**
   * Get details of a specific class
   */
  getClassDetail: (projectId: string, classIri: string, token?: string) =>
    api.get<OWLClassDetail>(
      `/api/v1/projects/${projectId}/ontology/classes/${encodeURIComponent(classIri)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),
};
