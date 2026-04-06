"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { EntityTabBar, type EntityTab } from "@/components/editor/standard/EntityTabBar";
import { PropertyTree } from "@/components/editor/standard/PropertyTree";
import { IndividualList } from "@/components/editor/standard/IndividualList";
import { PropertyDetailPanel } from "@/components/editor/PropertyDetailPanel";
import { IndividualDetailPanel } from "@/components/editor/IndividualDetailPanel";
import { ResizablePanelDivider } from "@/components/editor/ResizablePanelDivider";
import { EntityTreeToolbar } from "@/components/editor/shared/EntityTreeToolbar";
import { useTreeSearch } from "@/lib/hooks/useTreeSearch";
import { useFilteredTree } from "@/lib/hooks/useFilteredTree";
import { Share2, ArrowLeft, Maximize2 } from "lucide-react";
import { EntityGraphModal } from "@/components/graph/EntityGraphModal";
import { DraggableTreeWrapper } from "@/components/editor/shared/DraggableTreeWrapper";
import { useTreeDragDrop, type DragMode } from "@/lib/hooks/useTreeDragDrop";
import { useToast } from "@/lib/context/ToastContext";

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
import type { ClassUpdatePayload } from "@/lib/api/client";
import type { TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";
import type { TurtleIndividualUpdateData } from "@/lib/ontology/turtleIndividualUpdater";
import type { ClassTreeNode } from "@/lib/ontology/types";
import { useDraftStore } from "@/lib/stores/draftStore";
import { getLocalName } from "@/lib/utils";
import { extractTreeLabelMap } from "@/lib/graph/utils";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";

export interface StandardEditorLayoutProps {
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

  // Actions
  onAddEntity: (parentIri?: string) => void;
  onDeleteClass?: (iri: string, label: string) => void;
  onCopyIri?: (iri: string) => void;

  // Detail panel
  selectedNodeFallback: TreeNodeFallback | null;

  // Class editing
  onUpdateClass?: (classIri: string, data: ClassUpdatePayload) => Promise<void>;
  /** Bumped to trigger detail panel re-fetch after an update */
  detailRefreshKey?: number;

  // Property & Individual editing
  sourceContent?: string;
  onUpdateProperty?: (propertyIri: string, data: TurtlePropertyUpdateData) => Promise<void>;
  onUpdateIndividual?: (individualIri: string, data: TurtleIndividualUpdateData) => Promise<void>;

  // Drag-and-drop reparenting
  onReparentClass?: (classIri: string, oldParentIris: string[], newParentIris: string[], mode: DragMode) => Promise<void>;
  reparentOptimistic?: (iri: string, oldParentIri: string | null, newParentIri: string | null) => { previousNodes: ClassTreeNode[] };
  rollbackReparent?: (snapshot: { previousNodes: ClassTreeNode[] }) => void;
}

export function StandardEditorLayout(props: StandardEditorLayoutProps) {
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
    onAddEntity,
    onDeleteClass,
    onCopyIri,
    selectedNodeFallback,
    onUpdateClass,
    detailRefreshKey,
    sourceContent,
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

    // Optimistic tree update
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
      // Capture handleUndo before clearing so the toast closure has a valid reference
      const undoFn = handleUndo;
      toast.addToast({
        type: "success",
        title: `Moved "${label}"`,
        duration: 5000,
        action: {
          label: "Undo",
          onClick: undoFn,
        },
      });
      clearUndo();
    }
  }, [undoAction, toast, handleUndo, clearUndo]);

  // Panel width state (default 320px = w-80)
  const [treePanelWidth, setTreePanelWidth] = useState(320);

  // Graph view state
  const [showGraph, setShowGraph] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);

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

  return (
    <div className="flex h-full min-w-0 flex-1">
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

      {/* Right Panel - Entity Details or Graph */}
      <div className="min-w-0 flex-1 bg-white dark:bg-slate-800">
        {showGraph ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
              <button
                onClick={() => setShowGraph(false)}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Back to details"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Details
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowGraphModal(true)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Expand graph to full screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Expand
              </button>
            </div>
            <div className="flex-1">
              <OntologyGraph
                focusIri={selectedIri}
                projectId={projectId}
                branch={activeBranch}
                onNavigateToClass={(iri) => {
                  setShowGraph(false);
                  navigateToNode(iri);
                }}
              />
            </div>
          </div>
        ) : activeTab === "classes" ? (
          <ClassDetailPanel
            projectId={projectId}
            classIri={selectedIri}
            accessToken={accessToken}
            branch={activeBranch}
            onNavigateToClass={(iri) => navigateToNode(iri)}
            onCopyIri={onCopyIri}
            selectedNodeFallback={selectedNodeFallback}
            canEdit={canEdit || isSuggestionMode}
            isSuggestionMode={isSuggestionMode}
            onUpdateClass={onUpdateClass}
            refreshKey={detailRefreshKey}
            headerActions={selectedIri ? (
              <button
                onClick={() => setShowGraph(true)}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Show relationship graph"
              >
                <Share2 className="h-3.5 w-3.5" />
                Graph
              </button>
            ) : undefined}
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

      {/* Full-screen graph modal */}
      {showGraphModal && selectedIri && (
        <EntityGraphModal
          focusIri={selectedIri}
          label={treeLabelHints.get(selectedIri) || getLocalName(selectedIri)}
          projectId={projectId}
          branch={activeBranch}
          onNavigateToClass={(iri) => {
            setShowGraphModal(false);
            setShowGraph(false);
            navigateToNode(iri);
          }}
          onClose={() => setShowGraphModal(false)}
        />
      )}
    </div>
  );
}
