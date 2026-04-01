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
  refs?: Record<string, string[]>;
  defaultBranch?: string;
}

export function GitGraph({
  commits,
  selectedHash,
  onSelectCommit,
  config: configOverrides,
  className,
  refs,
  defaultBranch,
}: GitGraphProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_GRAPH_CONFIG, ...configOverrides }),
    [configOverrides]
  );

  const layout = useMemo(
    () => buildGraphLayout(commits, refs, defaultBranch),
    [commits, refs, defaultBranch]
  );

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

  let pathD: string;

  if (from.x === to.x) {
    // Straight vertical line (same lane)
    pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
  } else {
    // GitHub Octicons style: TWO quarter-circle arcs with horizontal segment
    //
    // The path consists of:
    // 1. Vertical line from start
    // 2. First quarter circle: vertical → horizontal
    // 3. Horizontal line (if needed)
    // 4. Second quarter circle: horizontal → vertical
    // 5. Vertical line to end
    //
    // For a 90° arc, control point distance = r * k where k = 4/3 * tan(π/8) ≈ 0.5522847498
    //
    const k = 0.5522847498;
    const dx = x2 - x1;
    const absDx = Math.abs(dx);
    const goingRight = dx > 0;

    // Radius for quarter circles - use half the cell width for nice proportions
    const r = Math.min(config.cellWidth * 0.4, absDx / 2, config.cellHeight * 0.3);

    if (y2 > y1) {
      // Normal case: going down (from child at top to parent at bottom)
      //
      // The visual representation depends on direction:
      //
      // Going RIGHT (merge line - from main lane to feature branch):
      //   Start at child → curves down-right → horizontal → curves right-down → vertical → parent
      //   The vertical line is at the END (near parent/bottom)
      //
      // Going LEFT (branch line - from feature branch back to main):
      //   Start at child → vertical → curves down-left → horizontal → curves left-down → parent
      //   The vertical line is at the START (near child/top)
      //
      // This makes branches visually "grow upward" from the parent commit.

      const horizontalY = y2 - r; // Y level where curves meet (near the parent)

      if (horizontalY <= y1 + r) {
        // Not enough vertical space for two curves, use simple S-curve fallback
        const midY = (y1 + y2) / 2;
        pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      } else if (goingRight) {
        // Going RIGHT (merge line): curves at top, vertical at bottom
        // First quarter circle: vertical (down) → horizontal (right)
        // P0 = (x1, y1), P3 = (x1 + r, y1 + r)
        const arc1EndX = x1 + r;
        const arc1EndY = y1 + r;
        const arc1P1x = x1;
        const arc1P1y = y1 + r * k;
        const arc1P2x = arc1EndX - r * k;
        const arc1P2y = arc1EndY;

        // Second quarter circle: horizontal (right) → vertical (down)
        // P0 = (x2 - r, y1 + r), P3 = (x2, y1 + 2r)
        const arc2StartX = x2 - r;
        const arc2StartY = y1 + r; // Same Y as first curve end
        const arc2EndY = y1 + 2 * r;
        const arc2P1x = arc2StartX + r * k;
        const arc2P1y = arc2StartY;
        const arc2P2x = x2;
        const arc2P2y = arc2EndY - r * k;

        pathD = [
          `M ${x1} ${y1}`,
          // First quarter circle (down → right)
          `C ${arc1P1x} ${arc1P1y}, ${arc1P2x} ${arc1P2y}, ${arc1EndX} ${arc1EndY}`,
          // Horizontal line
          `L ${arc2StartX} ${arc2StartY}`,
          // Second quarter circle (right → down)
          `C ${arc2P1x} ${arc2P1y}, ${arc2P2x} ${arc2P2y}, ${x2} ${arc2EndY}`,
          // Vertical line to parent
          `L ${x2} ${y2}`,
        ].join(" ");
      } else {
        // Going LEFT (branch line): vertical at top, curves at bottom
        // The branch visually grows UP from parent, so curves are near the parent

        // First quarter circle: vertical (down) → horizontal (left)
        // P0 = (x1, horizontalY - r), P3 = (x1 - r, horizontalY)
        const arc1StartY = horizontalY - r;
        const arc1EndX = x1 - r;
        const arc1P1x = x1;
        const arc1P1y = arc1StartY + r * k;
        const arc1P2x = arc1EndX + r * k;
        const arc1P2y = horizontalY;

        // Second quarter circle: horizontal (left) → vertical (down)
        // P0 = (x2 + r, horizontalY), P3 = (x2, y2)
        const arc2StartX = x2 + r;
        const arc2P1x = arc2StartX - r * k;
        const arc2P1y = horizontalY;
        const arc2P2x = x2;
        const arc2P2y = y2 - r * k;

        pathD = [
          `M ${x1} ${y1}`,
          // Vertical line from child
          `L ${x1} ${arc1StartY}`,
          // First quarter circle (down → left)
          `C ${arc1P1x} ${arc1P1y}, ${arc1P2x} ${arc1P2y}, ${arc1EndX} ${horizontalY}`,
          // Horizontal line
          `L ${arc2StartX} ${horizontalY}`,
          // Second quarter circle (left → down)
          `C ${arc2P1x} ${arc2P1y}, ${arc2P2x} ${arc2P2y}, ${x2} ${y2}`,
        ].join(" ");
      }
    } else {
      // Reverse case: going up - use simple S-curve
      const midY = (y1 + y2) / 2;
      pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }
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
