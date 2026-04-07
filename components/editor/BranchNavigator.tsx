"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ClassTreeNode } from "@/lib/ontology/types";

export interface BranchNavigatorProps {
  nodes: ClassTreeNode[];
  selectedIri: string | null;
  onNavigate: (iri: string) => void;
  autoSuggestOnNavigate?: boolean;
  onAutoSuggest?: (iri: string) => void;
  /** Flat alternative for property lists (Plan 04) */
  simpleNodes?: { iri: string; label: string }[];
}

/**
 * Recursively search tree nodes for the parent of targetIri.
 * Returns the parent node whose children[] array contains targetIri,
 * or null if targetIri is at root level.
 */
function findParent(
  nodes: ClassTreeNode[],
  targetIri: string
): ClassTreeNode | null {
  for (const node of nodes) {
    if (node.children.some((child) => child.iri === targetIri)) {
      return node;
    }
    const found = findParent(node.children, targetIri);
    if (found) return found;
  }
  return null;
}

export function BranchNavigator({
  nodes,
  selectedIri,
  onNavigate,
  autoSuggestOnNavigate,
  onAutoSuggest,
  simpleNodes,
}: BranchNavigatorProps) {
  const autoSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (autoSuggestTimerRef.current) {
        clearTimeout(autoSuggestTimerRef.current);
      }
    };
  }, []);

  // Compute siblings and current index
  const { siblings, currentIndex } = useMemo(() => {
    // If simpleNodes is provided, use flat list
    if (simpleNodes && simpleNodes.length > 0) {
      const idx = selectedIri
        ? simpleNodes.findIndex((n) => n.iri === selectedIri)
        : -1;
      return {
        siblings: simpleNodes.map((n) => ({ iri: n.iri })),
        currentIndex: idx,
      };
    }

    if (!selectedIri || nodes.length === 0) {
      return { siblings: [] as { iri: string }[], currentIndex: -1 };
    }

    const parent = findParent(nodes, selectedIri);
    const siblingNodes = parent ? parent.children : nodes;
    const idx = siblingNodes.findIndex((n) => n.iri === selectedIri);

    return {
      siblings: siblingNodes.map((n) => ({ iri: n.iri })),
      currentIndex: idx,
    };
  }, [nodes, selectedIri, simpleNodes]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < siblings.length - 1;

  const handleNavigate = useCallback(
    (targetIri: string) => {
      // Clear any pending auto-suggest timer
      if (autoSuggestTimerRef.current) {
        clearTimeout(autoSuggestTimerRef.current);
        autoSuggestTimerRef.current = null;
      }

      onNavigate(targetIri);

      // Debounce auto-suggest: wait 800ms after navigation
      if (autoSuggestOnNavigate && onAutoSuggest) {
        autoSuggestTimerRef.current = setTimeout(() => {
          onAutoSuggest(targetIri);
          autoSuggestTimerRef.current = null;
        }, 800);
      }
    },
    [onNavigate, autoSuggestOnNavigate, onAutoSuggest]
  );

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      handleNavigate(siblings[currentIndex - 1].iri);
    }
  }, [hasPrev, siblings, currentIndex, handleNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      handleNavigate(siblings[currentIndex + 1].iri);
    }
  }, [hasNext, siblings, currentIndex, handleNavigate]);

  // Don't render if no siblings or not found in tree
  if (siblings.length <= 1 || currentIndex < 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="Previous class in branch"
        className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span
        className="text-xs text-slate-400 tabular-nums"
        aria-live="polite"
      >
        {currentIndex + 1} / {siblings.length}
      </span>

      <button
        type="button"
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="Next class in branch"
        className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
