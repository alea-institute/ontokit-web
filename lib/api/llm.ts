/**
 * API client for LLM configuration, usage, and connection management
 */

import { api } from "./client";

// ── Provider Types ────────────────────────────────────────────────────
export type LLMProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "meta_llama"
  | "ollama"
  | "lmstudio"
  | "custom"
  | "groq"
  | "xai"
  | "github_models"
  | "llamafile";

export type ModelTier = "quality" | "cheap";

// ── Config ────────────────────────────────────────────────────────────
export interface LLMConfigResponse {
  provider: LLMProviderType;
  model: string | null;
  model_tier: ModelTier;
  api_key_set: boolean; // NEVER the actual key
  base_url: string | null;
  monthly_budget_usd: number | null;
  daily_cap_usd: number | null;
}

export interface LLMConfigUpdate {
  provider: LLMProviderType;
  model?: string | null;
  model_tier?: ModelTier;
  api_key?: string; // write-only, sent on save
  base_url?: string | null;
  monthly_budget_usd?: number | null;
  daily_cap_usd?: number | null;
}

// ── Status ────────────────────────────────────────────────────────────
export interface LLMStatusResponse {
  configured: boolean;
  provider: LLMProviderType | null;
  budget_exhausted: boolean;
  daily_remaining: number | null; // null = unlimited (admin/owner)
  monthly_budget_usd: number | null;
  monthly_spent_usd: number;
  burn_rate_daily_usd: number;
}

// ── Usage Dashboard ───────────────────────────────────────────────────
export interface LLMUserUsage {
  user_id: string;
  user_name: string | null;
  calls_today: number;
  calls_this_month: number;
  cost_this_month_usd: number;
  is_byo_key: boolean;
}

export interface LLMUsageResponse {
  total_calls: number;
  total_cost_usd: number;
  budget_consumed_pct: number | null;
  burn_rate_daily_usd: number;
  users: LLMUserUsage[];
}

// ── Provider Info ─────────────────────────────────────────────────────
export interface LLMProviderInfo {
  provider: LLMProviderType;
  display_name: string;
  requires_api_key: boolean;
  icon_name: string;
}

export interface LLMKnownModel {
  provider: LLMProviderType;
  model_id: string;
  display_name: string;
  tier: ModelTier;
}

// ── Connection Test ───────────────────────────────────────────────────
export interface ConnectionTestResponse {
  success: boolean;
  error?: string;
}

// ── API Client ────────────────────────────────────────────────────────
export const llmApi = {
  getConfig: (projectId: string, token: string) =>
    api.get<LLMConfigResponse>(`/api/v1/projects/${projectId}/llm/config`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateConfig: (
    projectId: string,
    config: LLMConfigUpdate,
    token: string
  ) =>
    api.put<LLMConfigResponse>(
      `/api/v1/projects/${projectId}/llm/config`,
      config,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  testConnection: (
    projectId: string,
    token: string,
    byoKey?: string
  ) =>
    api.post<ConnectionTestResponse>(
      `/api/v1/projects/${projectId}/llm/test-connection`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(byoKey ? { "X-BYO-API-Key": byoKey } : {}),
        },
      }
    ),

  getUsage: (projectId: string, token: string) =>
    api.get<LLMUsageResponse>(`/api/v1/projects/${projectId}/llm/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getStatus: (projectId: string, token: string) =>
    api.get<LLMStatusResponse>(`/api/v1/projects/${projectId}/llm/status`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getProviders: () =>
    api.get<LLMProviderInfo[]>(`/api/v1/llm/providers`),

  getKnownModels: () =>
    api.get<LLMKnownModel[]>(`/api/v1/llm/known-models`),
};
