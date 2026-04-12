export type GraphNodeType = "focus" | "class" | "root" | "secondary_root" | "individual" | "property" | "external" | "unexplored";
export type GraphEdgeType = "subClassOf" | "equivalentClass" | "disjointWith" | "seeAlso";

export interface OntologyGraphNode {
  id: string;
  label: string;
  nodeType: GraphNodeType;
  deprecated?: boolean;
  childCount?: number;
  isExpanded?: boolean;
}

export interface OntologyGraphEdge {
  id: string;
  source: string;
  target: string;
  edgeType: GraphEdgeType;
}

export interface GraphData {
  nodes: OntologyGraphNode[];
  edges: OntologyGraphEdge[];
}
