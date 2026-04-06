"use client";

import { useCallback, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { EntityGraphResponse } from "@/lib/api/graph";
import type { OntologyNodeData } from "@/components/graph/OntologyNode";
import type { OntologyEdgeData } from "@/components/graph/OntologyEdge";
import type { GraphNodeType, GraphEdgeType } from "@/lib/graph/types";

export type LayoutDirection = "TB" | "LR";

interface LayoutResult {
  nodes: Node<OntologyNodeData>[];
  edges: Edge<OntologyEdgeData>[];
  isLayouting: boolean;
  runLayout: (data: EntityGraphResponse, direction?: LayoutDirection) => Promise<void>;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;

export function useELKLayout(): LayoutResult {
  const [nodes, setNodes] = useState<Node<OntologyNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<OntologyEdgeData>[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);

  const runLayout = useCallback(
    async (data: EntityGraphResponse, direction: LayoutDirection = "TB") => {
      setIsLayouting(true);

      try {
        const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
        const elk = new ELK();

        const elkNodes = data.nodes.map((n) => ({
          id: n.id,
          width: Math.max(NODE_WIDTH, n.label.length * 7.5 + 32),
          height: NODE_HEIGHT,
        }));

        const elkEdges = data.edges.map((e) => ({
          id: e.id,
          sources: [e.source],
          targets: [e.target],
        }));

        const elkGraph = await elk.layout({
          id: "root",
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": direction === "TB" ? "DOWN" : "RIGHT",
            "elk.spacing.nodeNode": "40",
            "elk.layered.spacing.nodeNodeBetweenLayers": "70",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.edgeRouting": "SPLINES",
            "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
          },
          children: elkNodes,
          edges: elkEdges,
        });

        const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
        const layoutedNodes: Node<OntologyNodeData>[] = (elkGraph.children ?? []).map(
          (elkNode) => {
            const backendNode = nodeMap.get(elkNode.id)!;
            return {
              id: elkNode.id,
              type: "ontologyNode",
              position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
              data: {
                label: backendNode.label,
                nodeType: (backendNode.node_type || "class") as GraphNodeType,
                childCount: backendNode.child_count ?? undefined,
                deprecated: false,
                isExpanded: false,
              },
            };
          },
        );

        const edgeMarkers: Partial<Record<GraphEdgeType, { type: "arrowclosed"; color: string }>> = {
          subClassOf: { type: "arrowclosed", color: "#94a3b8" },
        };

        const layoutedEdges: Edge<OntologyEdgeData>[] = data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: "ontologyEdge",
          markerEnd: edgeMarkers[e.edge_type as GraphEdgeType],
          data: {
            edgeType: e.edge_type as GraphEdgeType,
          },
        }));

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } finally {
        setIsLayouting(false);
      }
    },
    [],
  );

  return { nodes, edges, isLayouting, runLayout };
}
