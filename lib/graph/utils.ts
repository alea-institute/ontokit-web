import type { ClassTreeNode } from "@/lib/ontology/types";

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
