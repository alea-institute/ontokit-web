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
import { ArrowDown, ArrowRight, ChevronDown, ChevronUp, Maximize2, RotateCcw } from "lucide-react";
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

function GraphLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute bottom-2 right-2 z-20">
      <div className="rounded-lg border border-slate-200 bg-white/95 shadow-xs backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
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
            {/* Node types */}
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Nodes
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <LegendNodeItem color="border-2 border-primary-500 bg-primary-50 dark:bg-primary-950/40" label="Focus" />
              <LegendNodeItem color="border border-slate-300 bg-white dark:bg-slate-800" label="Class" />
              <LegendNodeItem color="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30" label="Root" />
              <LegendNodeItem color="border border-pink-300 bg-pink-50 dark:bg-pink-950/30" label="Individual" badge="I" badgeColor="bg-pink-200 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" />
              <LegendNodeItem color="border border-blue-300 bg-blue-50 dark:bg-blue-950/30" label="Property" badge="P" badgeColor="bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" />
              <LegendNodeItem color="border border-slate-200 bg-slate-50 dark:bg-slate-900" label="External" />
              <LegendNodeItem color="border border-dashed border-slate-300 bg-white dark:bg-slate-800" label="Unexplored" />
            </div>
            {/* Edge types */}
            <div className="mb-1 mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Edges
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <LegendEdgeItem stroke="#94a3b8" label="subClassOf" />
              <LegendEdgeItem stroke="#3b82f6" dasharray="5 3" label="equivalentTo" />
              <LegendEdgeItem stroke="#ef4444" dasharray="5 3" label="disjointWith" />
              <LegendEdgeItem stroke="#9ca3af" dasharray="2 4" label="seeAlso" />
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
      <div className={cn("h-3 w-5 shrink-0 rounded-xs", color)} />
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
            "flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
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
          className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
            <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-xs dark:bg-slate-800/80 dark:text-slate-400">
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
            className="bg-slate-100! dark:bg-slate-800!"
          />
        </ReactFlow>
        <GraphLegend />
      </div>
    </div>
  );
}
