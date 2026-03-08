/**
 * API client for analytics: change tracking, activity, contributor stats
 */

import { api } from "./client";

export type ChangeEventType =
  | "create"
  | "update"
  | "delete"
  | "rename"
  | "reparent"
  | "deprecate";

export interface ChangeEvent {
  id: string;
  project_id: string;
  branch: string;
  entity_iri: string;
  entity_type: string;
  event_type: ChangeEventType;
  user_id: string;
  user_name?: string;
  commit_hash?: string;
  changed_fields: string[];
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ProjectActivity {
  daily_counts: ActivityDay[];
  total_events: number;
  top_editors: Array<{
    user_id: string;
    user_name: string;
    edit_count: number;
  }>;
}

export interface HotEntity {
  entity_iri: string;
  entity_type: string;
  label?: string;
  edit_count: number;
  editor_count: number;
  last_edited_at: string;
}

export interface ContributorStats {
  user_id: string;
  user_name: string;
  create_count: number;
  update_count: number;
  delete_count: number;
  total_count: number;
  last_active_at: string;
}

export interface EntityHistoryResponse {
  entity_iri: string;
  events: ChangeEvent[];
  total: number;
}

export const analyticsApi = {
  getActivity: (
    projectId: string,
    token?: string,
    days = 30
  ) =>
    api.get<ProjectActivity>(
      `/api/v1/projects/${projectId}/analytics/activity`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { days },
      }
    ),

  getEntityHistory: (
    projectId: string,
    entityIri: string,
    token?: string,
    branch?: string,
    limit = 50
  ) =>
    api.get<EntityHistoryResponse>(
      `/api/v1/projects/${projectId}/analytics/entity/${encodeURIComponent(entityIri)}/history`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { branch, limit },
      }
    ),

  getHotEntities: (
    projectId: string,
    token?: string,
    limit = 20
  ) =>
    api.get<HotEntity[]>(
      `/api/v1/projects/${projectId}/analytics/hot-entities`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { limit },
      }
    ),

  getContributors: (
    projectId: string,
    token?: string,
    days = 30
  ) =>
    api.get<ContributorStats[]>(
      `/api/v1/projects/${projectId}/analytics/contributors`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { days },
      }
    ),
};
