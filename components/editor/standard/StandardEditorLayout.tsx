"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel, type TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { EntityTabBar, type EntityTab } from "@/components/editor/standard/EntityTabBar";
import { PropertyTree } from "@/components/editor/standard/PropertyTree";
import { IndividualList } from "@/components/editor/standard/IndividualList";
import { ResizablePanelDivider } from "@/components/editor/ResizablePanelDivider";
import { projectOntologyApi, type EntitySearchResult, type ClassUpdatePayload } from "@/lib/api/client";
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
    navigateToNode,
    onAddEntity,
    onDeleteClass,
    onCopyIri,
    selectedNodeFallback,
    onUpdateClass,
    detailRefreshKey,
  } = props;

  // Panel width state (default 320px = w-80)
  const [treePanelWidth, setTreePanelWidth] = useState(320);

  // Entity tab state
  const [activeTab, setActiveTab] = useState<EntityTab>("classes");

  // Track selected entity per tab (properties/individuals have their own selection)
  const [selectedPropertyIri, setSelectedPropertyIri] = useState<string | null>(null);
  const [selectedIndividualIri, setSelectedIndividualIri] = useState<string | null>(null);

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

  // Determine the effective selected IRI for the detail panel
  const effectiveSelectedIri =
    activeTab === "classes" ? selectedIri :
    activeTab === "properties" ? selectedPropertyIri :
    selectedIndividualIri;

  // Tab header label
  const tabHeaderLabel =
    activeTab === "classes" ? "Classes" :
    activeTab === "properties" ? "Properties" :
    "Individuals";

  return (
    <div className="flex h-full min-w-0 flex-1">
      {/* Left Panel - Entity Tree/List with tabs */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800" style={{ width: treePanelWidth }}>
        {/* Entity Type Tabs */}
        <EntityTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Header with search and add */}
        <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {showSearch ? "Search" : tabHeaderLabel}
            </h2>
            <div className="flex items-center gap-1">
              {canEdit && activeTab === "classes" && (
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

        {/* Tab Content */}
        <div className="h-[calc(100%-6.25rem)] overflow-y-auto">
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

/** Simple placeholder for property/individual detail (no structured editor yet) */
function EntityPlaceholderDetail({
  selectedIri,
  entityType,
}: {
  selectedIri: string | null;
  entityType: string;
}) {
  if (!selectedIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a {entityType.toLowerCase()} to view its details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border",
          entityType === "Property"
            ? "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700"
            : "bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700"
        )}>
          <span className={cn(
            "text-sm font-bold",
            entityType === "Property" ? "text-emerald-700 dark:text-emerald-400" : "text-purple-700 dark:text-purple-400"
          )}>
            {entityType[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {selectedIri.includes("#") ? selectedIri.split("#").pop() : selectedIri.split("/").pop()}
          </h2>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={selectedIri}>
            {selectedIri}
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {entityType} detail editing will be available in a future update.
        </p>
      </div>
    </div>
  );
}
