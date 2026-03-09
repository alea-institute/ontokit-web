"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { GraphEdgeType } from "@/lib/graph/types";

export interface OntologyEdgeData {
  [key: string]: unknown;
  edgeType: GraphEdgeType;
}

type OntologyEdgeProps = EdgeProps & {
  data?: OntologyEdgeData;
};

const edgeTypeConfig: Record<GraphEdgeType, {
  stroke: string;
  strokeDasharray?: string;
  label: string;
  markerEnd?: string;
}> = {
  subClassOf: {
    stroke: "#94a3b8",
    label: "subClassOf",
    markerEnd: "url(#arrow-slate)",
  },
  equivalentClass: {
    stroke: "#3b82f6",
    strokeDasharray: "5 3",
    label: "equivalentTo",
  },
  disjointWith: {
    stroke: "#ef4444",
    strokeDasharray: "5 3",
    label: "disjointWith",
  },
  seeAlso: {
    stroke: "#9ca3af",
    strokeDasharray: "2 4",
    label: "seeAlso",
  },
};

export const OntologyEdge = memo(function OntologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: OntologyEdgeProps) {
  const [hovered, setHovered] = useState(false);
  const edgeType = data?.edgeType ?? "subClassOf";
  const config = edgeTypeConfig[edgeType];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: config.stroke,
          strokeDasharray: config.strokeDasharray,
          strokeWidth: edgeType === "subClassOf" ? 1.5 : 1,
        }}
        markerEnd={config.markerEnd}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm dark:bg-slate-800/90 dark:text-slate-300"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {config.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
