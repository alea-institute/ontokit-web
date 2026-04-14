/**
 * API client for quality features: cross-references, consistency checks, duplicate detection
 */

import { api } from "./client";
import type {
  CrossReferencesResponse,
  ConsistencyCheckResult,
  DuplicateDetectionResult,
  QualityJobPendingResponse,
} from "@/lib/ontology/qualityTypes";

export interface QualityWebSocketMessage {
  type:
    | "consistency_started"
    | "consistency_complete"
    | "consistency_failed"
    | "duplicates_started"
    | "duplicates_complete"
    | "duplicates_failed";
  project_id: string;
  branch: string;
  job_id?: string;
  issues_found?: number;
  clusters_found?: number;
  error?: string;
}

const QUALITY_WS_TYPES = new Set([
  "consistency_started",
  "consistency_complete",
  "consistency_failed",
  "duplicates_started",
  "duplicates_complete",
  "duplicates_failed",
]);

export function isQualityWebSocketMessage(
  data: unknown
): data is QualityWebSocketMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as Record<string, unknown>).type === "string" &&
    QUALITY_WS_TYPES.has((data as Record<string, unknown>).type as string) &&
    "project_id" in data &&
    typeof (data as Record<string, unknown>).project_id === "string" &&
    "branch" in data &&
    typeof (data as Record<string, unknown>).branch === "string"
  );
}

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

  triggerDuplicateDetection: (
    projectId: string,
    token: string,
    branch?: string,
    threshold = 0.85
  ) =>
    api.post<{ job_id: string }>(
      `/api/v1/projects/${projectId}/quality/duplicates`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { branch, threshold },
      }
    ),

  getDuplicateJobResult: (
    projectId: string,
    jobId: string,
    token?: string
  ) =>
    api.get<DuplicateDetectionResult | QualityJobPendingResponse>(
      `/api/v1/projects/${projectId}/quality/duplicates/jobs/${jobId}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),

  getLatestDuplicates: (
    projectId: string,
    token?: string,
    branch?: string
  ) =>
    api.get<DuplicateDetectionResult>(
      `/api/v1/projects/${projectId}/quality/duplicates/latest`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch },
      }
    ),
};

/**
 * Create a WebSocket connection for quality check updates
 */
export function createQualityWebSocket(
  projectId: string,
  onMessage: (message: QualityWebSocketMessage) => void,
  onError?: (error: Event) => void,
  onClose?: (event: CloseEvent) => void,
  token?: string,
  onOpen?: () => void
): WebSocket {
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ||
    "ws://localhost:8000";

  const params = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(`${wsUrl}/api/v1/projects/${projectId}/quality/ws${params}`);

  ws.onmessage = (event) => {
    try {
      const data: unknown = JSON.parse(event.data);
      if (isQualityWebSocketMessage(data)) {
        onMessage(data);
      } else {
        console.warn("Unexpected quality WebSocket payload:", event.data);
      }
    } catch (e) {
      console.error("Failed to parse quality WebSocket message:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("Quality WebSocket error:", error);
    onError?.(error);
  };

  ws.onopen = () => {
    onOpen?.();
  };

  ws.onclose = (event) => {
    onClose?.(event);
  };

  return ws;
}
