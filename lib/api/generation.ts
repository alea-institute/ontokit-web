import { api } from "./client";

// ---- Type literals ----
export type SuggestionType = "children" | "siblings" | "annotations" | "parents" | "edges";
export type Provenance = "llm-proposed" | "user-written" | "user-edited-from-llm";
export type DuplicateVerdict = "pass" | "warn" | "block";

// ---- Validation error (matches backend ValidationError) ----
export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

// ---- Duplicate candidate ----
export interface DuplicateCandidate {
  iri: string;
  label: string;
  score: number;
}

// ---- Generated suggestion (union of class/annotation/edge subtypes) ----
export interface GeneratedSuggestion {
  iri: string;
  suggestion_type: SuggestionType;
  label: string;
  definition?: string | null;
  confidence?: number | null;
  provenance: Provenance;
  validation_errors: ValidationError[];
  duplicate_verdict: DuplicateVerdict;
  duplicate_candidates: DuplicateCandidate[];
  // AnnotationSuggestion extras
  property_iri?: string;
  value?: string;
  lang?: string | null;
  // EdgeSuggestion extras
  target_iri?: string;
  relationship_type?: string;
}

// ---- Request/Response ----
export interface GenerateSuggestionsRequest {
  class_iri: string;
  branch: string;
  suggestion_type: SuggestionType;
  batch_size?: number;
}

export interface GenerateSuggestionsResponse {
  suggestions: GeneratedSuggestion[];
  input_tokens: number;
  output_tokens: number;
  context_tokens_estimate?: number | null;
}

// ---- API client ----
export const generationApi = {
  generateSuggestions: (
    projectId: string,
    data: GenerateSuggestionsRequest,
    token: string,
    byoKey?: string,
  ) =>
    api.post<GenerateSuggestionsResponse>(
      `/api/v1/projects/${projectId}/llm/generate-suggestions`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(byoKey ? { "X-BYO-API-Key": byoKey } : {}),
        },
      },
    ),
};
