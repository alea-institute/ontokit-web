import { getLocalName } from "@/lib/utils";
import type { OWLClassDetail } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { GraphData, OntologyGraphNode, OntologyGraphEdge, GraphNodeType } from "./types";

const WELL_KNOWN_NAMESPACES = new Set([
  "http://www.w3.org/2002/07/owl#",
  "http://www.w3.org/2000/01/rdf-schema#",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "http://www.w3.org/2001/XMLSchema#",
  "http://purl.org/dc/elements/1.1/",
  "http://purl.org/dc/terms/",
  "http://xmlns.com/foaf/0.1/",
  "http://www.w3.org/2004/02/skos/core#",
]);

function isExternalIri(iri: string): boolean {
  for (const ns of WELL_KNOWN_NAMESPACES) {
    if (iri.startsWith(ns)) return true;
  }
  return false;
}

const OWL_THING_IRI = "http://www.w3.org/2002/07/owl#Thing";
const SEEALSO_IRI = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
const IS_DEFINED_BY_IRI = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
const MAX_CHILDREN_PER_NODE = 20;

/**
 * Extract IRI-valued seeAlso/isDefinedBy targets from a class detail's annotations.
 */
export function getSeeAlsoIris(detail: OWLClassDetail): string[] {
  const iris: string[] = [];
  for (const annot of detail.annotations) {
    if (annot.property_iri === SEEALSO_IRI || annot.property_iri === IS_DEFINED_BY_IRI) {
      for (const val of annot.values) {
        const v = typeof val === "string" ? val : val.value;
        if (v.startsWith("http://") || v.startsWith("https://")) {
          iris.push(v);
        }
      }
    }
  }
  return iris;
}

/**
 * Recursively walk tree nodes to build an IRI → label map.
 */
export function extractTreeLabelMap(nodes: ClassTreeNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(list: ClassTreeNode[]) {
    for (const node of list) {
      if (node.label) map.set(node.iri, node.label);
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

/**
 * Build graph data from a set of resolved class details centered on a focus IRI.
 */
export function buildGraphFromClassDetail(
  focusIri: string,
  resolvedNodes: Map<string, OWLClassDetail>,
  labelHints?: Map<string, string>,
  entityTypes?: Map<string, string>,
): GraphData {
  const visited = new Set<string>();
  const nodeMap = new Map<string, OntologyGraphNode>();
  const edges: OntologyGraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Collect resolved labels from all parent_labels maps so unresolved nodes
  // can display human-readable names instead of raw IRI fragments.
  const knownLabels = new Map<string, string>();
  for (const detail of resolvedNodes.values()) {
    if (detail.parent_labels) {
      for (const [iri, label] of Object.entries(detail.parent_labels)) {
        if (label) knownLabels.set(iri, label);
      }
    }
  }

  function addEdge(source: string, target: string, edgeType: OntologyGraphEdge["edgeType"]) {
    if (source === OWL_THING_IRI || target === OWL_THING_IRI) return;
    const key = `${edgeType}:${source}:${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ id: key, source, target, edgeType });
  }

  function getNodeType(iri: string): GraphNodeType {
    if (iri === focusIri) return "focus";
    if (isExternalIri(iri)) return "external";
    // Check entity type for non-class entities
    const et = entityTypes?.get(iri);
    if (et === "individual") return "individual";
    if (et === "property") return "property";
    if (!resolvedNodes.has(iri)) return "unexplored";
    const detail = resolvedNodes.get(iri)!;
    if (detail.parent_iris.length === 0 || detail.parent_iris.every(p => p === OWL_THING_IRI)) return "root";
    return "class";
  }

  function resolveLabel(iri: string): string {
    // 1. Resolved node's own labels
    const detail = resolvedNodes.get(iri);
    if (detail?.labels[0]?.value) return detail.labels[0].value;
    // 2. Label from another node's parent_labels map
    const known = knownLabels.get(iri);
    if (known) return known;
    // 3. Label from tree nodes already in memory
    const hint = labelHints?.get(iri);
    if (hint) return hint;
    // 4. Fallback to local name
    return getLocalName(iri);
  }

  function ensureNode(iri: string): void {
    if (iri === OWL_THING_IRI) return;
    if (nodeMap.has(iri)) return;
    const detail = resolvedNodes.get(iri);
    nodeMap.set(iri, {
      id: iri,
      label: resolveLabel(iri),
      nodeType: getNodeType(iri),
      deprecated: detail?.deprecated,
      childCount: detail?.child_count,
      isExpanded: resolvedNodes.has(iri),
    });
  }

  function processNode(iri: string): void {
    if (visited.has(iri)) return;
    visited.add(iri);

    const detail = resolvedNodes.get(iri);
    if (!detail) return;

    ensureNode(iri);

    // subClassOf edges: child → parent (natural OWL direction; ELK "UP" places parents at top)
    for (const parentIri of detail.parent_iris) {
      ensureNode(parentIri);
      addEdge(iri, parentIri, "subClassOf");
    }

    // equivalentClass edges
    for (const eqIri of detail.equivalent_iris) {
      ensureNode(eqIri);
      addEdge(iri, eqIri, "equivalentClass");
    }

    // disjointWith edges
    for (const djIri of detail.disjoint_iris) {
      ensureNode(djIri);
      addEdge(iri, djIri, "disjointWith");
    }

    // seeAlso / isDefinedBy from annotations
    for (const annot of detail.annotations) {
      if (annot.property_iri === SEEALSO_IRI || annot.property_iri === IS_DEFINED_BY_IRI) {
        for (const val of annot.values) {
          const v = typeof val === "string" ? val : val.value;
          if (v.startsWith("http://") || v.startsWith("https://")) {
            ensureNode(v);
            addEdge(iri, v, "seeAlso");
          }
        }
      }
    }
  }

  // Process all resolved nodes
  for (const iri of resolvedNodes.keys()) {
    processNode(iri);
  }

  // Ensure focus node exists even if not in resolvedNodes
  ensureNode(focusIri);

  // Cap children: for any parent with more than MAX_CHILDREN_PER_NODE children shown, trim
  const childrenCount = new Map<string, number>();
  const filteredEdges = edges.filter((edge) => {
    if (edge.edgeType === "subClassOf") {
      // source is child, target is parent
      const parent = edge.target;
      const count = (childrenCount.get(parent) || 0) + 1;
      childrenCount.set(parent, count);
      if (count > MAX_CHILDREN_PER_NODE) return false;
    }
    return true;
  });

  // Prune nodes that are not connected after child-cap filtering
  const visibleNodeIds = new Set<string>([focusIri]);
  for (const edge of filteredEdges) {
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }
  const nodes = Array.from(nodeMap.values()).filter((node) => visibleNodeIds.has(node.id));

  // If no relationships at all
  if (filteredEdges.length === 0 && nodes.length <= 1) {
    return { nodes, edges: [] };
  }

  return { nodes, edges: filteredEdges };
}
