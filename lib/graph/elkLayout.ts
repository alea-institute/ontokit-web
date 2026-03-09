import ELK from "elkjs/lib/elk.bundled.js";
import type { OntologyGraphNode, OntologyGraphEdge } from "./types";

const elk = new ELK();

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;

export async function computeLayout(
  nodes: OntologyGraphNode[],
  edges: OntologyGraphEdge[],
  direction: "TB" | "LR" = "TB",
): Promise<Map<string, { x: number; y: number }>> {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction === "TB" ? "UP" : "LEFT",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.spacing.nodeNode": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();

  for (const child of layout.children || []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return positions;
}
