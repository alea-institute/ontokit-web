import { api } from "./client";

export type TranslationVerificationMechanism = "consensus" | "confidence";
export type TranslationSpeedMode = "batch" | "fast";

export interface TranslationConfigResponse {
  language_set: string[];
  verification_mechanism: TranslationVerificationMechanism;
  consensus_threshold: number;
  confidence_threshold: number;
  translate_definitions: boolean;
  translate_examples: boolean;
  speed_mode: TranslationSpeedMode;
  provisional_gate: boolean;
  primary_provider: string | null;
  primary_model: string | null;
  verifier_provider: string | null;
  verifier_model: string | null;
  verifier_api_key_set: boolean;
}

export interface TranslationConfigUpdate {
  language_set: string[];
  verification_mechanism: TranslationVerificationMechanism;
  consensus_threshold: number;
  confidence_threshold: number;
  translate_definitions: boolean;
  translate_examples: boolean;
  speed_mode: TranslationSpeedMode;
  provisional_gate: boolean;
  primary_provider: string | null;
  primary_model: string | null;
  verifier_provider: string | null;
  verifier_model: string | null;
  verifier_api_key?: string;
}

export interface TranslationLanguage {
  tag: string;
  name: string;
  native_name?: string;
}

export type TranslationEntityState = "verified" | "provisional" | "pending" | "missing";

export interface TranslationEntityStateItem {
  predicate: string;
  language: string;
  state: TranslationEntityState;
  value: string | null;
  record_id: string | null;
}

export interface TranslationEntityStateResponse {
  entity_iri: string;
  branch: string;
  items: TranslationEntityStateItem[];
}

export type OnDemandTranslationPredicate = "skos:definition" | "skos:example";

export interface TranslationCoverageLanguage {
  language: string;
  verified: number;
  provisional: number;
  pending: number;
  missing: number;
  total: number;
}

export interface TranslationCoverageResponse {
  branch: string;
  languages: TranslationCoverageLanguage[];
  total_entities: number;
}

export interface TranslationBackfillFilters {
  branch: string;
  language?: string;
  era_before?: string;
  never_confirmed?: boolean;
}

export interface TranslationBackfillPreview {
  literal_count: number;
  expected_cost_usd: number;
  upper_bound_cost_usd: number;
  batch_discount_applied: boolean;
}

export interface TranslationBackfillStatus {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  error: string | null;
}

export interface ProvisionalTranslationRecord {
  record_id: string;
  entity_iri: string;
  predicate: string;
  language: string;
  source_value: string;
  proposed_value: string;
  model_name: string;
  method: string;
  score: number;
  created_at: string;
}

export interface ReviewerLanguagesResponse {
  languages: string[];
}

export interface TranslationRecordSummary {
  record_id: string;
  [key: string]: unknown;
}

export interface BulkTranslationConfirmResult {
  record_id: string;
  ok: boolean;
  error: string | null;
}

const configPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/config`;
const entityStatePath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/entity-state`;
const translateFieldPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/entities/translate-field`;
const coveragePath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/coverage`;
const backfillPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/backfill`;
const translationPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation`;
const translationRecordPath = (projectId: string, recordId: string) =>
  `${translationPath(projectId)}/records/${recordId}`;

export const translationsApi = {
  listProvisional: (projectId: string, language: string, branch: string, token: string) =>
    api.get<ProvisionalTranslationRecord[]>(`${translationPath(projectId)}/provisional`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { language, branch },
    }),

  getMyReviewerLanguages: (projectId: string, token: string) =>
    api.get<ReviewerLanguagesResponse>(`${translationPath(projectId)}/my-reviewer-languages`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  confirmRecord: (projectId: string, recordId: string, branch: string, token: string) =>
    api.post<TranslationRecordSummary>(`${translationRecordPath(projectId, recordId)}/confirm`, { branch }, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  rejectRecord: (projectId: string, recordId: string, branch: string, token: string) =>
    api.post<TranslationRecordSummary>(`${translationRecordPath(projectId, recordId)}/reject`, { branch }, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  confirmBulk: (projectId: string, recordIds: string[], branch: string, token: string) =>
    api.post<{ results: BulkTranslationConfirmResult[] }>(`${translationPath(projectId)}/records/confirm-bulk`, {
      branch,
      record_ids: recordIds,
    }, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  getConfig: (projectId: string, token: string) =>
    api.get<TranslationConfigResponse>(configPath(projectId), {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateConfig: (
    projectId: string,
    config: TranslationConfigUpdate,
    token: string,
  ) =>
    api.put<TranslationConfigResponse>(configPath(projectId), config, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  getPalette: () =>
    api.get<TranslationLanguage[]>("/api/v1/translation/palette"),

  getEntityState: (
    projectId: string,
    entityIri: string,
    branch: string,
    token: string,
  ) =>
    api.get<TranslationEntityStateResponse>(entityStatePath(projectId), {
      headers: { Authorization: `Bearer ${token}` },
      params: { entity_iri: entityIri, branch },
    }),

  translateField: (
    projectId: string,
    body: { entity_iri: string; predicate: OnDemandTranslationPredicate; branch: string },
    token: string,
  ) =>
    api.post<{ job_id: string }>(translateFieldPath(projectId), body, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  getCoverage: (projectId: string, branch: string, token: string) =>
    api.get<TranslationCoverageResponse>(coveragePath(projectId), {
      headers: { Authorization: `Bearer ${token}` },
      params: { branch },
    }),

  previewBackfill: (
    projectId: string,
    filters: TranslationBackfillFilters,
    token: string,
  ) =>
    api.get<TranslationBackfillPreview>(`${backfillPath(projectId)}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        branch: filters.branch,
        language: filters.language,
        era_before: filters.era_before,
        never_confirmed: filters.never_confirmed,
      },
    }),

  launchBackfill: (
    projectId: string,
    filters: TranslationBackfillFilters,
    token: string,
  ) =>
    api.post<{ job_id: string }>(backfillPath(projectId), filters, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  getBackfillStatus: (projectId: string, branch: string, token: string) =>
    api.get<TranslationBackfillStatus | null>(`${backfillPath(projectId)}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { branch },
    }),
};
