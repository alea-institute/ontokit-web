import type { EntityChange, ProjectChangesResponse } from "@/lib/api/changes";

export const lease: EntityChange = {
  entity_iri: "https://example.org/onto#Lease",
  entity_type: "class",
  label: "Lease",
  net_change: "modified",
  origins: ["ai"],
  last_changed_at: "2026-11-19T18:30:00Z",
  event_count: 1,
  authors: [{ user_id: "reviewer", user_name: "Reviewer" }],
  field_changes: [
    {
      field: "definitions",
      before: ["A rental agreement."],
      after: ["A contract granting use of property for a set period."],
    },
    {
      field: "parents",
      before: ["https://example.org/onto#Agreement"],
      after: ["https://example.org/onto#Contract"],
    },
  ],
  events: [{
    id: "event-1",
    project_id: "project-1",
    branch: "review",
    entity_iri: "https://example.org/onto#Lease",
    entity_type: "class",
    event_type: "update",
    user_id: "reviewer",
    user_name: "Reviewer",
    changed_fields: ["definitions", "parents"],
    created_at: "2026-11-19T18:30:00Z",
    origin: "ai",
    origin_model: "example-model",
    origin_batch_id: null,
  }],
};

export const legacyTenant: EntityChange = {
  entity_iri: "https://example.org/onto#LegacyTenant",
  entity_type: "individual",
  label: null,
  net_change: "removed",
  origins: ["human"],
  last_changed_at: "2026-11-18T16:00:00Z",
  event_count: 1,
  authors: [{ user_id: "editor", user_name: "Editor" }],
  field_changes: [],
  events: [{
    ...lease.events[0],
    id: "event-2",
    entity_iri: "https://example.org/onto#LegacyTenant",
    entity_type: "individual",
    event_type: "delete",
    user_id: "editor",
    user_name: "Editor",
    changed_fields: [],
    created_at: "2026-11-18T16:00:00Z",
    origin: "human",
    origin_model: null,
  }],
};

export const renewal: EntityChange = {
  entity_iri: "https://example.org/onto#hasRenewal",
  entity_type: "object_property",
  label: "has renewal",
  net_change: "added",
  origins: ["ai_edited"],
  last_changed_at: "2026-11-17T14:00:00Z",
  event_count: 1,
  authors: lease.authors,
  field_changes: [{ field: "labels", before: [], after: ["has renewal"] }],
  events: [{
    ...lease.events[0],
    id: "event-3",
    entity_iri: "https://example.org/onto#hasRenewal",
    entity_type: "object_property",
    event_type: "create",
    changed_fields: ["labels"],
    created_at: "2026-11-17T14:00:00Z",
    origin: "ai_edited",
  }],
};

export const changes: ProjectChangesResponse = {
  window: { days: 7, since: "2026-11-13T00:00:00Z", until: "2026-11-20T00:00:00Z", branch: "review" },
  summary: {
    total_events: 3,
    entities_changed: 3,
    by_net_change: { added: 1, modified: 1, removed: 1 },
    by_origin: { human: 1, ai: 1, ai_edited: 1, system: 0 },
    authors: [
      { user_id: "reviewer", user_name: "Reviewer", event_count: 2 },
      { user_id: "editor", user_name: "Editor", event_count: 1 },
    ],
  },
  items: [lease, legacyTenant, renewal],
  next_cursor: null,
};
