/**
 * Quality-related type definitions for ontology consistency checks and cross-references
 */

export type ConsistencySeverity = "error" | "warning" | "info";

export type ConsistencyRuleId =
  | "orphan_class"
  | "cycle_detect"
  | "unused_property"
  | "missing_label"
  | "missing_comment"
  | "orphan_individual"
  | "empty_domain"
  | "empty_range"
  | "duplicate_label"
  | "deprecated_parent"
  | "dangling_ref"
  | "multi_root";

export interface ConsistencyIssue {
  rule_id: ConsistencyRuleId;
  severity: ConsistencySeverity;
  entity_iri: string;
  entity_type: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConsistencyCheckResult {
  project_id: string;
  branch: string;
  issues: ConsistencyIssue[];
  checked_at: string;
  duration_ms: number;
}

export type ReferenceContext =
  | "parent_iris"
  | "domain_iris"
  | "range_iris"
  | "type_iris"
  | "equivalent_iris"
  | "disjoint_iris"
  | "some_values_from"
  | "annotation_value"
  | "see_also"
  | "inverse_of";

export interface CrossReference {
  source_iri: string;
  source_type: string;
  source_label?: string;
  reference_context: ReferenceContext;
}

export interface CrossReferenceGroup {
  context: ReferenceContext;
  context_label: string;
  references: CrossReference[];
}

export interface CrossReferencesResponse {
  target_iri: string;
  total: number;
  groups: CrossReferenceGroup[];
}

export interface DuplicateCandidate {
  entity_a_iri: string;
  entity_a_label: string;
  entity_b_iri: string;
  entity_b_label: string;
  entity_type: string;
  similarity: number;
}

export interface DuplicateCluster {
  entities: Array<{
    iri: string;
    label: string;
    entity_type: string;
  }>;
  similarity: number;
}

export interface DuplicateDetectionResult {
  clusters: DuplicateCluster[];
  threshold: number;
  checked_at: string;
}

export interface QualityJobPendingResponse {
  job_id: string;
  status: "pending";
}
