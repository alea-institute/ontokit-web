import type { ChangeEvent, ChangeEventType } from "./analytics";
import { api } from "./client";

export type ChangeOrigin = "human" | "ai" | "ai_edited" | "system";
export type NetChange = "added" | "modified" | "removed" | "transient";
export type ChangeEntityType = "class" | "property" | "individual";

interface ChangeAuthor {
  user_id: string;
  user_name: string | null;
}

export interface FieldChange {
  field: "labels" | "definitions" | "parents" | "deprecated" | "comments" | "other";
  before: string[] | boolean | null;
  after: string[] | boolean | null;
}

export interface OriginChangeEvent extends Omit<ChangeEvent, "user_name" | "commit_hash" | "old_values" | "new_values"> {
  user_name: string | null;
  commit_hash: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  origin: ChangeOrigin;
  origin_model: string | null;
  origin_batch_id: string | null;
}

interface ChangedEntity {
  entity_iri: string;
  net_change: NetChange;
  origins: ChangeOrigin[];
  last_changed_at: string;
}

export interface EntityChange extends ChangedEntity {
  entity_type: ChangeEntityType;
  label: string | null;
  event_count: number;
  authors: ChangeAuthor[];
  field_changes: FieldChange[];
  events: OriginChangeEvent[];
}

export interface ProjectChangesResponse {
  window: { days: number; since: string; until: string; branch: string };
  summary: {
    total_events: number;
    entities_changed: number;
    by_net_change: Record<NetChange, number>;
    by_origin: Record<ChangeOrigin, number>;
    authors: Array<ChangeAuthor & { event_count: number }>;
  };
  items: EntityChange[];
  next_cursor: string | null;
}

export interface ChangedEntitiesResponse {
  items: ChangedEntity[];
  truncated: boolean;
}

export interface ChangedEntitiesFilters {
  days?: number;
  branch?: string;
  origin?: readonly ChangeOrigin[];
}

export interface ProjectChangesFilters extends ChangedEntitiesFilters {
  author?: readonly string[];
  entity_type?: readonly ChangeEntityType[];
  event_type?: readonly ChangeEventType[];
  limit?: number;
}

function serializeFilters(filters: ProjectChangesFilters & { cursor?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else {
      params.append(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const changesApi = {
  list: (
    projectId: string,
    token?: string,
    { days, branch, origin, author, entity_type, event_type, limit, cursor }: ProjectChangesFilters & { cursor?: string } = {},
  ) =>
    api.get<ProjectChangesResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/analytics/changes${serializeFilters({
        days, branch, origin, author, entity_type, event_type, limit, cursor,
      })}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    ),

  listChangedEntities: (projectId: string, token?: string, { days, branch, origin }: ChangedEntitiesFilters = {}) =>
    api.get<ChangedEntitiesResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/analytics/changed-entities${serializeFilters({ days, branch, origin })}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    ),
};
