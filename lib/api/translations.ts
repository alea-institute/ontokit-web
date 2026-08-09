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

const configPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/config`;
const entityStatePath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/entity-state`;
const translateFieldPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/entities/translate-field`;

export const translationsApi = {
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
};
