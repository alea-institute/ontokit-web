"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";

export interface StandardEditorLayoutProps {
  projectId: string;
  accessToken?: string;
  activeBranch?: string;
  canEdit: boolean;

  // Tree state (from useOntologyTree)
  nodes: ClassTreeNode[];
  isTreeLoading: boolean;
  treeError: string | null;
  selectedIri: string | null;
  selectNode: (iri: string) => void;
  expandNode: (iri: string) => void;
  collapseNode: (iri: string) => void;
  navigateToNode: (iri: string) => Promise<void>;

  // Actions
  onAddEntity: (parentIri?: string) => void;

  // Detail panel
  selectedNodeFallback: TreeNodeFallback | null;
}

export function StandardEditorLayout(props: StandardEditorLayoutProps) {
  const {
    projectId,
    accessToken,
    activeBranch,
    canEdit,
    nodes,
    isTreeLoading,
    treeError,
    selectedIri,
    selectNode,
    expandNode,
    collapseNode,
    navigateToNode,
    onAddEntity,
    selectedNodeFallback,
  } = props;

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setSearchQuery("");
        setSearchResults(null);
      }
      return !prev;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  const handleSearchSelect = useCallback((iri: string) => {
    navigateToNode(iri);
    closeSearch();
  }, [navigateToNode, closeSearch]);

  // Debounced search
  useEffect(() => {
    if (!showSearch) return;
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await projectOntologyApi.searchEntities(
          projectId,
          searchQuery.trim(),
          accessToken,
          activeBranch,
        );
        setSearchResults(response.results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, projectId, accessToken, activeBranch]);

  return (
    <div className="flex h-full">
      {/* Left Panel - Class Tree */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {showSearch ? "Search" : "Classes"}
            </h2>
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  onClick={() => onAddEntity()}
                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Add entity"
                >
                  <Plus className="h-4 w-4 text-slate-500" />
                </button>
              )}
              <button
                onClick={handleToggleSearch}
                className={cn(
                  "rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700",
                  showSearch && "bg-slate-100 dark:bg-slate-700",
                )}
              >
                {showSearch ? (
                  <X className="h-4 w-4 text-slate-500" />
                ) : (
                  <Search className="h-4 w-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeSearch();
                }}
                placeholder="Search classes, properties, individuals..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          )}
        </div>

        <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
          {isTreeLoading && nodes.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            </div>
          ) : treeError ? (
            <div className="p-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">{treeError}</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No classes found in this ontology
              </p>
            </div>
          ) : (
            <ClassTree
              nodes={nodes}
              selectedIri={selectedIri}
              onSelect={selectNode}
              onExpand={expandNode}
              onCollapse={collapseNode}
              onAddChild={canEdit ? (parentIri: string) => onAddEntity(parentIri) : undefined}
              searchResults={showSearch ? searchResults : undefined}
              isSearching={isSearching}
              onSearchSelect={handleSearchSelect}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Class Details */}
      <div className="flex-1 bg-white dark:bg-slate-800">
        <ClassDetailPanel
          projectId={projectId}
          classIri={selectedIri}
          accessToken={accessToken}
          branch={activeBranch}
          onNavigateToClass={(iri) => navigateToNode(iri)}
          selectedNodeFallback={selectedNodeFallback}
        />
      </div>
    </div>
  );
}
