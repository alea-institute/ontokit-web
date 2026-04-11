/**
 * Entity Graph API client.
 *
 * Fetches server-side BFS graph data for visualization.
 */

import { api } from "./client";

export interface GraphNode {
  id: string;
  label: string;
  iri: string;
  definition: string | null;
  is_focus: boolean;
  is_root: boolean;
  depth: number;
  node_type: string;
  child_count: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: "subClassOf" | "equivalentClass" | "disjointWith" | "seeAlso";
  label: string | null;
}

export interface EntityGraphResponse {
  focus_iri: string;
  focus_label: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  total_concept_count: number;
}

export interface FetchGraphOptions {
  branch?: string;
  ancestorsDepth?: number;
  descendantsDepth?: number;
  maxNodes?: number;
  includeSeeAlso?: boolean;
}

export const graphApi = {
  getEntityGraph: (
    projectId: string,
    classIri: string,
    options: FetchGraphOptions = {},
  ) =>
    api.get<EntityGraphResponse>(
      `/api/v1/projects/${projectId}/ontology/classes/graph`,
      {
        params: {
          class_iri: classIri,
          branch: options.branch,
          ancestors_depth: options.ancestorsDepth,
          descendants_depth: options.descendantsDepth,
          max_nodes: options.maxNodes,
          include_see_also: options.includeSeeAlso,
        },
      },
    ),
};
