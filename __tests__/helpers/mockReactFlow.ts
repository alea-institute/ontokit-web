/**
 * Shared ReactFlow mock for graph component tests.
 *
 * Usage in test files:
 *   vi.mock("@xyflow/react", () => reactFlowMock);
 */
import { vi } from "vitest";
import React from "react";

export const reactFlowMock = {
  __esModule: true,
  ReactFlow: ({ nodes, edges, children, ...props }: Record<string, unknown>) =>
    React.createElement(
      "div",
      { "data-testid": "react-flow", "data-nodes": JSON.stringify(nodes), "data-edges": JSON.stringify(edges), ...props },
      children as React.ReactNode,
    ),
  Background: () => React.createElement("div", { "data-testid": "rf-background" }),
  Controls: () => React.createElement("div", { "data-testid": "rf-controls" }),
  MiniMap: () => React.createElement("div", { "data-testid": "rf-minimap" }),
  Panel: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("div", { "data-testid": "rf-panel", ...props }, children as React.ReactNode),
  Handle: ({ type, position, ...props }: Record<string, unknown>) =>
    React.createElement("div", { "data-testid": `rf-handle-${type}`, "data-position": position, ...props }),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setCenter: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
};
