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
 * @param refs - Optional map of commit hash → branch names
 * @param defaultBranch - Name of the default branch (e.g. "main")
 * @returns GraphLayout with vertices and segments for rendering
 */
export function buildGraphLayout(
  commits: RevisionCommit[],
  refs?: Record<string, string[]>,
  defaultBranch?: string
): GraphLayout {
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
      refs: refs?.[commit.hash] ?? [],
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

  // Compute branch hints from refs
  const hints = computeBranchHints(vertices, defaultBranch);

  // Assign lanes and colors
  assignLanesAndColors(vertices, hints);

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
 * Compute lane hints based on branch refs.
 *
 * Walks first-parents from the default branch tip to build a "main line" set.
 * Non-default branch tips get assigned to separate lanes so their exclusive
 * commits visually separate from the main line.
 *
 * @returns Map from vertex index to suggested lane number
 */
function computeBranchHints(
  vertices: GraphVertex[],
  defaultBranch?: string
): Map<number, number> {
  const hints = new Map<number, number>();
  if (!defaultBranch || vertices.length === 0) return hints;

  // Find the default branch tip
  let mainTipIdx: number | null = null;
  for (const v of vertices) {
    if (v.refs.includes(defaultBranch)) {
      mainTipIdx = v.id;
      break;
    }
  }

  if (mainTipIdx === null) return hints;

  // Walk first-parents from the main tip to build the main line set
  const mainLine = new Set<number>();
  let current: number | null = mainTipIdx;
  while (current !== null) {
    mainLine.add(current);
    hints.set(current, 0); // main line → lane 0
    const v: GraphVertex = vertices[current];
    // Follow first parent (branch continuation)
    current =
      v.parentIndices.length > 0 ? v.parentIndices[0] : null;
  }

  // Find non-default branch tips and assign them to separate lanes
  let nextLane = 1;
  for (const v of vertices) {
    if (v.refs.length === 0 || v.id === mainTipIdx) continue;
    // Skip if all refs on this commit are the default branch
    if (v.refs.every((r) => r === defaultBranch)) continue;

    // Walk first-parents backward until hitting a main-line commit
    const lane = nextLane++;
    let walk: number | null = v.id;
    while (walk !== null && !mainLine.has(walk)) {
      hints.set(walk, lane);
      const wv: GraphVertex = vertices[walk];
      walk =
        wv.parentIndices.length > 0 ? wv.parentIndices[0] : null;
    }
  }

  return hints;
}

/**
 * Assign lanes (columns) and colors to vertices.
 * Uses an algorithm that follows branch continuation, prioritizing the main lane (lane 0).
 * Accepts optional lane hints from branch ref analysis.
 */
function assignLanesAndColors(
  vertices: GraphVertex[],
  hints: Map<number, number>
): void {
  // Track which lanes are occupied at each row
  const activeLanes = new Map<number, { lane: number; color: number }>();
  let nextColor = 0;

  // Process commits from newest to oldest (top to bottom)
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];

    // Check if we have a hint for this vertex (from branch ref analysis)
    const hintedLane = hints.get(i);

    let assignedLane: number | null = null;
    let assignedColor: number | null = null;

    // Hints take priority — they ensure ref-bearing commits land on the
    // correct lane even when a child on a different branch continues here.
    if (hintedLane !== undefined) {
      const usedLanes = new Set<number>();
      activeLanes.forEach(({ lane }) => usedLanes.add(lane));

      if (!usedLanes.has(hintedLane)) {
        assignedLane = hintedLane;
        // Inherit color from a child on the same lane if possible
        for (const childIdx of vertex.childIndices) {
          const child = vertices[childIdx];
          if (child.lane === hintedLane && child.parentIndices[0] === i) {
            assignedColor = child.color;
            break;
          }
        }
        if (assignedColor === null) {
          assignedColor = hintedLane === 0 ? 0 : nextColor++;
        }
      }
    }

    // Fall back to child continuation (first-parent relationship)
    if (assignedLane === null) {
      const continuingChildren: GraphVertex[] = [];
      for (const childIdx of vertex.childIndices) {
        const child = vertices[childIdx];
        if (child.parentIndices[0] === i) {
          continuingChildren.push(child);
        }
      }

      if (continuingChildren.length > 0) {
        // Prioritize children on lane 0 (main branch) to keep main line straight
        continuingChildren.sort((a, b) => a.lane - b.lane);
        assignedLane = continuingChildren[0].lane;
        assignedColor = continuingChildren[0].color;
      }
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
