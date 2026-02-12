"use client";

import { useMemo } from "react";
import type { RevisionCommit } from "@/lib/api/revisions";
import { buildGraphLayout } from "@/lib/git-graph/graph-builder";
import {
  DEFAULT_GRAPH_CONFIG,
  type GraphConfig,
  type BranchSegment,
  type GraphVertex,
} from "@/lib/git-graph/types";

interface GitGraphProps {
  commits: RevisionCommit[];
  selectedHash?: string | null;
  onSelectCommit?: (hash: string) => void;
  config?: Partial<GraphConfig>;
  className?: string;
}

export function GitGraph({
  commits,
  selectedHash,
  onSelectCommit,
  config: configOverrides,
  className,
}: GitGraphProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_GRAPH_CONFIG, ...configOverrides }),
    [configOverrides]
  );

  const layout = useMemo(() => buildGraphLayout(commits), [commits]);

  if (commits.length === 0) {
    return null;
  }

  const svgWidth = layout.width * config.cellWidth + config.cellWidth;
  const svgHeight = layout.height * config.cellHeight;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className={className}
      style={{ minWidth: svgWidth }}
    >
      {/* Render branch lines first (behind nodes) */}
      <g className="branch-lines">
        {layout.segments.map((segment, index) => (
          <BranchLine
            key={`segment-${index}`}
            segment={segment}
            config={config}
          />
        ))}
      </g>

      {/* Render commit nodes on top */}
      <g className="commit-nodes">
        {layout.vertices.map((vertex) => (
          <CommitNode
            key={vertex.hash}
            vertex={vertex}
            config={config}
            isSelected={selectedHash === vertex.hash}
            onClick={() => onSelectCommit?.(vertex.hash)}
          />
        ))}
      </g>
    </svg>
  );
}

interface BranchLineProps {
  segment: BranchSegment;
  config: GraphConfig;
}

function BranchLine({ segment, config }: BranchLineProps) {
  const { from, to, colorIndex, isMergeLine } = segment;
  const color = config.colors[colorIndex % config.colors.length];

  // Convert grid coordinates to pixel coordinates
  const x1 = from.x * config.cellWidth + config.cellWidth / 2;
  const y1 = from.y * config.cellHeight + config.cellHeight / 2;
  const x2 = to.x * config.cellWidth + config.cellWidth / 2;
  const y2 = to.y * config.cellHeight + config.cellHeight / 2;

  // Generate path
  let pathD: string;

  if (from.x === to.x) {
    // Straight vertical line (same lane)
    pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
  } else {
    // Bezier curve for lane transitions
    // Control points create a smooth S-curve
    const midY = (y1 + y2) / 2;
    pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  return (
    <path
      d={pathD}
      fill="none"
      stroke={color}
      strokeWidth={config.lineWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={isMergeLine ? 0.6 : 1}
      strokeDasharray={isMergeLine ? "4,2" : undefined}
    />
  );
}

interface CommitNodeProps {
  vertex: GraphVertex;
  config: GraphConfig;
  isSelected: boolean;
  onClick?: () => void;
}

function CommitNode({ vertex, config, isSelected, onClick }: CommitNodeProps) {
  const color = config.colors[vertex.color % config.colors.length];

  // Convert grid coordinates to pixel coordinates
  const cx = vertex.lane * config.cellWidth + config.cellWidth / 2;
  const cy = vertex.id * config.cellHeight + config.cellHeight / 2;

  const radius = isSelected ? config.selectedNodeRadius : config.nodeRadius;

  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
      className="commit-node"
    >
      {/* Selection highlight ring */}
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 3}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.4}
        />
      )}

      {/* Main node */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={vertex.isMerge ? "white" : color}
        stroke={color}
        strokeWidth={vertex.isMerge ? 2 : 0}
      />

      {/* Merge indicator (inner dot) */}
      {vertex.isMerge && (
        <circle cx={cx} cy={cy} r={radius - 2} fill={color} />
      )}
    </g>
  );
}
