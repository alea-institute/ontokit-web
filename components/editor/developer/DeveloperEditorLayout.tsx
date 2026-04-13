"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { FileCode, TreePine, Code, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { ResizablePanelDivider } from "@/components/editor/ResizablePanelDivider";
import { EntityTabBar, type EntityTab } from "@/components/editor/standard/EntityTabBar";
import { PropertyTree } from "@/components/editor/standard/PropertyTree";
import { IndividualList } from "@/components/editor/standard/IndividualList";
import { PropertyDetailPanel } from "@/components/editor/PropertyDetailPanel";
import { IndividualDetailPanel } from "@/components/editor/IndividualDetailPanel";
import { EntityTreeToolbar } from "@/components/editor/shared/EntityTreeToolbar";
import { DraggableTreeWrapper } from "@/components/editor/shared/DraggableTreeWrapper";
import { useTreeSearch } from "@/lib/hooks/useTreeSearch";
import { useFilteredTree } from "@/lib/hooks/useFilteredTree";
import { useTreeDragDrop, type DragMode } from "@/lib/hooks/useTreeDragDrop";
import { useToast } from "@/lib/context/ToastContext";
import type { ClassUpdatePayload } from "@/lib/api/client";
import type { TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";
import type { TurtleIndividualUpdateData } from "@/lib/ontology/turtleIndividualUpdater";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import type { IriPosition } from "@/lib/editor/indexWorker";
import { useDraftStore } from "@/lib/stores/draftStore";
import { getLocalName } from "@/lib/utils";
import { extractTreeLabelMap } from "@/lib/graph/buildGraphData";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";

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

const OntologyGraph = dynamic(
  () => import("@/components/graph/OntologyGraph").then((mod) => mod.OntologyGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-white dark:bg-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    ),
  }
);

type DeveloperView = "tree" | "source" | "graph";

export interface DeveloperEditorLayoutProps {
  projectId: string;
  accessToken?: string;
  activeBranch?: string;
  canEdit: boolean;
  canSuggest?: boolean;
  isSuggestionMode?: boolean;
  // Tree state (from useOntologyTree)
  nodes: ClassTreeNode[];
  isTreeLoading: boolean;
  treeError: string | null;
  selectedIri: string | null;
  selectNode: (iri: string) => void;
  expandNode: (iri: string) => void;
  collapseNode: (iri: string) => void;
  expandOneLevel: () => Promise<void>;
  expandAllFully: () => Promise<void>;
  collapseAll: () => void;
  collapseOneLevel: () => void;
  hasExpandableNodes: boolean;
  hasExpandedNodes: boolean;
  isExpandingAll: boolean;
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
  onDeleteClass?: (iri: string, label: string) => void;
  onCopyIri?: (iri: string) => void;

  // Detail panel
  selectedNodeFallback: TreeNodeFallback | null;

  // Class editing
  onUpdateClass?: (classIri: string, data: ClassUpdatePayload) => Promise<void>;
  detailRefreshKey?: number;

  // Property & Individual editing
  onUpdateProperty?: (propertyIri: string, data: TurtlePropertyUpdateData) => Promise<void>;
  onUpdateIndividual?: (individualIri: string, data: TurtleIndividualUpdateData) => Promise<void>;

  // Drag-and-drop reparenting
  onReparentClass?: (classIri: string, oldParentIris: string[], newParentIris: string[], mode: DragMode) => Promise<void>;
  reparentOptimistic?: (iri: string, oldParentIri: string | null, newParentIri: string | null) => { previousNodes: ClassTreeNode[] };
  rollbackReparent?: (snapshot: { previousNodes: ClassTreeNode[] }) => void;
}

export function DeveloperEditorLayout(props: DeveloperEditorLayoutProps) {
  const {
    projectId,
    accessToken,
    activeBranch,
    canEdit,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canSuggest = false,
    isSuggestionMode = false,
    nodes,
    isTreeLoading,
    treeError,
    selectedIri,
    selectNode,
    expandNode,
    collapseNode,
    expandOneLevel,
    expandAllFully,
    collapseAll,
    collapseOneLevel,
    hasExpandableNodes,
    hasExpandedNodes,
    isExpandingAll,
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
    onDeleteClass,
    onCopyIri,
    selectedNodeFallback,
    onUpdateClass,
    detailRefreshKey,
    onUpdateProperty,
    onUpdateIndividual,
    onReparentClass,
    reparentOptimistic,
    rollbackReparent,
  } = props;

  const toast = useToast();
  const { announce } = useAnnounce();

  // Draft badges
  const getDraftIris = useDraftStore((s) => s.getDraftIris);
  const drafts = useDraftStore((s) => s.drafts);
  const draftIris = useMemo(
    () => new Set(getDraftIris(projectId, activeBranch || "main")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDraftIris, projectId, activeBranch, drafts],
  );

  // Tree label hints for graph nodes and detail panels
  const treeLabelHints = useMemo(() => extractTreeLabelMap(nodes), [nodes]);
  const treeLabelHintsRecord = useMemo(() => Object.fromEntries(treeLabelHints), [treeLabelHints]);

  // Drag-and-drop reparenting
  const handleDndReparent = useCallback(async (
    classIri: string,
    oldParentIris: string[],
    newParentIris: string[],
    mode: DragMode,
  ) => {
    if (!onReparentClass || !reparentOptimistic || !rollbackReparent) return;

    const oldTreeParent = oldParentIris[0] || null;
    const newTreeParent = newParentIris[0] || null;
    const snapshot = reparentOptimistic(classIri, oldTreeParent, newTreeParent);

    try {
      await onReparentClass(classIri, oldParentIris, newParentIris, mode);
    } catch (err) {
      rollbackReparent(snapshot);
      toast.error(
        "Failed to reparent class",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }, [onReparentClass, reparentOptimistic, rollbackReparent, toast]);

  const {
    dragState,
    undoAction,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleUndo,
    clearUndo,
    handleDragEnterNode,
    handleDragLeaveNode,
  } = useTreeDragDrop({
    nodes,
    canEdit: canEdit || isSuggestionMode,
    expandNode,
    onReparent: handleDndReparent,
    onAnnounce: announce,
  });

  // Show undo toast when reparent succeeds
  useEffect(() => {
    if (undoAction) {
      const label = undoAction.classLabel || getLocalName(undoAction.classIri);
      toast.addToast({
        type: "success",
        title: `Moved "${label}"`,
        duration: 5000,
        action: {
          label: "Undo",
          onClick: handleUndo,
        },
      });
      clearUndo();
    }
  }, [undoAction, toast, handleUndo, clearUndo]);

  const [viewMode, setViewMode] = useState<DeveloperView>("tree");
  const preloadStartedRef = useRef(false);

  // Panel width state (default 320px = w-80)
  const [treePanelWidth, setTreePanelWidth] = useState(320);

  // Entity tab state
  const [activeTab, setActiveTab] = useState<EntityTab>("classes");

  // Track selected entity per tab (properties/individuals have their own selection)
  const [selectedPropertyIri, setSelectedPropertyIri] = useState<string | null>(null);
  const [selectedIndividualIri, setSelectedIndividualIri] = useState<string | null>(null);

  // Shared search state
  const {
    showSearch,
    searchQuery,
    searchResults,
    isSearching,
    searchInputRef,
    toggleSearch,
    closeSearch,
    setSearchQuery,
    handleSearchSelect: baseSearchSelect,
  } = useTreeSearch({
    projectId,
    accessToken,
    branch: activeBranch,
    onSearchSelect: navigateToNode,
  });

  // Filtered tree search for classes
  const { filteredNodes, isBuilding: isFilteredTreeBuilding, truncated: filteredTreeTruncated } = useFilteredTree({
    searchResults: showSearch ? searchResults : null,
    projectId,
    accessToken,
    branch: activeBranch,
  });

  const handleSearchSelect = (iri: string) => {
    baseSearchSelect(iri);
    closeSearch();
  };

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
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
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
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
            {isPreloading && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
            )}
          </button>
          <button
            onClick={() => handleViewModeChange("graph")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "graph"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Graph</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {viewMode === "graph" ? (
          <div className="flex-1 bg-white dark:bg-slate-800">
            <OntologyGraph
              focusIri={selectedIri}
              projectId={projectId}
              accessToken={accessToken}
              branch={activeBranch}
              labelHints={treeLabelHints}
              onNavigateToClass={(iri) => {
                handleViewModeChange("tree");
                navigateToNode(iri);
              }}
            />
          </div>
        ) : viewMode === "tree" ? (
          <>
            {/* Left Panel - Entity Tree/List with tabs */}
            <div className="flex-shrink-0 bg-white dark:bg-slate-800" style={{ width: treePanelWidth }}>
              {/* Entity Type Tabs */}
              <EntityTabBar activeTab={activeTab} onTabChange={setActiveTab} />

              {/* Toolbar: add + expand/collapse + search */}
              <EntityTreeToolbar
                canAdd={canEdit && activeTab === "classes"}
                onAdd={() => onAddEntity()}
                showSearch={showSearch}
                searchQuery={searchQuery}
                onToggleSearch={toggleSearch}
                onSearchChange={setSearchQuery}
                onCloseSearch={closeSearch}
                searchInputRef={searchInputRef}
                onExpandOneLevel={activeTab === "classes" ? expandOneLevel : undefined}
                onExpandAllFully={activeTab === "classes" ? expandAllFully : undefined}
                onCollapseAll={activeTab === "classes" ? collapseAll : undefined}
                onCollapseOneLevel={activeTab === "classes" ? collapseOneLevel : undefined}
                hasExpandableNodes={activeTab === "classes" ? hasExpandableNodes : false}
                hasExpandedNodes={activeTab === "classes" ? hasExpandedNodes : false}
                isExpandingAll={activeTab === "classes" ? isExpandingAll : false}
              />

              {/* Tab Content */}
              <div className="h-[calc(100%-5.5rem)] overflow-y-auto">
                {activeTab === "classes" && (
                  <>
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
                      <DraggableTreeWrapper
                        isDragActive={dragState.isDragActive}
                        draggedLabel={dragState.draggedLabel}
                        dragMode={dragState.dragMode}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                      >
                        <ClassTree
                          nodes={nodes}
                          selectedIri={selectedIri}
                          onSelect={selectNode}
                          onExpand={expandNode}
                          onCollapse={collapseNode}
                          onAddChild={canEdit ? (parentIri: string) => onAddEntity(parentIri) : undefined}
                          onCopyIri={onCopyIri}
                          onDelete={canEdit ? onDeleteClass : undefined}
                          onViewInSource={handleNavigateToSource}
                          searchResults={showSearch ? searchResults : undefined}
                          isSearching={isSearching}
                          onSearchSelect={handleSearchSelect}
                          searchQuery={searchQuery}
                          draftIris={draftIris}
                          filteredTree={filteredNodes}
                          isFilteredTreeBuilding={isFilteredTreeBuilding}
                          filteredTreeTruncated={filteredTreeTruncated}
                          dragState={!showSearch && (canEdit || isSuggestionMode) ? dragState : undefined}
                          onDragEnterNode={handleDragEnterNode}
                          onDragLeaveNode={handleDragLeaveNode}
                        />
                      </DraggableTreeWrapper>
                    )}
                  </>
                )}

                {activeTab === "properties" && (
                  <PropertyTree
                    projectId={projectId}
                    accessToken={accessToken}
                    branch={activeBranch}
                    selectedIri={selectedPropertyIri}
                    onSelect={setSelectedPropertyIri}
                  />
                )}

                {activeTab === "individuals" && (
                  <IndividualList
                    projectId={projectId}
                    accessToken={accessToken}
                    branch={activeBranch}
                    selectedIri={selectedIndividualIri}
                    onSelect={setSelectedIndividualIri}
                  />
                )}
              </div>
            </div>

            {/* Draggable Divider */}
            <ResizablePanelDivider
              width={treePanelWidth}
              onWidthChange={setTreePanelWidth}
              minWidth={200}
              maxWidth={600}
            />

            {/* Center Panel - Entity Details */}
            <div className="min-w-0 flex-1 bg-white dark:bg-slate-800">
              {activeTab === "classes" ? (
                <ClassDetailPanel
                  projectId={projectId}
                  classIri={selectedIri}
                  accessToken={accessToken}
                  branch={activeBranch}
                  onNavigateToClass={(iri) => navigateToNode(iri)}
                  onNavigateToSource={handleNavigateToSource}
                  onCopyIri={onCopyIri}
                  selectedNodeFallback={selectedNodeFallback}
                  canEdit={canEdit || isSuggestionMode}
                  isSuggestionMode={isSuggestionMode}
                  onUpdateClass={onUpdateClass}
                  refreshKey={detailRefreshKey}
                />
              ) : activeTab === "properties" ? (
                <PropertyDetailPanel
                  projectId={projectId}
                  propertyIri={selectedPropertyIri}
                  sourceContent={sourceContent || ""}
                  canEdit={canEdit}
                  onUpdateProperty={onUpdateProperty}
                  branch={activeBranch}
                  refreshKey={detailRefreshKey}
                  onNavigateToEntity={(iri) => navigateToNode(iri)}
                  onCopyIri={onCopyIri}
                  accessToken={accessToken}
                  labelHints={treeLabelHintsRecord}
                />
              ) : (
                <IndividualDetailPanel
                  projectId={projectId}
                  individualIri={selectedIndividualIri}
                  sourceContent={sourceContent || ""}
                  canEdit={canEdit}
                  onUpdateIndividual={onUpdateIndividual}
                  branch={activeBranch}
                  refreshKey={detailRefreshKey}
                  onNavigateToEntity={(iri) => navigateToNode(iri)}
                  onCopyIri={onCopyIri}
                  accessToken={accessToken}
                  labelHints={treeLabelHintsRecord}
                />
              )}
            </div>

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
