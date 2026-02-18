/**
 * Join Requests API client
 */

import { api } from "./client";

// Types

export type JoinRequestStatus = "pending" | "approved" | "declined" | "withdrawn";

export interface JoinRequestUser {
  id: string;
  name?: string;
  email?: string;
}

export interface JoinRequest {
  id: string;
  project_id: string;
  user_id: string;
  user?: JoinRequestUser;
  message: string;
  status: JoinRequestStatus;
  responded_by?: string;
  responder?: JoinRequestUser;
  responded_at?: string;
  response_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface JoinRequestListResponse {
  items: JoinRequest[];
  total: number;
}

export interface MyJoinRequestResponse {
  has_pending_request: boolean;
  request?: JoinRequest;
}

export interface JoinRequestCreate {
  message: string;
}

export interface JoinRequestAction {
  response_message?: string;
}

export interface ProjectPendingCount {
  project_id: string;
  project_name: string;
  pending_count: number;
}

export interface PendingJoinRequestsSummary {
  total_pending: number;
  by_project: ProjectPendingCount[];
}

// API functions
export const joinRequestApi = {
  getPendingSummary: (token: string) =>
    api.get<PendingJoinRequestsSummary>(
      `/api/v1/projects/join-requests/pending-summary`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  create: (projectId: string, data: JoinRequestCreate, token: string) =>
    api.post<JoinRequest>(
      `/api/v1/projects/${projectId}/join-requests`,
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  getMine: (projectId: string, token: string) =>
    api.get<MyJoinRequestResponse>(
      `/api/v1/projects/${projectId}/join-requests/mine`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  list: (projectId: string, token: string, status?: JoinRequestStatus) =>
    api.get<JoinRequestListResponse>(
      `/api/v1/projects/${projectId}/join-requests`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { status },
      }
    ),

  approve: (
    projectId: string,
    requestId: string,
    token: string,
    action?: JoinRequestAction
  ) =>
    api.post<JoinRequest>(
      `/api/v1/projects/${projectId}/join-requests/${requestId}/approve`,
      action,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  decline: (
    projectId: string,
    requestId: string,
    token: string,
    action?: JoinRequestAction
  ) =>
    api.post<JoinRequest>(
      `/api/v1/projects/${projectId}/join-requests/${requestId}/decline`,
      action,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  withdraw: (projectId: string, requestId: string, token: string) =>
    api.delete(
      `/api/v1/projects/${projectId}/join-requests/${requestId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),
};
