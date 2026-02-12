/**
 * Git Graph Type Definitions
 * Types for visualizing git branch topology, merge commits, and parent-child relationships.
 */

/**
 * A point on the graph grid
 */
export interface GridPoint {
  x: number; // lane (column) position
  y: number; // row position (commit index)
}

/**
 * A vertex representing a commit in the graph
 */
export interface GraphVertex {
  id: number; // index in the commits array
  hash: string; // full commit hash
  parentIndices: number[]; // indices of parent commits in the array
  childIndices: number[]; // indices of child commits in the array
  lane: number; // x position (column)
  color: number; // branch color index (for consistent coloring)
  isMerge: boolean; // true if this is a merge commit (2+ parents)
}

/**
 * A segment of a branch line connecting two commits
 */
export interface BranchSegment {
  from: GridPoint;
  to: GridPoint;
  isMergeLine: boolean; // true if this is a secondary parent connection
  colorIndex: number;
}

/**
 * Represents a visual branch in the graph
 */
export interface GraphBranch {
  colorIndex: number;
  segments: BranchSegment[];
}

/**
 * The complete graph layout computed from commits
 */
export interface GraphLayout {
  vertices: GraphVertex[];
  segments: BranchSegment[];
  width: number; // max lanes + 1
  height: number; // number of commits
}

/**
 * Configuration options for graph rendering
 */
export interface GraphConfig {
  cellHeight: number; // height of each row in pixels
  cellWidth: number; // width of each lane in pixels
  nodeRadius: number; // radius of commit nodes
  lineWidth: number; // width of branch lines
  selectedNodeRadius: number; // radius when node is selected
  colors: string[]; // branch colors palette
}

/**
 * Default graph configuration
 */
export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  cellHeight: 50,
  cellWidth: 20,
  nodeRadius: 4,
  lineWidth: 2,
  selectedNodeRadius: 5,
  colors: [
    "#4a9eff", // blue
    "#ff6b6b", // red
    "#4ecdc4", // teal
    "#ffe66d", // yellow
    "#95e1a3", // green
    "#c9b1ff", // purple
    "#ff9f43", // orange
    "#a8e6cf", // mint
  ],
};
