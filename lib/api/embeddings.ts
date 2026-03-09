/**
 * API client for embedding management: config, generation, status
 */

import { api } from "./client";

export type EmbeddingProvider = "local" | "openai" | "voyage" | "anthropic";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model_name: string;
  api_key_set: boolean;
  dimensions: number;
  auto_embed_on_save: boolean;
  last_full_embed_at?: string;
}

export interface EmbeddingConfigUpdate {
  provider: EmbeddingProvider;
  model_name: string;
  api_key?: string;
  auto_embed_on_save: boolean;
}

export interface EmbeddingStatus {
  total_entities: number;
  embedded_entities: number;
  coverage_percent: number;
  provider: EmbeddingProvider;
  model_name: string;
  job_in_progress: boolean;
  job_progress_percent?: number;
  last_full_embed_at?: string;
}

export interface SemanticSearchResult {
  iri: string;
  label: string;
  entity_type: "class" | "property" | "individual";
  score: number;
  deprecated: boolean;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  search_mode: "semantic" | "hybrid" | "text_fallback";
}

export interface SimilarEntity {
  iri: string;
  label: string;
  entity_type: string;
  score: number;
  deprecated: boolean;
}

export interface RankSuggestionsRequest {
  context_iri: string;
  candidates: string[];
  relationship: "parent" | "equivalent" | "domain" | "range";
}

export interface RankedCandidate {
  iri: string;
  label: string;
  score: number;
}

export const embeddingsApi = {
  getConfig: (projectId: string, token: string) =>
    api.get<EmbeddingConfig>(
      `/api/v1/projects/${projectId}/embeddings/config`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  updateConfig: (
    projectId: string,
    config: EmbeddingConfigUpdate,
    token: string
  ) =>
    api.put<EmbeddingConfig>(
      `/api/v1/projects/${projectId}/embeddings/config`,
      config,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  triggerGeneration: (projectId: string, token: string, branch?: string) =>
    api.post<{ job_id: string }>(
      `/api/v1/projects/${projectId}/embeddings/generate`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),

  getStatus: (projectId: string, token: string, branch?: string) =>
    api.get<EmbeddingStatus>(
      `/api/v1/projects/${projectId}/embeddings/status`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),

  clear: (projectId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/embeddings`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  semanticSearch: (
    projectId: string,
    query: string,
    token?: string,
    branch?: string,
    limit = 20,
    threshold = 0.3
  ) =>
    api.get<SemanticSearchResponse>(
      `/api/v1/projects/${projectId}/search/semantic`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { q: query, branch, limit, threshold },
      }
    ),

  getSimilarEntities: (
    projectId: string,
    entityIri: string,
    token?: string,
    branch?: string,
    limit = 10,
    threshold = 0.5
  ) =>
    api.get<SimilarEntity[]>(
      `/api/v1/projects/${projectId}/entities/${encodeURIComponent(entityIri)}/similar`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch, limit, threshold },
      }
    ),

  rankSuggestions: (
    projectId: string,
    body: RankSuggestionsRequest,
    token?: string
  ) =>
    api.post<RankedCandidate[]>(
      `/api/v1/projects/${projectId}/entities/rank-suggestions`,
      body,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),
};
