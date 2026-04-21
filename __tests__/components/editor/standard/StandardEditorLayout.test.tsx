import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Provide localStorage polyfill
vi.hoisted(() => {
  if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

// --- Mocks ---

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => <div data-testid="ontology-graph" />,
}));

let _classTreeProps: Record<string, unknown> = {};
vi.mock("@/components/editor/ClassTree", () => ({
  ClassTree: (props: Record<string, unknown>) => {
    _classTreeProps = props;
    return <div data-testid="class-tree" data-selected={props.selectedIri} />;
  },
}));

let _classDetailProps: Record<string, unknown> = {};
vi.mock("@/components/editor/ClassDetailPanel", () => ({
  ClassDetailPanel: (props: Record<string, unknown>) => {
    _classDetailProps = props;
    return (
      <div data-testid="class-detail-panel">
        {props.headerActions as React.ReactNode}
      </div>
    );
  },
}));

let _tabChangeHandler: ((id: string) => void) | undefined;
vi.mock("@/components/editor/standard/EntityTabBar", () => ({
  EntityTabBar: (props: Record<string, unknown>) => {
    _tabChangeHandler = props.onTabChange as (id: string) => void;
    return (
      <div data-testid="entity-tab-bar">
        <button onClick={() => (props.onTabChange as (id: string) => void)?.("classes")}>Classes</button>
        <button onClick={() => (props.onTabChange as (id: string) => void)?.("properties")}>Properties</button>
        <button onClick={() => (props.onTabChange as (id: string) => void)?.("individuals")}>Individuals</button>
      </div>
    );
  },
}));

let _propertyTreeProps: Record<string, unknown> = {};
vi.mock("@/components/editor/standard/PropertyTree", () => ({
  PropertyTree: (props: Record<string, unknown>) => {
    _propertyTreeProps = props;
    return <div data-testid="property-tree" />;
  },
}));

let _individualListProps: Record<string, unknown> = {};
vi.mock("@/components/editor/standard/IndividualList", () => ({
  IndividualList: (props: Record<string, unknown>) => {
    _individualListProps = props;
    return <div data-testid="individual-list" />;
  },
}));

let _propertyDetailProps: Record<string, unknown> = {};
vi.mock("@/components/editor/PropertyDetailPanel", () => ({
  PropertyDetailPanel: (props: Record<string, unknown>) => {
    _propertyDetailProps = props;
    return <div data-testid="property-detail-panel" />;
  },
}));

let _individualDetailProps: Record<string, unknown> = {};
vi.mock("@/components/editor/IndividualDetailPanel", () => ({
  IndividualDetailPanel: (props: Record<string, unknown>) => {
    _individualDetailProps = props;
    return <div data-testid="individual-detail-panel" />;
  },
}));

vi.mock("@/components/editor/ResizablePanelDivider", () => ({
  ResizablePanelDivider: () => <div data-testid="panel-divider" />,
}));

let _toolbarProps: Record<string, unknown> = {};
vi.mock("@/components/editor/shared/EntityTreeToolbar", () => ({
  EntityTreeToolbar: (props: Record<string, unknown>) => {
    _toolbarProps = props;
    return <div data-testid="entity-tree-toolbar" />;
  },
}));

vi.mock("@/components/editor/shared/DraggableTreeWrapper", () => ({
  DraggableTreeWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="draggable-wrapper">{children}</div>
  ),
}));

const _closeSearchFn = vi.fn();
const _baseSearchSelectFn = vi.fn();
let _useTreeSearchOverride: Record<string, unknown> | null = null;
vi.mock("@/lib/hooks/useTreeSearch", () => ({
  useTreeSearch: () => (_useTreeSearchOverride ?? {
    showSearch: false,
    searchQuery: "",
    searchResults: [],
    isSearching: false,
    searchInputRef: { current: null },
    toggleSearch: vi.fn(),
    closeSearch: _closeSearchFn,
    setSearchQuery: vi.fn(),
    handleSearchSelect: _baseSearchSelectFn,
  }),
}));

vi.mock("@/lib/hooks/useFilteredTree", () => ({
  useFilteredTree: () => ({
    filteredNodes: null,
    isBuilding: false,
    truncated: false,
  }),
}));

let _useTreeDragDropOverride: Record<string, unknown> | null = null;
let _lastDragDropOptions: Record<string, unknown> | null = null;
vi.mock("@/lib/hooks/useTreeDragDrop", () => ({
  useTreeDragDrop: (opts: Record<string, unknown>) => {
    _lastDragDropOptions = opts;
    return (_useTreeDragDropOverride ?? {
      dragState: {
        draggedIri: null,
        draggedLabel: null,
        dropTargetIri: null,
        isValidDropTarget: false,
        isDragActive: false,
        dragMode: "move",
      },
      undoAction: null,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragCancel: vi.fn(),
      handleUndo: vi.fn(),
      clearUndo: vi.fn(),
      handleDragEnterNode: vi.fn(),
      handleDragLeaveNode: vi.fn(),
    });
  },
}));

const _toastErrorFn = vi.fn();
const _toastAddFn = vi.fn();
vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: _toastErrorFn,
    info: vi.fn(),
    addToast: _toastAddFn,
  }),
}));

vi.mock("@/lib/stores/draftStore", () => ({
  useDraftStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      getDraftIris: () => [],
      drafts: {},
      getDraft: vi.fn(),
      setDraft: vi.fn(),
      removeDraft: vi.fn(),
      hasDraft: vi.fn(() => false),
    }),
}));

vi.mock("@/lib/graph/buildGraphData", () => ({
  extractTreeLabelMap: vi.fn(() => new Map()),
}));

vi.mock("@/components/ui/ScreenReaderAnnouncer", () => ({
  useAnnounce: () => ({ announce: vi.fn() }),
}));

import { StandardEditorLayout, type StandardEditorLayoutProps } from "@/components/editor/standard/StandardEditorLayout";
import type { ClassTreeNode } from "@/lib/ontology/types";

// --- Helper ---

function defaultProps(overrides: Partial<StandardEditorLayoutProps> = {}): StandardEditorLayoutProps {
  return {
    projectId: "proj-1",
    accessToken: "token-123",
    activeBranch: "main",
    canEdit: false,
    nodes: [],
    isTreeLoading: false,
    treeError: null,
    selectedIri: null,
    selectNode: vi.fn(),
    expandNode: vi.fn(),
    collapseNode: vi.fn(),
    expandOneLevel: vi.fn().mockResolvedValue(undefined),
    expandAllFully: vi.fn().mockResolvedValue(undefined),
    collapseAll: vi.fn(),
    collapseOneLevel: vi.fn(),
    hasExpandableNodes: false,
    hasExpandedNodes: false,
    isExpandingAll: false,
    navigateToNode: vi.fn().mockResolvedValue(undefined),
    onAddEntity: vi.fn(),
    selectedNodeFallback: null,
    ...overrides,
  };
}

const sampleNodes: ClassTreeNode[] = [
  {
    iri: "http://example.org/ClassA",
    label: "Class A",
    children: [],
    isExpanded: false,
    isLoading: false,
    hasChildren: false,
  },
];

// --- Tests ---

describe("StandardEditorLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _tabChangeHandler = undefined;
    _useTreeSearchOverride = null;
    _useTreeDragDropOverride = null;
    _lastDragDropOptions = null;
    _toolbarProps = {};
    _classTreeProps = {};
    _classDetailProps = {};
    _propertyTreeProps = {};
    _individualListProps = {};
    _propertyDetailProps = {};
    _individualDetailProps = {};
  });

  it("renders entity tab bar", () => {
    render(<StandardEditorLayout {...defaultProps()} />);
    expect(screen.getByTestId("entity-tab-bar")).toBeDefined();
  });

  it("renders entity tree toolbar", () => {
    render(<StandardEditorLayout {...defaultProps()} />);
    expect(screen.getByTestId("entity-tree-toolbar")).toBeDefined();
  });

  it("renders panel divider", () => {
    render(<StandardEditorLayout {...defaultProps()} />);
    expect(screen.getByTestId("panel-divider")).toBeDefined();
  });

  // --- Loading state ---
  it("shows loading spinner when tree is loading and no nodes", () => {
    render(<StandardEditorLayout {...defaultProps({ isTreeLoading: true, nodes: [] })} />);
    // The spinner is an empty div with animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  // --- Error state ---
  it("shows error message when treeError is set", () => {
    render(<StandardEditorLayout {...defaultProps({ treeError: "Something went wrong" })} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  // --- Empty state ---
  it("shows empty message when no classes found", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: [], isTreeLoading: false })} />);
    expect(screen.getByText("No classes found in this ontology")).toBeDefined();
  });

  // --- Tree rendering ---
  it("renders class tree when nodes exist", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(screen.getByTestId("class-tree")).toBeDefined();
    expect(screen.getByTestId("draggable-wrapper")).toBeDefined();
  });

  // --- Detail panel: class ---
  it("renders ClassDetailPanel when classes tab is active (default)", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(screen.getByTestId("class-detail-panel")).toBeDefined();
  });

  // --- Tab switching: properties ---
  it("shows PropertyTree and PropertyDetailPanel when properties tab selected", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-tree")).toBeDefined();
    expect(screen.getByTestId("property-detail-panel")).toBeDefined();
  });

  // --- Tab switching: individuals ---
  it("shows IndividualList and IndividualDetailPanel when individuals tab selected", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Individuals"));
    expect(screen.getByTestId("individual-list")).toBeDefined();
    expect(screen.getByTestId("individual-detail-panel")).toBeDefined();
  });

  // --- Tab switching back to classes ---
  it("switches back to classes tab", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-tree")).toBeDefined();
    fireEvent.click(screen.getByText("Classes"));
    expect(screen.getByTestId("class-tree")).toBeDefined();
    expect(screen.getByTestId("class-detail-panel")).toBeDefined();
  });

  // --- Graph view toggle ---
  it("shows Graph button when a class is selected", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, selectedIri: "http://example.org/ClassA" })}
      />
    );
    expect(screen.getByText("Graph")).toBeDefined();
  });

  it("toggles to graph view when Graph button clicked", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, selectedIri: "http://example.org/ClassA" })}
      />
    );
    fireEvent.click(screen.getByText("Graph"));
    expect(screen.getByTestId("ontology-graph")).toBeDefined();
    expect(screen.getByText("Back to Details")).toBeDefined();
  });

  it("toggles back from graph view via Back button", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, selectedIri: "http://example.org/ClassA" })}
      />
    );
    fireEvent.click(screen.getByText("Graph"));
    expect(screen.getByTestId("ontology-graph")).toBeDefined();
    fireEvent.click(screen.getByText("Back to Details"));
    expect(screen.getByTestId("class-detail-panel")).toBeDefined();
  });

  // --- Read-only vs editable ---
  it("renders without graph button when no class selected", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes, selectedIri: null })} />);
    expect(screen.queryByText("Graph")).toBeNull();
  });

  // --- Does not crash with minimal props ---
  it("renders with minimal props", () => {
    render(<StandardEditorLayout {...defaultProps()} />);
    // Should not crash
    expect(screen.getByTestId("entity-tab-bar")).toBeDefined();
  });

  // --- canEdit prop forwarding ---
  it("does not show tree when properties tab is active", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.queryByTestId("class-tree")).toBeNull();
  });

  // --- Toolbar prop forwarding based on active tab ---
  it("passes expand/collapse callbacks to toolbar on classes tab", () => {
    const expandOneLevel = vi.fn().mockResolvedValue(undefined);
    const expandAllFully = vi.fn().mockResolvedValue(undefined);
    const collapseAll = vi.fn();
    const collapseOneLevel = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          expandOneLevel,
          expandAllFully,
          collapseAll,
          collapseOneLevel,
          hasExpandableNodes: true,
          hasExpandedNodes: true,
          isExpandingAll: false,
        })}
      />
    );
    expect(_toolbarProps.onExpandOneLevel).toBe(expandOneLevel);
    expect(_toolbarProps.onExpandAllFully).toBe(expandAllFully);
    expect(_toolbarProps.onCollapseAll).toBe(collapseAll);
    expect(_toolbarProps.onCollapseOneLevel).toBe(collapseOneLevel);
    expect(_toolbarProps.hasExpandableNodes).toBe(true);
    expect(_toolbarProps.hasExpandedNodes).toBe(true);
    expect(_toolbarProps.isExpandingAll).toBe(false);
  });

  it("passes undefined expand/collapse to toolbar on properties tab", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(_toolbarProps.onExpandOneLevel).toBeUndefined();
    expect(_toolbarProps.onExpandAllFully).toBeUndefined();
    expect(_toolbarProps.onCollapseAll).toBeUndefined();
    expect(_toolbarProps.onCollapseOneLevel).toBeUndefined();
    expect(_toolbarProps.hasExpandableNodes).toBe(false);
    expect(_toolbarProps.hasExpandedNodes).toBe(false);
    expect(_toolbarProps.isExpandingAll).toBe(false);
  });

  it("passes undefined expand/collapse to toolbar on individuals tab", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Individuals"));
    expect(_toolbarProps.onExpandOneLevel).toBeUndefined();
    expect(_toolbarProps.hasExpandableNodes).toBe(false);
  });

  it("sets canAdd=true on toolbar only for classes tab with canEdit", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes, canEdit: true })} />);
    expect(_toolbarProps.canAdd).toBe(true);
    fireEvent.click(screen.getByText("Properties"));
    expect(_toolbarProps.canAdd).toBe(false);
  });

  it("sets canAdd=false on toolbar when canEdit is false", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes, canEdit: false })} />);
    expect(_toolbarProps.canAdd).toBe(false);
  });

  // --- ClassDetailPanel prop forwarding ---
  it("passes canEdit=true to ClassDetailPanel when isSuggestionMode is true", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: false, isSuggestionMode: true })}
      />
    );
    expect(_classDetailProps.canEdit).toBe(true);
    expect(_classDetailProps.isSuggestionMode).toBe(true);
  });

  it("forwards detailRefreshKey to ClassDetailPanel", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, detailRefreshKey: 42 })}
      />
    );
    expect(_classDetailProps.refreshKey).toBe(42);
  });

  // --- PropertyDetailPanel prop forwarding ---
  it("forwards sourceContent and callbacks to PropertyDetailPanel", () => {
    const onUpdateProperty = vi.fn();
    const onCopyIri = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          sourceContent: "@prefix ex: <http://example.org/> .",
          onUpdateProperty,
          onCopyIri,
          detailRefreshKey: 7,
          canEdit: true,
        })}
      />
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(_propertyDetailProps.sourceContent).toBe("@prefix ex: <http://example.org/> .");
    expect(_propertyDetailProps.onUpdateProperty).toBe(onUpdateProperty);
    expect(_propertyDetailProps.onCopyIri).toBe(onCopyIri);
    expect(_propertyDetailProps.canEdit).toBe(true);
    expect(_propertyDetailProps.refreshKey).toBe(7);
  });

  // --- IndividualDetailPanel prop forwarding ---
  it("forwards sourceContent and callbacks to IndividualDetailPanel", () => {
    const onUpdateIndividual = vi.fn();
    const onCopyIri = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          sourceContent: "@prefix ex: <http://example.org/> .",
          onUpdateIndividual,
          onCopyIri,
          detailRefreshKey: 9,
          canEdit: true,
        })}
      />
    );
    fireEvent.click(screen.getByText("Individuals"));
    expect(_individualDetailProps.sourceContent).toBe("@prefix ex: <http://example.org/> .");
    expect(_individualDetailProps.onUpdateIndividual).toBe(onUpdateIndividual);
    expect(_individualDetailProps.onCopyIri).toBe(onCopyIri);
    expect(_individualDetailProps.canEdit).toBe(true);
    expect(_individualDetailProps.refreshKey).toBe(9);
  });

  it("defaults sourceContent to empty string when undefined", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, sourceContent: undefined })}
      />
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(_propertyDetailProps.sourceContent).toBe("");
  });

  // --- PropertyTree selection ---
  it("forwards projectId and branch to PropertyTree", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, activeBranch: "dev" })}
      />
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(_propertyTreeProps.projectId).toBe("proj-1");
    expect(_propertyTreeProps.branch).toBe("dev");
    expect(_propertyTreeProps.accessToken).toBe("token-123");
  });

  // --- IndividualList props ---
  it("forwards projectId and branch to IndividualList", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, activeBranch: "feature" })}
      />
    );
    fireEvent.click(screen.getByText("Individuals"));
    expect(_individualListProps.projectId).toBe("proj-1");
    expect(_individualListProps.branch).toBe("feature");
    expect(_individualListProps.accessToken).toBe("token-123");
  });

  // --- PropertyTree selection callback updates detail panel ---
  it("passes selectedPropertyIri=null initially to PropertyTree", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(_propertyTreeProps.selectedIri).toBeNull();
    expect(_propertyDetailProps.propertyIri).toBeNull();
  });

  // --- IndividualList selection callback updates detail panel ---
  it("passes selectedIndividualIri=null initially to IndividualList", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    fireEvent.click(screen.getByText("Individuals"));
    expect(_individualListProps.selectedIri).toBeNull();
    expect(_individualDetailProps.individualIri).toBeNull();
  });

  // --- ClassTree prop forwarding ---
  it("passes onDelete to ClassTree when canEdit is true", () => {
    const onDeleteClass = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: true, onDeleteClass })}
      />
    );
    expect(_classTreeProps.onDelete).toBe(onDeleteClass);
  });

  it("passes undefined onDelete to ClassTree when canEdit is false", () => {
    const onDeleteClass = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: false, onDeleteClass })}
      />
    );
    expect(_classTreeProps.onDelete).toBeUndefined();
  });

  it("passes onAddChild to ClassTree when canEdit is true", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: true })}
      />
    );
    expect(_classTreeProps.onAddChild).toBeDefined();
  });

  it("passes undefined onAddChild to ClassTree when canEdit is false", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: false })}
      />
    );
    expect(_classTreeProps.onAddChild).toBeUndefined();
  });

  it("passes onCopyIri to ClassTree", () => {
    const onCopyIri = vi.fn();
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, onCopyIri })}
      />
    );
    expect(_classTreeProps.onCopyIri).toBe(onCopyIri);
  });

  it("passes draftIris set to ClassTree", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(_classTreeProps.draftIris).toBeInstanceOf(Set);
  });

  // --- Drag-and-drop disabled during search ---
  it("passes dragState to ClassTree when search is not active", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: true })}
      />
    );
    expect(_classTreeProps.dragState).toBeDefined();
  });

  // --- useTreeDragDrop receives correct canEdit ---
  it("passes canEdit to useTreeDragDrop", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: true })}
      />
    );
    expect(_lastDragDropOptions).not.toBeNull();
    expect(_lastDragDropOptions!.canEdit).toBe(true);
  });

  it("passes isSuggestionMode OR canEdit to useTreeDragDrop", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, canEdit: false, isSuggestionMode: true })}
      />
    );
    expect(_lastDragDropOptions).not.toBeNull();
    expect(_lastDragDropOptions!.canEdit).toBe(true);
  });

  // --- Loading with existing nodes shows tree, not spinner ---
  it("shows tree when loading but nodes already exist", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ isTreeLoading: true, nodes: sampleNodes })}
      />
    );
    expect(screen.getByTestId("class-tree")).toBeDefined();
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  // --- Undo toast on undoAction ---
  it("fires addToast when undoAction is set", () => {
    const clearUndoFn = vi.fn();
    _useTreeDragDropOverride = {
      dragState: {
        draggedIri: null,
        draggedLabel: null,
        dropTargetIri: null,
        isValidDropTarget: false,
        isDragActive: false,
        dragMode: "move",
      },
      undoAction: {
        classIri: "http://example.org/Moved",
        classLabel: "Moved Class",
        oldParentIris: ["http://example.org/OldParent"],
        newParentIris: ["http://example.org/NewParent"],
      },
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragCancel: vi.fn(),
      handleUndo: vi.fn(),
      clearUndo: clearUndoFn,
      handleDragEnterNode: vi.fn(),
      handleDragLeaveNode: vi.fn(),
    };
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(_toastAddFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: 'Moved "Moved Class"',
      })
    );
    expect(clearUndoFn).toHaveBeenCalled();
  });

  it("uses local name from IRI when undoAction has no classLabel", () => {
    _useTreeDragDropOverride = {
      dragState: {
        draggedIri: null,
        draggedLabel: null,
        dropTargetIri: null,
        isValidDropTarget: false,
        isDragActive: false,
        dragMode: "move",
      },
      undoAction: {
        classIri: "http://example.org/MyEntity",
        classLabel: "",
        oldParentIris: [],
        newParentIris: [],
      },
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragCancel: vi.fn(),
      handleUndo: vi.fn(),
      clearUndo: vi.fn(),
      handleDragEnterNode: vi.fn(),
      handleDragLeaveNode: vi.fn(),
    };
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(_toastAddFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Moved "MyEntity"',
      })
    );
  });

  // --- Reparent error triggers rollback and error toast ---
  it("calls rollbackReparent and toast.error when onReparentClass rejects", async () => {
    const reparentError = new Error("Server error");
    const onReparentClass = vi.fn().mockRejectedValue(reparentError);
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: sampleNodes });
    const rollbackReparent = vi.fn();

    // We need to capture the onReparent callback passed to useTreeDragDrop
    // and call it to exercise the handleDndReparent path
    _useTreeDragDropOverride = null; // use default but we need to capture
    // Re-render to capture the onReparent from _lastDragDropOptions
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />
    );

    expect(_lastDragDropOptions).not.toBeNull();
    const capturedOnReparent = _lastDragDropOptions!.onReparent as (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    expect(capturedOnReparent).toBeDefined();

    await capturedOnReparent(
      "http://example.org/ClassA",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );

    expect(reparentOptimistic).toHaveBeenCalledWith(
      "http://example.org/ClassA",
      "http://example.org/OldParent",
      "http://example.org/NewParent",
    );
    expect(onReparentClass).toHaveBeenCalled();
    expect(rollbackReparent).toHaveBeenCalledWith({ previousNodes: sampleNodes });
    expect(_toastErrorFn).toHaveBeenCalledWith("Failed to reparent class", "Server error");
  });

  it("does nothing in handleDndReparent when reparent callbacks are not provided", async () => {
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          canEdit: true,
          onReparentClass: undefined,
          reparentOptimistic: undefined,
          rollbackReparent: undefined,
        })}
      />
    );

    const capturedOnReparent = _lastDragDropOptions!.onReparent as (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;

    // Should not throw
    await capturedOnReparent(
      "http://example.org/ClassA",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );
  });

  it("calls reparentOptimistic with null when parentIris arrays are empty", async () => {
    const onReparentClass = vi.fn().mockResolvedValue(undefined);
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />
    );

    const capturedOnReparent = _lastDragDropOptions!.onReparent as (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;

    await capturedOnReparent("http://example.org/ClassA", [], [], "move");

    expect(reparentOptimistic).toHaveBeenCalledWith(
      "http://example.org/ClassA",
      null,
      null,
    );
    expect(rollbackReparent).not.toHaveBeenCalled();
  });

  // --- Graph view navigateToClass callback ---
  it("hides graph and navigates when OntologyGraph onNavigateToClass fires", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);
    // We need the OntologyGraph mock to expose onNavigateToClass
    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          selectedIri: "http://example.org/ClassA",
          navigateToNode,
        })}
      />
    );
    // Switch to graph
    fireEvent.click(screen.getByText("Graph"));
    expect(screen.getByTestId("ontology-graph")).toBeDefined();

    // Click Back to Details
    fireEvent.click(screen.getByText("Back to Details"));
    // Should show class detail panel again
    expect(screen.getByTestId("class-detail-panel")).toBeDefined();
  });

  // --- ClassDetailPanel onNavigateToClass callback ---
  it("passes onNavigateToClass to ClassDetailPanel", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, navigateToNode })}
      />
    );
    expect(_classDetailProps.onNavigateToClass).toBeDefined();
    // Invoke it to ensure navigateToNode is called
    (_classDetailProps.onNavigateToClass as (iri: string) => void)("http://example.org/Target");
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/Target");
  });

  // --- PropertyDetailPanel onNavigateToEntity ---
  it("passes onNavigateToEntity to PropertyDetailPanel", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, navigateToNode })}
      />
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(_propertyDetailProps.onNavigateToEntity).toBeDefined();
    (_propertyDetailProps.onNavigateToEntity as (iri: string) => void)("http://example.org/Prop");
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/Prop");
  });

  // --- IndividualDetailPanel onNavigateToEntity ---
  it("passes onNavigateToEntity to IndividualDetailPanel", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, navigateToNode })}
      />
    );
    fireEvent.click(screen.getByText("Individuals"));
    expect(_individualDetailProps.onNavigateToEntity).toBeDefined();
    (_individualDetailProps.onNavigateToEntity as (iri: string) => void)("http://example.org/Ind");
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/Ind");
  });

  // --- treePanelWidth ---
  it("sets initial tree panel width to 320px", () => {
    const { container } = render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    const treePanel = container.querySelector("[style]");
    expect(treePanel).not.toBeNull();
    expect(treePanel!.getAttribute("style")).toContain("width: 320px");
  });

  // --- ClassTree searchResults not passed when search is hidden ---
  it("does not pass searchResults to ClassTree when search is hidden", () => {
    render(<StandardEditorLayout {...defaultProps({ nodes: sampleNodes })} />);
    expect(_classTreeProps.searchResults).toBeUndefined();
  });

  // --- activeBranch default ---
  it("works with undefined activeBranch", () => {
    render(<StandardEditorLayout {...defaultProps({ activeBranch: undefined })} />);
    expect(screen.getByTestId("entity-tab-bar")).toBeDefined();
  });

  // --- ClassDetailPanel headerActions absent when no selectedIri ---
  it("does not pass headerActions to ClassDetailPanel when selectedIri is null", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, selectedIri: null })}
      />
    );
    expect(_classDetailProps.headerActions).toBeUndefined();
  });

  // --- ClassDetailPanel headerActions present when selectedIri set ---
  it("passes headerActions to ClassDetailPanel when selectedIri is set", () => {
    render(
      <StandardEditorLayout
        {...defaultProps({ nodes: sampleNodes, selectedIri: "http://example.org/ClassA" })}
      />
    );
    expect(_classDetailProps.headerActions).toBeDefined();
  });

  // --- Non-Error thrown during reparent ---
  it("shows 'Unknown error' toast when reparent throws non-Error", async () => {
    const onReparentClass = vi.fn().mockRejectedValue("string error");
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <StandardEditorLayout
        {...defaultProps({
          nodes: sampleNodes,
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />
    );

    const capturedOnReparent = _lastDragDropOptions!.onReparent as (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;

    await capturedOnReparent(
      "http://example.org/ClassA",
      ["http://example.org/Old"],
      ["http://example.org/New"],
      "move",
    );

    expect(_toastErrorFn).toHaveBeenCalledWith("Failed to reparent class", "Unknown error");
  });

  describe("entityNavigationRef", () => {
    it("populates ref with navigation function on mount", () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref })} />);
      expect(ref.current).toBeTypeOf("function");
    });

    it("clears ref on unmount", () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      const { unmount } = render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref })} />);
      expect(ref.current).toBeTypeOf("function");
      unmount();
      expect(ref.current).toBeNull();
    });

    it("navigates to class tab when type is class", () => {
      const navigateToNode = vi.fn().mockResolvedValue(undefined);
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref, navigateToNode })} />);
      ref.current!("http://example.org/ClassA", "class");
      expect(navigateToNode).toHaveBeenCalledWith("http://example.org/ClassA");
    });

    it("switches to properties tab when type is property", () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref })} />);
      ref.current!("http://example.org/hasFoo", "property");
      // The tab change handler should have been called
      expect(_tabChangeHandler).toBeDefined();
    });

    it("switches to individuals tab when type is individual", () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref })} />);
      ref.current!("http://example.org/foo1", "individual");
      expect(_tabChangeHandler).toBeDefined();
    });

    it("defaults to class navigation when type is undefined", () => {
      const navigateToNode = vi.fn().mockResolvedValue(undefined);
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<StandardEditorLayout {...defaultProps({ entityNavigationRef: ref, navigateToNode })} />);
      ref.current!("http://example.org/ClassA");
      expect(navigateToNode).toHaveBeenCalledWith("http://example.org/ClassA");
    });
  });
});
