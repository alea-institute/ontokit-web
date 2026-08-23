import { api } from "./client";
import type { DuplicateEntityType } from "./generation";

export interface DistinctDecisionMark {
  proposed_iri: string;
  label: string;
  candidate_iri: string;
  candidate_branch?: string | null;
  entity_type: DuplicateEntityType;
  parent_iri?: string | null;
  suggestion_session_id?: string;
  reason: string;
}

export interface DistinctDecision {
  id: string;
  project_id: string;
  iri_a: string;
  iri_b: string;
  fingerprint_a: string;
  fingerprint_b: string;
  reason: string;
  marked_by: string;
  marked_at: string;
  suggestion_session_id?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  superseded_by_id?: string | null;
}

export interface DistinctDecisionListOptions {
  includeInactive?: boolean;
  skip?: number;
  limit?: number;
}

const endpoint = (projectId: string) =>
  `/api/v1/projects/${projectId}/duplicate-check/distinct-decisions`;

export const distinctDecisionsApi = {
  mark: (projectId: string, data: DistinctDecisionMark, token: string) =>
    api.post<DistinctDecision>(endpoint(projectId), data, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),

  list: (
    projectId: string,
    token: string,
    options: DistinctDecisionListOptions = {},
  ) => {
    const { includeInactive = false, skip = 0, limit = 50 } = options;
    return api.get<DistinctDecision[]>(endpoint(projectId), {
      params: { include_inactive: includeInactive, skip, limit },
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  revoke: (projectId: string, decisionId: string, token: string) =>
    api.delete<DistinctDecision>(`${endpoint(projectId)}/${decisionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      retryOn5xx: false,
    }),
};
