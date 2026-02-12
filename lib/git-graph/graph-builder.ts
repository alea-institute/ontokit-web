/**
 * Git Graph Builder
 * Builds graph layout from commit data with lane assignment algorithm.
 */

import type { RevisionCommit } from "@/lib/api/revisions";
import type {
  GraphVertex,
  GraphLayout,
  BranchSegment,
  GridPoint,
} from "./types";

/**
 * Build a graph layout from a list of commits.
 * Commits should be ordered from newest to oldest (as returned by git log).
 *
 * @param commits - Array of commits with parent_hashes
 * @returns GraphLayout with vertices and segments for rendering
 */
export function buildGraphLayout(commits: RevisionCommit[]): GraphLayout {
  if (commits.length === 0) {
    return { vertices: [], segments: [], width: 0, height: 0 };
  }

  // Build hash to index map for fast parent lookup
  const hashToIndex = new Map<string, number>();
  commits.forEach((commit, index) => {
    hashToIndex.set(commit.hash, index);
  });

  // Build vertices with parent/child relationships
  const vertices: GraphVertex[] = commits.map((commit, index) => {
    const parentHashes = commit.parent_hashes ?? [];
    return {
      id: index,
      hash: commit.hash,
      parentIndices: parentHashes
        .map((h) => hashToIndex.get(h))
        .filter((i): i is number => i !== undefined),
      childIndices: [],
      lane: 0,
      color: 0,
      isMerge: parentHashes.length > 1,
    };
  });

  // Build child relationships (reverse of parent)
  vertices.forEach((vertex) => {
    vertex.parentIndices.forEach((parentIdx) => {
      if (vertices[parentIdx]) {
        vertices[parentIdx].childIndices.push(vertex.id);
      }
    });
  });

  // Assign lanes and colors
  assignLanesAndColors(vertices);

  // Generate branch segments
  const segments = generateSegments(vertices);

  // Calculate width (max lane + 1)
  const width = Math.max(...vertices.map((v) => v.lane)) + 1;

  return {
    vertices,
    segments,
    width,
    height: commits.length,
  };
}

/**
 * Assign lanes (columns) and colors to vertices.
 * Uses an algorithm that follows branch continuation, prioritizing the main lane (lane 0).
 */
function assignLanesAndColors(vertices: GraphVertex[]): void {
  // Track which lanes are occupied at each row
  const activeLanes = new Map<number, { lane: number; color: number }>();
  let nextColor = 0;

  // Process commits from newest to oldest (top to bottom)
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];

    // Find if any child continues to this commit (first parent relationship)
    let assignedLane: number | null = null;
    let assignedColor: number | null = null;

    // Collect all children where this vertex is their first parent
    const continuingChildren: GraphVertex[] = [];
    for (const childIdx of vertex.childIndices) {
      const child = vertices[childIdx];
      if (child.parentIndices[0] === i) {
        continuingChildren.push(child);
      }
    }

    if (continuingChildren.length > 0) {
      // Prioritize children on lane 0 (main branch) to keep main line straight
      // Sort by lane so lane 0 comes first
      continuingChildren.sort((a, b) => a.lane - b.lane);
      assignedLane = continuingChildren[0].lane;
      assignedColor = continuingChildren[0].color;
    }

    if (assignedLane === null) {
      // Find first available lane
      const usedLanes = new Set<number>();
      activeLanes.forEach(({ lane }) => usedLanes.add(lane));

      assignedLane = 0;
      while (usedLanes.has(assignedLane)) {
        assignedLane++;
      }
      assignedColor = nextColor++;
    }

    vertex.lane = assignedLane;
    vertex.color = assignedColor!;

    // Update active lanes
    // Remove lanes that end at this commit (commits with no parents in our list)
    // and add this commit's lane
    activeLanes.set(i, { lane: vertex.lane, color: vertex.color });

    // Clean up lanes from children that don't continue past this point
    for (const [idx] of activeLanes.entries()) {
      if (idx !== i) {
        const existingVertex = vertices[idx];
        // If this vertex has no more parents to connect to, remove its lane
        const hasConnectionBelow = existingVertex.parentIndices.some(
          (pIdx) => pIdx > i
        );
        if (!hasConnectionBelow) {
          activeLanes.delete(idx);
        }
      }
    }
  }
}

/**
 * Generate line segments connecting commits.
 */
function generateSegments(vertices: GraphVertex[]): BranchSegment[] {
  const segments: BranchSegment[] = [];

  for (const vertex of vertices) {
    const from: GridPoint = { x: vertex.lane, y: vertex.id };

    vertex.parentIndices.forEach((parentIdx, connectionIndex) => {
      const parent = vertices[parentIdx];
      if (!parent) return;

      const to: GridPoint = { x: parent.lane, y: parentIdx };

      // First parent connection uses the commit's color (branch continuation)
      // Second+ parent connections use the parent's color (merge line)
      const isMergeLine = connectionIndex > 0;
      const colorIndex = isMergeLine ? parent.color : vertex.color;

      segments.push({
        from,
        to,
        isMergeLine,
        colorIndex,
      });
    });
  }

  return segments;
}
