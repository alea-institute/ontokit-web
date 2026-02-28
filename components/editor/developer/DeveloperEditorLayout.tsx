"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, X, FileCode, TreePine, Code, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import type { IriPosition } from "@/lib/editor/indexWorker";

const OntologySourceEditor = dynamic(
  () => import("@/components/editor/OntologySourceEditor").then((mod) => mod.OntologySourceEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-white dark:bg-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    ),
  }
);

type DeveloperView = "tree" | "source";

export interface DeveloperEditorLayoutProps {
  projectId: string;
  accessToken?: string;
  activeBranch?: string;
  canEdit: boolean;
  canManage: boolean;

  // Tree state (from useOntologyTree)
  nodes: ClassTreeNode[];
  isTreeLoading: boolean;
  treeError: string | null;
  selectedIri: string | null;
  selectNode: (iri: string) => void;
  expandNode: (iri: string) => void;
  collapseNode: (iri: string) => void;
  navigateToNode: (iri: string) => Promise<void>;

  // Source state (managed by orchestrator)
  sourceContent: string;
  setSourceContent: (content: string | ((prev: string) => string)) => void;
  isLoadingSource: boolean;
  sourceError: string | null;
  isPreloading: boolean;
  loadSourceContent: (isPreload?: boolean) => Promise<void>;
  sourceIriIndex: Map<string, IriPosition>;
  pendingScrollIri: string | null;
  setPendingScrollIri: (iri: string | null) => void;
  sourceEditorRef: React.RefObject<OntologySourceEditorRef | null>;

  // Actions
  onSaveSource: (content: string) => Promise<void>;
  onAddEntity: (parentIri?: string) => void;

  // Detail panel
  selectedNodeFallback: TreeNodeFallback | null;

  // Side panels
  showHealthCheck: boolean;
  onCloseHealthCheck: () => void;
}

export function DeveloperEditorLayout(props: DeveloperEditorLayoutProps) {
  const {
    projectId,
    accessToken,
    activeBranch,
    canEdit,
    canManage,
    nodes,
    isTreeLoading,
    treeError,
    selectedIri,
    selectNode,
    expandNode,
    collapseNode,
    navigateToNode,
    sourceContent,
    setSourceContent,
    isLoadingSource,
    sourceError,
    isPreloading,
    loadSourceContent,
    sourceIriIndex,
    pendingScrollIri,
    setPendingScrollIri,
    sourceEditorRef,
    onSaveSource,
    onAddEntity,
    selectedNodeFallback,
    showHealthCheck,
    onCloseHealthCheck,
  } = props;

  const [viewMode, setViewMode] = useState<DeveloperView>("tree");
  const preloadStartedRef = useRef(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Preload source on hover
  const handleSourceTabHover = useCallback(() => {
    if (!sourceContent && !isLoadingSource && !isPreloading && !preloadStartedRef.current) {
      preloadStartedRef.current = true;
      loadSourceContent(true);
    }
  }, [sourceContent, isLoadingSource, isPreloading, loadSourceContent]);

  // Load source when switching to source view
  useEffect(() => {
    if (viewMode === "source" && !sourceContent && !isLoadingSource && !isPreloading) {
      loadSourceContent(false);
    }
  }, [viewMode, sourceContent, isLoadingSource, isPreloading, loadSourceContent]);

  const handleViewModeChange = useCallback((mode: DeveloperView) => {
    if (viewMode === "source" && mode !== "source" && sourceEditorRef.current) {
      setSourceContent(sourceEditorRef.current.getValue());
    }
    setViewMode(mode);
  }, [viewMode, sourceEditorRef, setSourceContent]);

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

  const handleNavigateToSource = useCallback((iri: string) => {
    setViewMode("source");
    setPendingScrollIri(iri);
    if (sourceEditorRef.current && sourceIriIndex.size > 0) {
      sourceEditorRef.current.scrollToIri(iri);
    }
  }, [sourceIriIndex, sourceEditorRef, setPendingScrollIri]);

  return (
    <div className="flex h-full flex-col">
      {/* Developer Sub-Header: View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={() => handleViewModeChange("tree")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "tree"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            <TreePine className="h-4 w-4" />
            <span className="hidden sm:inline">Tree</span>
          </button>
          <button
            onClick={() => handleViewModeChange("source")}
            onMouseEnter={handleSourceTabHover}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "source"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
            {isPreloading && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {viewMode === "tree" ? (
          <>
            {/* Left Panel - Class Tree */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {showSearch ? "Search" : "Class Hierarchy"}
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

            {/* Center Panel - Class Details */}
            <div className="flex-1 bg-white dark:bg-slate-800">
              <ClassDetailPanel
                projectId={projectId}
                classIri={selectedIri}
                accessToken={accessToken}
                branch={activeBranch}
                onNavigateToClass={(iri) => navigateToNode(iri)}
                onNavigateToSource={handleNavigateToSource}
                selectedNodeFallback={selectedNodeFallback}
              />
            </div>

            {/* Right Panel - Health Check */}
            {showHealthCheck && (
              <div className="w-96 flex-shrink-0">
                <HealthCheckPanel
                  projectId={projectId}
                  accessToken={accessToken}
                  isOpen={showHealthCheck}
                  onClose={onCloseHealthCheck}
                  onNavigateToClass={(iri) => navigateToNode(iri)}
                  canRunLint={canManage}
                />
              </div>
            )}
          </>
        ) : (
          /* Source View */
          <div className="flex-1 bg-white dark:bg-slate-800">
            {isLoadingSource ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading source...</p>
                </div>
              </div>
            ) : sourceError ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <FileCode className="mx-auto h-12 w-12 text-red-400" />
                  <h3 className="mt-4 text-lg font-medium text-red-700 dark:text-red-400">
                    Failed to load source
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sourceError}</p>
                  <Button variant="outline" size="sm" onClick={() => loadSourceContent(false)} className="mt-4">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <OntologySourceEditor
                ref={sourceEditorRef}
                projectId={projectId}
                initialValue={sourceContent}
                accessToken={accessToken}
                readOnly={!canEdit}
                onSave={onSaveSource}
                onNavigateToClass={async (iri) => {
                  handleViewModeChange("tree");
                  try {
                    await navigateToNode(iri);
                  } catch {
                    console.log(`Could not navigate to ${iri} - may not be a class`);
                  }
                }}
                height="100%"
                prebuiltIriIndex={sourceIriIndex}
                pendingScrollIri={pendingScrollIri}
                onScrollComplete={() => setPendingScrollIri(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
