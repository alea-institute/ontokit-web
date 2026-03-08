/**
 * API client for quality features: cross-references, consistency checks, duplicate detection
 */

import { api } from "./client";
import type {
  CrossReferencesResponse,
  ConsistencyCheckResult,
  DuplicateDetectionResult,
} from "@/lib/ontology/qualityTypes";

export const qualityApi = {
  getCrossReferences: (
    projectId: string,
    entityIri: string,
    token?: string,
    branch?: string
  ) =>
    api.get<CrossReferencesResponse>(
      `/api/v1/projects/${projectId}/entities/${encodeURIComponent(entityIri)}/references`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  triggerConsistencyCheck: (
    projectId: string,
    token: string,
    branch?: string
  ) =>
    api.post<{ job_id: string }>(
      `/api/v1/projects/${projectId}/quality/check`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch },
      }
    ),

  getConsistencyIssues: (
    projectId: string,
    token?: string,
    branch?: string
  ) =>
    api.get<ConsistencyCheckResult>(
      `/api/v1/projects/${projectId}/quality/issues`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),

  getDuplicateCandidates: (
    projectId: string,
    token: string,
    branch?: string,
    threshold = 0.85
  ) =>
    api.post<DuplicateDetectionResult>(
      `/api/v1/projects/${projectId}/quality/duplicates`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch, threshold },
      }
    ),
};
