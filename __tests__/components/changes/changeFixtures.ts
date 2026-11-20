import type { EntityChange, ProjectChangesResponse } from "@/lib/api/changes";

export const lease: EntityChange = {
  entity_iri: "https://example.org/onto#Lease",
  entity_type: "class",
  label: "Lease",
  net_change: "modified",
  origins: ["human"],
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
    commit_hash: null,
    old_values: null,
    new_values: null,
    changed_fields: ["definitions", "parents"],
    created_at: "2026-11-19T18:30:00Z",
    origin: "human",
    origin_model: null,
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
  entity_type: "property",
  label: "has renewal",
  net_change: "added",
  origins: ["human"],
  last_changed_at: "2026-11-17T14:00:00Z",
  event_count: 1,
  authors: lease.authors,
  field_changes: [{ field: "labels", before: [], after: ["has renewal"] }],
  events: [{
    ...lease.events[0],
    id: "event-3",
    entity_iri: "https://example.org/onto#hasRenewal",
    entity_type: "property",
    event_type: "create",
    changed_fields: ["labels"],
    created_at: "2026-11-17T14:00:00Z",
  }],
};

const temporaryClauseIri = "https://example.org/onto#TemporaryClause";

export const temporaryClause: EntityChange = {
  entity_iri: temporaryClauseIri,
  entity_type: "class",
  label: "Trial clause",
  net_change: "transient",
  origins: ["human", "ai"],
  last_changed_at: "2026-11-16T15:00:00Z",
  event_count: 3,
  authors: [...legacyTenant.authors, ...lease.authors],
  field_changes: [],
  events: [
    {
      ...legacyTenant.events[0],
      id: "event-4",
      entity_iri: temporaryClauseIri,
      entity_type: "class",
      created_at: "2026-11-16T15:00:00Z",
    },
    {
      ...lease.events[0],
      id: "event-5",
      entity_iri: temporaryClauseIri,
      event_type: "rename",
      user_id: "editor",
      user_name: "Editor",
      changed_fields: ["labels"],
      old_values: { labels: ["Temporary clause"] },
      new_values: { labels: ["Trial clause"] },
      created_at: "2026-11-16T14:30:00Z",
      origin: "human",
      origin_model: null,
    },
    {
      ...lease.events[0],
      id: "event-6",
      entity_iri: temporaryClauseIri,
      event_type: "create",
      changed_fields: ["labels"],
      new_values: { labels: ["Temporary clause"] },
      created_at: "2026-11-16T14:00:00Z",
      origin: "ai",
      origin_model: "example-model",
    },
  ],
};

export const changes: ProjectChangesResponse = {
  window: { days: 7, since: "2026-11-13T00:00:00Z", until: "2026-11-20T00:00:00Z", branch: "review" },
  summary: {
    total_events: 3,
    entities_changed: 3,
    by_net_change: { added: 1, modified: 1, removed: 1, transient: 0 },
    by_origin: { human: 3, ai: 0, ai_edited: 0, system: 0 },
    authors: [
      { user_id: "reviewer", user_name: "Reviewer", event_count: 2 },
      { user_id: "editor", user_name: "Editor", event_count: 1 },
    ],
  },
  items: [lease, legacyTenant, renewal],
  next_cursor: null,
};

export const changesWithTransient: ProjectChangesResponse = {
  ...changes,
  summary: {
    total_events: 6,
    entities_changed: 4,
    by_net_change: { added: 1, modified: 1, removed: 1, transient: 1 },
    by_origin: { human: 5, ai: 1, ai_edited: 0, system: 0 },
    authors: [
      { user_id: "reviewer", user_name: "Reviewer", event_count: 3 },
      { user_id: "editor", user_name: "Editor", event_count: 3 },
    ],
  },
  items: [...changes.items, temporaryClause],
};
