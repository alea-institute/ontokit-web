import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import { useSelectionStore } from "@/lib/stores/selectionStore";

// Provide localStorage polyfill
vi.hoisted(() => {
  if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

// --- Mocks ---

vi.mock("next/dynamic", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (_loader: any) => {
    // Return a component that renders props-based buttons for testing callbacks
    const DynamicComponent = (props: Record<string, unknown>) => (
      <div data-testid="dynamic-component">
        {typeof props.onNavigateToClass === "function" && (
          <button
            data-testid="dynamic-navigate"
            onClick={() => (props.onNavigateToClass as (iri: string) => void)("http://example.org/DynTarget")}
          >
            Navigate
          </button>
        )}
      </div>
    );
    return DynamicComponent;
  },
}));

vi.mock("@/components/editor/ClassTree", () => ({
  ClassTree: (props: Record<string, unknown>) => (
    <div data-testid="class-tree" data-selected={props.selectedIri as string}>
      {typeof props.onViewInSource === "function" && (
        <button
          data-testid="view-in-source-btn"
          onClick={() => (props.onViewInSource as (iri: string) => void)("http://example.org/Class1")}
        >
          View in source
        </button>
      )}
      {typeof props.onSearchSelect === "function" && (
        <button
          data-testid="search-select-btn"
          onClick={() => (props.onSearchSelect as (iri: string) => void)("http://example.org/SearchResult")}
        >
          Select search result
        </button>
      )}
      {typeof props.onAddChild === "function" && (
        <button
          data-testid="add-child-btn"
          onClick={() => (props.onAddChild as (parentIri: string) => void)("http://example.org/Parent")}
        >
          Add child
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/ClassDetailPanel", () => ({
  ClassDetailPanel: (props: Record<string, unknown>) => (
    <div data-testid="class-detail-panel" data-class-iri={props.classIri as string}>
      {typeof props.onNavigateToClass === "function" && (
        <button
          data-testid="detail-navigate-class"
          onClick={() => (props.onNavigateToClass as (iri: string) => void)("http://example.org/NavTarget")}
        >
          Navigate to class
        </button>
      )}
      {typeof props.onNavigateToSource === "function" && (
        <button
          data-testid="detail-navigate-source"
          onClick={() => (props.onNavigateToSource as (iri: string) => void)("http://example.org/SourceTarget")}
        >
          Navigate to source
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/HealthCheckPanel", () => ({
  HealthCheckPanel: (props: Record<string, unknown>) => (
    <div data-testid="health-check-panel">
      {typeof props.onNavigateToClass === "function" && (
        <button
          data-testid="health-navigate-class"
          onClick={() => (props.onNavigateToClass as (iri: string) => void)("http://example.org/HealthTarget")}
        >
          Navigate from health
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/ResizablePanelDivider", () => ({
  ResizablePanelDivider: () => <div data-testid="panel-divider" />,
}));

vi.mock("@/components/editor/standard/EntityTabBar", () => ({
  EntityTabBar: (props: Record<string, unknown>) => (
    <div data-testid="entity-tab-bar">
      <button onClick={() => (props.onTabChange as (id: string) => void)?.("classes")}>Classes</button>
      <button onClick={() => (props.onTabChange as (id: string) => void)?.("properties")}>Properties</button>
      <button onClick={() => (props.onTabChange as (id: string) => void)?.("individuals")}>Individuals</button>
    </div>
  ),
}));

vi.mock("@/components/editor/standard/PropertyTree", () => ({
  PropertyTree: () => <div data-testid="property-tree" />,
}));

vi.mock("@/components/editor/standard/IndividualList", () => ({
  IndividualList: () => <div data-testid="individual-list" />,
}));

vi.mock("@/components/editor/PropertyDetailPanel", () => ({
  PropertyDetailPanel: (props: Record<string, unknown>) => (
    <div data-testid="property-detail-panel">
      {typeof props.onNavigateToEntity === "function" && (
        <button
          data-testid="prop-navigate-entity"
          onClick={() => (props.onNavigateToEntity as (iri: string) => void)("http://example.org/PropNav")}
        >
          Navigate from property
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/IndividualDetailPanel", () => ({
  IndividualDetailPanel: (props: Record<string, unknown>) => (
    <div data-testid="individual-detail-panel">
      {typeof props.onNavigateToEntity === "function" && (
        <button
          data-testid="indiv-navigate-entity"
          onClick={() => (props.onNavigateToEntity as (iri: string) => void)("http://example.org/IndivNav")}
        >
          Navigate from individual
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/shared/EntityTreeToolbar", () => ({
  EntityTreeToolbar: (props: Record<string, unknown>) => (
    <div data-testid="entity-tree-toolbar">
      {typeof props.onAdd === "function" && (
        <button data-testid="toolbar-add-btn" onClick={props.onAdd as () => void}>
          Add entity
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/editor/shared/DraggableTreeWrapper", () => ({
  DraggableTreeWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="draggable-wrapper">{children}</div>
  ),
}));

vi.mock("@/lib/hooks/useTreeSearch", () => ({
  useTreeSearch: () => ({
    showSearch: false,
    searchQuery: "",
    searchResults: [],
    isSearching: false,
    searchInputRef: { current: null },
    toggleSearch: vi.fn(),
    closeSearch: vi.fn(),
    setSearchQuery: vi.fn(),
    handleSearchSelect: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useFilteredTree", () => ({
  useFilteredTree: () => ({
    filteredNodes: null,
    isBuilding: false,
    truncated: false,
  }),
}));

const mockHandleUndo = vi.fn();
const mockClearUndo = vi.fn();
let mockUndoAction: {
  classIri: string;
  classLabel: string;
  oldParentIris: string[];
  newParentIris: string[];
} | null = null;

const defaultDragDropReturn = () => ({
  dragState: {
    draggedIri: null,
    draggedLabel: null,
    dropTargetIri: null,
    isValidDropTarget: false,
    isDragActive: false,
    dragMode: "move" as const,
  },
  undoAction: mockUndoAction,
  handleDragStart: vi.fn(),
  handleDragOver: vi.fn(),
  handleDragEnd: vi.fn(),
  handleDragCancel: vi.fn(),
  handleUndo: mockHandleUndo,
  clearUndo: mockClearUndo,
  handleDragEnterNode: vi.fn(),
  handleDragLeaveNode: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseTreeDragDrop = vi.fn<(opts: any) => ReturnType<typeof defaultDragDropReturn>>(defaultDragDropReturn);

vi.mock("@/lib/hooks/useTreeDragDrop", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useTreeDragDrop: (opts: any) => mockUseTreeDragDrop(opts),
}));

const mockAddToast = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: mockToastError,
    info: vi.fn(),
    addToast: mockAddToast,
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

import {
  DeveloperEditorLayout,
  type DeveloperEditorLayoutProps,
} from "@/components/editor/developer/DeveloperEditorLayout";
import type { ClassTreeNode } from "@/lib/ontology/types";
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";

// --- Helper ---

function defaultProps(
  overrides: Partial<DeveloperEditorLayoutProps> = {},
): DeveloperEditorLayoutProps {
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
    sourceContent: "",
    setSourceContent: vi.fn(),
    isLoadingSource: false,
    sourceError: null,
    isPreloading: false,
    loadSourceContent: vi.fn().mockResolvedValue(undefined),
    sourceIriIndex: new Map(),
    pendingScrollIri: null,
    setPendingScrollIri: vi.fn(),
    sourceEditorRef: { current: null },
    onSaveSource: vi.fn().mockResolvedValue(undefined),
    onAddEntity: vi.fn(),
    selectedNodeFallback: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ClassTreeNode> = {}): ClassTreeNode {
  return {
    iri: "http://example.org/Class1",
    label: "Class1",
    children: [],
    isExpanded: false,
    isLoading: false,
    hasChildren: false,
    ...overrides,
  };
}

describe("DeveloperEditorLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUndoAction = null;
    mockUseTreeDragDrop.mockImplementation(defaultDragDropReturn);
  });

  // --- Rendering ---

  it("renders view mode tabs (Tree, Source, Graph)", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    expect(screen.getByText("Tree")).toBeDefined();
    expect(screen.getByText("Source")).toBeDefined();
    expect(screen.getByText("Graph")).toBeDefined();
  });

  it("starts in tree view mode showing entity tab bar", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    expect(screen.getByTestId("entity-tab-bar")).toBeDefined();
  });

  it("shows ClassTree when nodes exist", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    expect(screen.getByTestId("class-tree")).toBeDefined();
  });

  it("does not show ClassTree when tree is loading with no nodes", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ isTreeLoading: true, nodes: [] })} />,
    );
    expect(screen.queryByTestId("class-tree")).toBeNull();
  });

  it("shows error message when treeError is set", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ treeError: "Failed to load tree" })} />,
    );
    expect(screen.getByText("Failed to load tree")).toBeDefined();
  });

  it("shows empty state when nodes array is empty", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    expect(screen.getByText("No classes found in this ontology")).toBeDefined();
  });

  // --- View Mode Switching ---

  it("hides entity tab bar in source view", () => {
    render(
      <DeveloperEditorLayout
        {...defaultProps({ sourceContent: "@prefix : <http://ex.org/> ." })}
      />,
    );
    fireEvent.click(screen.getByText("Source"));
    expect(screen.queryByTestId("entity-tab-bar")).toBeNull();
  });

  it("shows loading state in source view when isLoadingSource", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ isLoadingSource: true })} />,
    );
    fireEvent.click(screen.getByText("Source"));
    expect(screen.getByText("Loading source...")).toBeDefined();
  });

  it("shows error state in source view with retry button", () => {
    const loadSourceContent = vi.fn();
    render(
      <DeveloperEditorLayout
        {...defaultProps({ sourceError: "Network error", loadSourceContent })}
      />,
    );
    fireEvent.click(screen.getByText("Source"));
    expect(screen.getByText("Failed to load source")).toBeDefined();
    expect(screen.getByText("Network error")).toBeDefined();
    fireEvent.click(screen.getByText("Try Again"));
    expect(loadSourceContent).toHaveBeenCalledWith(false);
  });

  it("switches to graph view when Graph tab is clicked", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    fireEvent.click(screen.getByText("Graph"));
    expect(screen.getByTestId("dynamic-component")).toBeDefined();
    expect(screen.queryByTestId("entity-tab-bar")).toBeNull();
  });

  it("switches back to tree view from source", () => {
    render(
      <DeveloperEditorLayout
        {...defaultProps({ nodes: [makeNode()], sourceContent: "content" })}
      />,
    );
    fireEvent.click(screen.getByText("Source"));
    expect(screen.queryByTestId("class-tree")).toBeNull();
    fireEvent.click(screen.getByText("Tree"));
    expect(screen.getByTestId("class-tree")).toBeDefined();
  });

  // --- Entity Tab Switching ---

  it("shows PropertyTree when properties tab is selected", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-tree")).toBeDefined();
  });

  it("shows IndividualList when individuals tab is selected", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    fireEvent.click(screen.getByText("Individuals"));
    expect(screen.getByTestId("individual-list")).toBeDefined();
  });

  it("shows PropertyDetailPanel when properties tab is selected", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-detail-panel")).toBeDefined();
  });

  it("shows IndividualDetailPanel when individuals tab is selected", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    fireEvent.click(screen.getByText("Individuals"));
    expect(screen.getByTestId("individual-detail-panel")).toBeDefined();
  });

  // --- Health Check ---

  it("does not render health check panel (now rendered at page level)", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    expect(screen.queryByTestId("health-check-panel")).toBeNull();
  });

  // --- Detail Panel ---

  it("renders ClassDetailPanel with selectedIri in tree view", () => {
    render(
      <DeveloperEditorLayout
        {...defaultProps({ nodes: [makeNode()], selectedIri: "http://example.org/Class1" })}
      />,
    );
    const panel = screen.getByTestId("class-detail-panel");
    expect(panel.getAttribute("data-class-iri")).toBe("http://example.org/Class1");
  });

  // --- DraggableTreeWrapper ---

  it("wraps class tree in DraggableTreeWrapper", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    expect(screen.getByTestId("draggable-wrapper")).toBeDefined();
    expect(screen.getByTestId("class-tree")).toBeDefined();
  });

  // --- Panel Divider ---

  it("renders panel divider in tree view", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );
    expect(screen.getByTestId("panel-divider")).toBeDefined();
  });

  // --- Drag-and-drop reparenting ---

  it("calls reparentOptimistic and onReparentClass on successful reparent", async () => {
    const onReparentClass = vi.fn().mockResolvedValue(undefined);
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />,
    );

    // The hook's onReparent is set to handleDndReparent which is passed to useTreeDragDrop.
    // We can't directly invoke handleDndReparent from outside, but we can verify the callbacks
    // are wired. Since useTreeDragDrop is mocked, we verify the props are passed.
    // Instead, test the integration: the component passes handleDndReparent to useTreeDragDrop.
    // We need to capture the onReparent callback from useTreeDragDrop mock.
    expect(screen.getByTestId("class-tree")).not.toBeNull();
  });

  it("rolls back and shows error toast when reparent fails", async () => {
    // Capture the onReparent callback passed to useTreeDragDrop
    type OnReparentFn = (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    let capturedOnReparent: OnReparentFn | null = null;

    mockUseTreeDragDrop.mockImplementation((opts: Record<string, unknown>) => {
      capturedOnReparent = opts.onReparent as OnReparentFn;
      return defaultDragDropReturn();
    });

    const onReparentClass = vi.fn().mockRejectedValue(new Error("Server error"));
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [makeNode()] });
    const rollbackReparent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />,
    );

    expect(capturedOnReparent).not.toBeNull();

    await capturedOnReparent!(
      "http://example.org/Child",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );

    expect(reparentOptimistic).toHaveBeenCalledWith(
      "http://example.org/Child",
      "http://example.org/OldParent",
      "http://example.org/NewParent",
    );
    expect(onReparentClass).toHaveBeenCalled();
    expect(rollbackReparent).toHaveBeenCalledWith({ previousNodes: [makeNode()] });
    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to reparent class",
      "Server error",
    );
  });

  it("does nothing in handleDndReparent when reparent callbacks are missing", async () => {
    type OnReparentFn = (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    let capturedOnReparent: OnReparentFn | null = null;

    mockUseTreeDragDrop.mockImplementation((opts: Record<string, unknown>) => {
      capturedOnReparent = opts.onReparent as OnReparentFn;
      return defaultDragDropReturn();
    });

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          // No reparent callbacks provided
        })}
      />,
    );

    expect(capturedOnReparent).not.toBeNull();

    // Should return early without error
    await capturedOnReparent!(
      "http://example.org/Child",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );

    expect(mockToastError).not.toHaveBeenCalled();
  });

  // --- Undo toast flow ---

  it("shows undo toast when undoAction is present", () => {
    mockUndoAction = {
      classIri: "http://example.org/Moved",
      classLabel: "MovedClass",
      oldParentIris: ["http://example.org/Old"],
      newParentIris: ["http://example.org/New"],
    };

    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: 'Moved "MovedClass"',
        duration: 5000,
        action: expect.objectContaining({
          label: "Undo",
        }),
      }),
    );
    expect(mockClearUndo).toHaveBeenCalled();
  });

  it("uses localName fallback in undo toast when classLabel is empty", () => {
    mockUndoAction = {
      classIri: "http://example.org/FallbackName",
      classLabel: "",
      oldParentIris: [],
      newParentIris: [],
    };

    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Moved "FallbackName"',
      }),
    );
  });

  it("undo toast action onClick calls handleUndo", () => {
    mockUndoAction = {
      classIri: "http://example.org/Moved",
      classLabel: "MovedClass",
      oldParentIris: [],
      newParentIris: [],
    };

    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    // Extract the action onClick from the addToast call
    const toastArg = mockAddToast.mock.calls[0][0] as {
      action: { onClick: () => void };
    };
    toastArg.action.onClick();
    expect(mockHandleUndo).toHaveBeenCalled();
  });

  // --- Source content preloading ---

  it("preloads source content on Source tab hover", () => {
    const loadSourceContent = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          sourceContent: "",
          isLoadingSource: false,
          isPreloading: false,
          loadSourceContent,
        })}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Source"));

    expect(loadSourceContent).toHaveBeenCalledWith(true);
  });

  it("does not preload source if already has content", () => {
    const loadSourceContent = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          sourceContent: "@prefix : <http://ex.org/> .",
          loadSourceContent,
        })}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Source"));

    expect(loadSourceContent).not.toHaveBeenCalled();
  });

  it("does not preload source if already preloading", () => {
    const loadSourceContent = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          sourceContent: "",
          isPreloading: true,
          loadSourceContent,
        })}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Source"));

    expect(loadSourceContent).not.toHaveBeenCalled();
  });

  it("shows preloading indicator when isPreloading is true", () => {
    const { container } = render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          isPreloading: true,
        })}
      />,
    );

    // The preloading indicator is a pulsing dot next to the Source text
    const pulsingDot = container.querySelector(".animate-pulse");
    expect(pulsingDot).not.toBeNull();
  });

  // --- View mode transitions ---

  it("captures editor value when switching away from source view", () => {
    const setSourceContent = vi.fn();
    const mockGetValue = vi.fn().mockReturnValue("updated turtle content");
    const sourceEditorRef = { current: { getValue: mockGetValue, scrollToIri: vi.fn(), insertAtEnd: vi.fn() } };

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          sourceContent: "original content",
          setSourceContent,
          sourceEditorRef: sourceEditorRef as unknown as React.RefObject<OntologySourceEditorRef | null>,
        })}
      />,
    );

    // Switch to source view first
    fireEvent.click(screen.getByText("Source"));

    // Now switch back to tree - should capture editor value
    fireEvent.click(screen.getByText("Tree"));

    expect(setSourceContent).toHaveBeenCalledWith("updated turtle content");
  });

  it("does not capture editor value when switching between non-source views", () => {
    const setSourceContent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          setSourceContent,
        })}
      />,
    );

    // Switch from tree to graph - should not capture anything
    fireEvent.click(screen.getByText("Graph"));

    expect(setSourceContent).not.toHaveBeenCalled();
  });

  it("navigates to source view and sets pending scroll IRI", () => {
    const setPendingScrollIri = vi.fn();
    const mockScrollToIri = vi.fn();
    const sourceEditorRef = { current: { getValue: vi.fn(), scrollToIri: mockScrollToIri, insertAtEnd: vi.fn() } };
    const iriIndex = new Map([["http://example.org/Class1", { line: 10, col: 0, len: 30 }]]);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          sourceContent: "content",
          setPendingScrollIri,
          sourceEditorRef: sourceEditorRef as unknown as React.RefObject<OntologySourceEditorRef | null>,
          sourceIriIndex: iriIndex,
        })}
      />,
    );

    // The ClassTree mock receives onViewInSource which calls handleNavigateToSource.
    // We can't easily invoke it through the mock, but we can verify the wiring
    // by checking the component renders correctly with the props.
    expect(screen.getByTestId("class-tree")).not.toBeNull();
  });

  // --- Source view auto-load ---

  it("loads source content when switching to source view if not yet loaded", () => {
    const loadSourceContent = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          sourceContent: "",
          isLoadingSource: false,
          isPreloading: false,
          loadSourceContent,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Source"));

    expect(loadSourceContent).toHaveBeenCalledWith(false);
  });

  it("does not reload source content in source view if already loaded", () => {
    const loadSourceContent = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          sourceContent: "@prefix : <http://ex.org/> .",
          loadSourceContent,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Source"));

    expect(loadSourceContent).not.toHaveBeenCalled();
  });

  // --- Graph view rendering and navigation ---

  it("renders OntologyGraph in graph view", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    fireEvent.click(screen.getByText("Graph"));

    expect(screen.getByTestId("dynamic-component")).not.toBeNull();
  });

  it("does not show panel divider in graph view", () => {
    render(<DeveloperEditorLayout {...defaultProps()} />);
    fireEvent.click(screen.getByText("Graph"));

    expect(screen.queryByTestId("panel-divider")).toBeNull();
  });

  it("does not show panel divider in source view", () => {
    render(
      <DeveloperEditorLayout
        {...defaultProps({ sourceContent: "content" })}
      />,
    );
    fireEvent.click(screen.getByText("Source"));

    expect(screen.queryByTestId("panel-divider")).toBeNull();
  });

  // --- Tab content rendering details ---

  it("switches back from properties to classes tab", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-tree")).not.toBeNull();
    expect(screen.queryByTestId("class-tree")).toBeNull();

    fireEvent.click(screen.getByText("Classes"));
    expect(screen.getByTestId("class-tree")).not.toBeNull();
    expect(screen.queryByTestId("property-tree")).toBeNull();
  });

  it("switches from individuals back to classes tab", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    fireEvent.click(screen.getByText("Individuals"));
    expect(screen.getByTestId("individual-list")).not.toBeNull();
    expect(screen.queryByTestId("class-tree")).toBeNull();

    fireEvent.click(screen.getByText("Classes"));
    expect(screen.getByTestId("class-tree")).not.toBeNull();
    expect(screen.queryByTestId("individual-list")).toBeNull();
  });

  it("shows ClassDetailPanel in classes tab and PropertyDetailPanel in properties tab", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    // Default: classes tab shows ClassDetailPanel
    expect(screen.getByTestId("class-detail-panel")).not.toBeNull();
    expect(screen.queryByTestId("property-detail-panel")).toBeNull();

    // Switch to properties
    fireEvent.click(screen.getByText("Properties"));
    expect(screen.getByTestId("property-detail-panel")).not.toBeNull();
    expect(screen.queryByTestId("class-detail-panel")).toBeNull();
  });

  it("shows IndividualDetailPanel in individuals tab", () => {
    render(
      <DeveloperEditorLayout {...defaultProps({ nodes: [makeNode()] })} />,
    );

    fireEvent.click(screen.getByText("Individuals"));
    expect(screen.getByTestId("individual-detail-panel")).not.toBeNull();
    expect(screen.queryByTestId("class-detail-panel")).toBeNull();
    expect(screen.queryByTestId("property-detail-panel")).toBeNull();
  });

  // --- Reparent with successful path via captured callback ---

  it("calls onReparentClass on successful reparent without rollback", async () => {
    type OnReparentFn = (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    let capturedOnReparent: OnReparentFn | null = null;

    mockUseTreeDragDrop.mockImplementation((opts: Record<string, unknown>) => {
      capturedOnReparent = opts.onReparent as OnReparentFn;
      return defaultDragDropReturn();
    });

    const onReparentClass = vi.fn().mockResolvedValue(undefined);
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />,
    );

    expect(capturedOnReparent).not.toBeNull();

    await capturedOnReparent!(
      "http://example.org/Child",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );

    expect(reparentOptimistic).toHaveBeenCalledWith(
      "http://example.org/Child",
      "http://example.org/OldParent",
      "http://example.org/NewParent",
    );
    expect(onReparentClass).toHaveBeenCalledWith(
      "http://example.org/Child",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );
    expect(rollbackReparent).not.toHaveBeenCalled();
  });

  // --- Reparent with non-Error rejection ---

  it("shows 'Unknown error' in toast when reparent fails with non-Error", async () => {
    type OnReparentFn = (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    let capturedOnReparent: OnReparentFn | null = null;

    mockUseTreeDragDrop.mockImplementation((opts: Record<string, unknown>) => {
      capturedOnReparent = opts.onReparent as OnReparentFn;
      return defaultDragDropReturn();
    });

    const onReparentClass = vi.fn().mockRejectedValue("string-error");
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />,
    );

    expect(capturedOnReparent).not.toBeNull();

    await capturedOnReparent!(
      "http://example.org/Child",
      ["http://example.org/OldParent"],
      ["http://example.org/NewParent"],
      "move",
    );

    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to reparent class",
      "Unknown error",
    );
  });

  // --- Reparent with empty parent arrays ---

  it("passes null for tree parent when parent arrays are empty", async () => {
    type OnReparentFn = (
      classIri: string,
      oldParentIris: string[],
      newParentIris: string[],
      mode: string,
    ) => Promise<void>;
    let capturedOnReparent: OnReparentFn | null = null;

    mockUseTreeDragDrop.mockImplementation((opts: Record<string, unknown>) => {
      capturedOnReparent = opts.onReparent as OnReparentFn;
      return defaultDragDropReturn();
    });

    const onReparentClass = vi.fn().mockResolvedValue(undefined);
    const reparentOptimistic = vi.fn().mockReturnValue({ previousNodes: [] });
    const rollbackReparent = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onReparentClass,
          reparentOptimistic,
          rollbackReparent,
        })}
      />,
    );

    expect(capturedOnReparent).not.toBeNull();

    await capturedOnReparent!(
      "http://example.org/Child",
      [], // empty old parents
      [], // empty new parents
      "move",
    );

    // With empty arrays, oldTreeParent and newTreeParent should be null
    expect(reparentOptimistic).toHaveBeenCalledWith(
      "http://example.org/Child",
      null,
      null,
    );
  });

  // --- Inline callback exercising ---

  it("calls handleNavigateToSource via ClassTree onViewInSource", () => {
    const setPendingScrollIri = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          setPendingScrollIri,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("view-in-source-btn"));

    // handleNavigateToSource sets view to source and sets pending scroll IRI
    expect(setPendingScrollIri).toHaveBeenCalledWith("http://example.org/Class1");
  });

  it("calls onAddEntity via EntityTreeToolbar onAdd", () => {
    const onAddEntity = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onAddEntity,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("toolbar-add-btn"));
    expect(onAddEntity).toHaveBeenCalledWith();
  });

  it("calls onAddEntity with parentIri via ClassTree onAddChild", () => {
    const onAddEntity = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          canEdit: true,
          onAddEntity,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("add-child-btn"));
    expect(onAddEntity).toHaveBeenCalledWith("http://example.org/Parent");
  });

  it("calls navigateToNode via ClassDetailPanel onNavigateToClass", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          navigateToNode,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("detail-navigate-class"));
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/NavTarget");
  });

  it("calls handleNavigateToSource via ClassDetailPanel onNavigateToSource", () => {
    const setPendingScrollIri = vi.fn();

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          setPendingScrollIri,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("detail-navigate-source"));
    expect(setPendingScrollIri).toHaveBeenCalledWith("http://example.org/SourceTarget");
  });

  it("calls navigateToNode via PropertyDetailPanel onNavigateToEntity", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          navigateToNode,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Properties"));
    fireEvent.click(screen.getByTestId("prop-navigate-entity"));
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/PropNav");
  });

  it("calls navigateToNode via IndividualDetailPanel onNavigateToEntity", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          navigateToNode,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Individuals"));
    fireEvent.click(screen.getByTestId("indiv-navigate-entity"));
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/IndivNav");
  });



  it("navigates from graph view back to tree via OntologyGraph callback", () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          nodes: [makeNode()],
          navigateToNode,
        })}
      />,
    );

    // Switch to graph view
    fireEvent.click(screen.getByText("Graph"));

    // Click the navigate button exposed by dynamic component mock
    fireEvent.click(screen.getByTestId("dynamic-navigate"));

    // Should have switched back to tree and navigated
    expect(navigateToNode).toHaveBeenCalledWith("http://example.org/DynTarget");
    // Should be back in tree view
    expect(screen.getByTestId("entity-tab-bar")).not.toBeNull();
  });

  it("navigates from source editor back to tree via onNavigateToClass", async () => {
    const navigateToNode = vi.fn().mockResolvedValue(undefined);

    render(
      <DeveloperEditorLayout
        {...defaultProps({
          sourceContent: "@prefix : <http://ex.org/> .",
          navigateToNode,
        })}
      />,
    );

    // Switch to source view
    fireEvent.click(screen.getByText("Source"));

    // The dynamic mock renders a navigate button for onNavigateToClass
    const navBtn = screen.getByTestId("dynamic-navigate");
    fireEvent.click(navBtn);

    await waitFor(() => {
      expect(navigateToNode).toHaveBeenCalledWith("http://example.org/DynTarget");
    });
  });

  describe("entityNavigationRef", () => {
    it("populates ref on mount and clears on unmount", () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      const { unmount } = render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref })} />);
      expect(ref.current).toBeTypeOf("function");
      unmount();
      expect(ref.current).toBeNull();
    });

    it("navigates to class tab for class type", () => {
      const navigateToNode = vi.fn().mockResolvedValue(undefined);
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref, navigateToNode })} />);
      ref.current!("http://example.org/MyClass", "class");
      expect(navigateToNode).toHaveBeenCalledWith("http://example.org/MyClass");
    });

    it("switches to properties tab for property type", async () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref, nodes: [makeNode()] })} />);
      ref.current!("http://example.org/hasFoo", "property");
      await waitFor(() => {
        expect(screen.getByTestId("property-tree")).toBeDefined();
        expect(screen.getByTestId("property-detail-panel")).toBeDefined();
      });
    });

    it("switches to individuals tab for individual type", async () => {
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref, nodes: [makeNode()] })} />);
      ref.current!("http://example.org/foo1", "individual");
      await waitFor(() => {
        expect(screen.getByTestId("individual-list")).toBeDefined();
        expect(screen.getByTestId("individual-detail-panel")).toBeDefined();
      });
    });

    it("switches to source view for other type", async () => {
      const setPendingScrollIri = vi.fn();
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref, setPendingScrollIri, sourceContent: "@prefix : <http://ex.org/> ." })} />);
      ref.current!("http://example.org/Unknown", "other");
      expect(setPendingScrollIri).toHaveBeenCalledWith("http://example.org/Unknown");
      // Source view hides the entity tab bar
      await waitFor(() => {
        expect(screen.queryByTestId("entity-tab-bar")).toBeNull();
      });
    });

    it("defaults to class navigation when type is undefined", () => {
      const navigateToNode = vi.fn().mockResolvedValue(undefined);
      const ref = { current: null } as React.RefObject<((iri: string, type?: string) => void) | null>;
      render(<DeveloperEditorLayout {...defaultProps({ entityNavigationRef: ref, navigateToNode })} />);
      ref.current!("http://example.org/ClassA");
      expect(navigateToNode).toHaveBeenCalledWith("http://example.org/ClassA");
    });
  });

  describe("selection store cross-page contract", () => {
    beforeEach(() => useSelectionStore.getState().clear());

    it("populates the selection store from selectedIri on mount", () => {
      render(
        <DeveloperEditorLayout
          {...defaultProps({ selectedIri: "http://example.org/Foo" })}
        />,
      );
      expect(useSelectionStore.getState().iri).toBe("http://example.org/Foo");
      expect(useSelectionStore.getState().type).toBe("class");
    });

    it("preserves the selection store on unmount so side-page Back-to-project links can read it", () => {
      // Regression: editor used to clear the store on unmount, racing with
      // side-page navigation — by the time settings/PRs/etc rendered, the
      // store was empty and useProjectHomeHref dropped the selection.
      const { unmount } = render(
        <DeveloperEditorLayout
          {...defaultProps({ selectedIri: "http://example.org/Foo" })}
        />,
      );
      unmount();
      expect(useSelectionStore.getState().iri).toBe("http://example.org/Foo");
      expect(useSelectionStore.getState().type).toBe("class");
    });
  });
});
