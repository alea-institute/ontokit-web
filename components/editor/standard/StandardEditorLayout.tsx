"use client";

import { useState, useMemo } from "react";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { EntityTabBar, type EntityTab } from "@/components/editor/standard/EntityTabBar";
import { PropertyTree } from "@/components/editor/standard/PropertyTree";
import { IndividualList } from "@/components/editor/standard/IndividualList";
import { EntityPlaceholderDetail } from "@/components/editor/EntityPlaceholderDetail";
import { ResizablePanelDivider } from "@/components/editor/ResizablePanelDivider";
import { EntityTreeToolbar } from "@/components/editor/shared/EntityTreeToolbar";
import { useTreeSearch } from "@/lib/hooks/useTreeSearch";
import { useFilteredTree } from "@/lib/hooks/useFilteredTree";
import type { ClassUpdatePayload } from "@/lib/api/client";
import type { ClassTreeNode } from "@/lib/ontology/types";
import { useDraftStore } from "@/lib/stores/draftStore";

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
  expandAll: () => Promise<void>;
  collapseAll: () => void;
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
    expandAll,
    collapseAll,
    navigateToNode,
    onAddEntity,
    onDeleteClass,
    onCopyIri,
    selectedNodeFallback,
    onUpdateClass,
    detailRefreshKey,
  } = props;

  // Draft badges
  const getDraftIris = useDraftStore((s) => s.getDraftIris);
  const drafts = useDraftStore((s) => s.drafts);
  const draftIris = useMemo(
    () => new Set(getDraftIris(projectId, activeBranch || "main")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getDraftIris, projectId, activeBranch, drafts],
  );

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

  // Determine the effective selected IRI for the detail panel
  const effectiveSelectedIri =
    activeTab === "classes" ? selectedIri :
    activeTab === "properties" ? selectedPropertyIri :
    selectedIndividualIri;

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
          onExpandAll={activeTab === "classes" ? expandAll : undefined}
          onCollapseAll={activeTab === "classes" ? collapseAll : undefined}
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
                />
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

      {/* Right Panel - Entity Details */}
      <div className="min-w-0 flex-1 bg-white dark:bg-slate-800">
        {activeTab === "classes" ? (
          <ClassDetailPanel
            projectId={projectId}
            classIri={selectedIri}
            accessToken={accessToken}
            branch={activeBranch}
            onNavigateToClass={(iri) => navigateToNode(iri)}
            onCopyIri={onCopyIri}
            selectedNodeFallback={selectedNodeFallback}
            canEdit={canEdit}
            onUpdateClass={onUpdateClass}
            refreshKey={detailRefreshKey}
          />
        ) : (
          /* Placeholder detail panel for properties/individuals */
          <EntityPlaceholderDetail
            selectedIri={effectiveSelectedIri}
            entityType={activeTab === "properties" ? "Property" : "Individual"}
          />
        )}
      </div>
    </div>
  );
}
