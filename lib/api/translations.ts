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
  verifier_provider: string | null;
  verifier_model: string | null;
  verifier_api_key?: string;
}

export interface TranslationLanguage {
  tag: string;
  name: string;
  native_name?: string;
}

const configPath = (projectId: string) =>
  `/api/v1/projects/${projectId}/translation/config`;

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
};
