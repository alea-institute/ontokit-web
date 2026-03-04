"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowDown, ArrowRight, Maximize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGraphData } from "@/lib/hooks/useGraphData";
import { computeLayout } from "@/lib/graph/elkLayout";
import { OntologyNode, type OntologyNodeData } from "./OntologyNode";
import { OntologyEdge, type OntologyEdgeData } from "./OntologyEdge";

interface OntologyGraphProps {
  focusIri: string | null;
  projectId: string;
  accessToken?: string;
  branch?: string;
  onNavigateToClass?: (iri: string) => void;
  labelHints?: Map<string, string>;
}

const nodeTypes = { ontology: OntologyNode };
const edgeTypes = { ontology: OntologyEdge };

export function OntologyGraph({
  focusIri,
  projectId,
  accessToken,
  branch,
  onNavigateToClass,
  labelHints,
}: OntologyGraphProps) {
  const { graphData, isLoading, expandNode, resetGraph, resolvedCount } =
    useGraphData({
      focusIri,
      projectId,
      accessToken,
      branch,
      labelHints,
    });

  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [colorMode, setColorMode] = useState<ColorMode>("light");

  // Detect dark mode
  useEffect(() => {
    const check = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setColorMode(isDark ? "dark" : "light");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const handleNavigate = useCallback(
    (iri: string) => {
      onNavigateToClass?.(iri);
    },
    [onNavigateToClass],
  );

  const handleExpandNode = useCallback(
    (iri: string) => {
      expandNode(iri);
    },
    [expandNode],
  );

  // SVG marker definitions for arrows
  const arrowMarker = useMemo(
    () => (
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <marker
            id="arrow-slate"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    ),
    [],
  );

  // Apply layout when graph data changes
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let cancelled = false;

    async function applyLayout() {
      const positions = await computeLayout(
        graphData!.nodes,
        graphData!.edges,
        direction,
      );
      if (cancelled) return;

      const flowNodes: Node[] = graphData!.nodes.map((n) => ({
        id: n.id,
        type: "ontology",
        position: positions.get(n.id) || { x: 0, y: 0 },
        data: {
          label: n.label,
          nodeType: n.nodeType,
          deprecated: n.deprecated,
          childCount: n.childCount,
          isExpanded: n.isExpanded,
          onNavigate: handleNavigate,
          onExpandNode: handleExpandNode,
        } as OntologyNodeData,
      }));

      const flowEdges: Edge[] = graphData!.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "ontology",
        data: { edgeType: e.edgeType } as OntologyEdgeData,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }

    applyLayout();
    return () => {
      cancelled = true;
    };
  }, [graphData, direction, handleNavigate, handleExpandNode, setNodes, setEdges]);

  const toggleDirection = useCallback(() => {
    setDirection((prev) => (prev === "TB" ? "LR" : "TB"));
  }, []);

  if (!focusIri) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select a class to view its relationship graph
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
        <button
          onClick={toggleDirection}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
            "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
          aria-label={`Switch to ${direction === "TB" ? "left-to-right" : "top-to-bottom"} layout`}
        >
          {direction === "TB" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {direction === "TB" ? "Top-Down" : "Left-Right"}
        </button>
        <button
          onClick={resetGraph}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Reset graph"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {graphData?.nodes.length ?? 0} nodes, {graphData?.edges.length ?? 0} edges
          {resolvedCount > 0 && ` (${resolvedCount} resolved)`}
        </span>
      </div>

      {/* Graph */}
      <div className="relative flex-1">
        {arrowMarker}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        )}
        {graphData && graphData.nodes.length === 1 && graphData.edges.length === 0 && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm dark:bg-slate-800/80 dark:text-slate-400">
              No relationships found for this class
            </p>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false}>
            <button
              onClick={() => {
                // Fit view is handled by Controls built-in, but add a toolbar one too
              }}
              className="react-flow__controls-button"
              aria-label="Fit view"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </Controls>
          <MiniMap
            pannable
            zoomable
            className="!bg-slate-100 dark:!bg-slate-800"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
