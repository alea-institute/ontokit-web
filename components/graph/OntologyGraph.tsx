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
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowDown, ArrowRight, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGraphData } from "@/lib/hooks/useGraphData";
import { useELKLayout, type LayoutDirection } from "@/lib/graph/useELKLayout";
import { OntologyNode } from "./OntologyNode";
import { OntologyEdge } from "./OntologyEdge";

interface OntologyGraphProps {
  focusIri: string | null;
  projectId: string;
  branch?: string;
  onNavigateToClass?: (iri: string) => void;
}

const nodeTypes = { ontologyNode: OntologyNode };
const edgeTypes = { ontologyEdge: OntologyEdge };

function GraphLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute bottom-2 right-2 z-20">
      <div className="rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
          aria-label={expanded ? "Collapse legend" : "Expand legend"}
        >
          Legend
          {expanded ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronUp className="ml-auto h-3 w-3" />}
        </button>
        {expanded && (
          <div className="border-t border-slate-200 px-2.5 pb-2 pt-1.5 dark:border-slate-700">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Nodes
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <LegendNodeItem color="border-2 border-primary-500 bg-primary-50 dark:bg-primary-950/40" label="Focus" />
              <LegendNodeItem color="border border-slate-300 bg-white dark:bg-slate-800" label="Class" />
              <LegendNodeItem color="border-[3px] border-red-500 bg-red-50 dark:bg-red-950/30" label="Root ancestor" />
              <LegendNodeItem color="border border-pink-300 bg-pink-50 dark:bg-pink-950/30" label="Individual" badge="I" badgeColor="bg-pink-200 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" />
              <LegendNodeItem color="border border-blue-300 bg-blue-50 dark:bg-blue-950/30" label="Property" badge="P" badgeColor="bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" />
              <LegendNodeItem color="border border-slate-200 bg-slate-50 dark:bg-slate-900" label="External" />
              <LegendNodeItem color="border border-dashed border-slate-300 bg-white dark:bg-slate-800" label="Unexplored" />
            </div>
            <div className="mb-1 mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Edges
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <LegendEdgeItem stroke="#94a3b8" label="subClassOf" />
              <LegendEdgeItem stroke="#3b82f6" dasharray="5 3" label="equivalentTo" />
              <LegendEdgeItem stroke="#ef4444" dasharray="5 3" label="disjointWith" />
              <LegendEdgeItem stroke="#8b5cf6" dasharray="6 3" label="rdfs:seeAlso" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendNodeItem({
  color,
  label,
  badge,
  badgeColor,
}: {
  color: string;
  label: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("h-3 w-5 shrink-0 rounded-sm", color)} />
      {badge && badgeColor && (
        <span className={cn("flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] font-bold", badgeColor)}>
          {badge}
        </span>
      )}
      <span className="text-[10px] text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

function LegendEdgeItem({
  stroke,
  dasharray,
  label,
}: {
  stroke: string;
  dasharray?: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <svg className="h-3 w-5 shrink-0" viewBox="0 0 20 12">
        <line
          x1="0"
          y1="6"
          x2="20"
          y2="6"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={dasharray}
        />
      </svg>
      <span className="text-[10px] text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

export function OntologyGraph({
  focusIri,
  projectId,
  branch,
  onNavigateToClass,
}: OntologyGraphProps) {
  const {
    graphData,
    isLoading,
    showDescendants,
    setShowDescendants,
    expandNode,
    resetGraph,
    resolvedCount,
  } = useGraphData({ focusIri, projectId, branch });

  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const { nodes: layoutNodes, edges: layoutEdges, isLayouting, runLayout } = useELKLayout();
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

  // Run ELK layout when data or direction changes
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;
    runLayout(graphData, direction).catch(() => {
      // Layout failed — nodes stay empty
    });
  }, [graphData, direction, runLayout]);

  // Sync layout results to React Flow state
  useEffect(() => {
    if (layoutNodes.length > 0) {
      setNodes(layoutNodes);
      setEdges(layoutEdges);
    }
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  // Progressive expansion: click to expand or navigate
  const expandedNodes = useMemo(() => new Set<string>(focusIri ? [focusIri] : []), [focusIri]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (expandedNodes.has(node.id)) {
        onNavigateToClass?.(node.id);
        return;
      }
      expandedNodes.add(node.id);
      expandNode(node.id);
    },
    [expandedNodes, expandNode, onNavigateToClass],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNavigateToClass?.(node.id);
    },
    [onNavigateToClass],
  );

  // SVG marker definitions
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
          onClick={() => setDirection((d) => (d === "TB" ? "LR" : "TB"))}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
          onClick={() => setShowDescendants(!showDescendants)}
          className={cn(
            "rounded border px-2 py-0.5 text-xs",
            showDescendants
              ? "border-blue-300 bg-blue-50 font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
          aria-label={showDescendants ? "Hide descendants" : "Show descendants"}
        >
          {showDescendants ? "Descendants: On" : "Show Descendants"}
        </button>
        <button
          onClick={resetGraph}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Reset graph"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        {isLayouting && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-blue-600" />
            Computing layout...
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {resolvedCount} nodes, {graphData?.edges.length ?? 0} edges
        </span>
        {graphData?.truncated && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Truncated ({graphData.total_concept_count} discovered)
          </span>
        )}
      </div>

      {/* Graph */}
      <div className="relative flex-1">
        {arrowMarker}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <span className="text-sm text-slate-500">Loading entity graph...</span>
            </div>
          </div>
        )}
        {graphData && graphData.nodes.length === 0 && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">No graph data available</p>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.2, duration: 400 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "ontologyEdge" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              const nodeType = node.data?.nodeType;
              if (nodeType === "focus") return "#3b82f6";
              if (nodeType === "root") return "#ef4444";
              if (nodeType === "property") return "#93c5fd";
              if (nodeType === "individual") return "#f9a8d4";
              if (nodeType === "external") return "#e2e8f0";
              return "#d1d5db";
            }}
            maskColor="rgba(0,0,0,0.1)"
            className="!bg-slate-100 dark:!bg-slate-800"
          />
        </ReactFlow>
        <GraphLegend />
      </div>
    </div>
  );
}
