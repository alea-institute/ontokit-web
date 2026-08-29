import React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";

interface TestEntity {
  iri: string;
  label: string;
  entityType: "class";
  parentIri?: string;
}

interface AddEntityDialogProps {
  onConfirm: (entity: TestEntity) => Promise<void>;
}

interface StandardEditorLayoutProps {
  onAddEntity: (parentIri?: string) => void;
  onDeleteClass: (iri: string, label: string) => void;
  onUpdateClass: (iri: string, data: {
    labels: Array<{ value: string; language?: string }>;
    comments: Array<{ value: string; language?: string }>;
    parent_iris: string[];
    annotations: Array<{ property_iri: string; values: string[] }>;
    deprecated: boolean;
  }) => Promise<void>;
  onAddSuggestedChild: (iri: string, label: string, parentIri: string) => Promise<void>;
}

interface DeleteConfirmProps {
  onConfirm: () => Promise<void>;
}

interface RevisionConflictFixture {
  detail: {
    code: "SOURCE_REVISION_CONFLICT";
    message: string;
    base_revision: string;
    current_revision: string;
    branch: string;
  };
  draftContent: string;
}

const lifecycle = vi.hoisted(() => ({
  anonymousOptions: null as null | {
    onSubmitted?: (prNumber: number, prUrl: string | null) => void;
  },
  sessionState: {
    data: null as { accessToken?: string } | null,
    status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
  },
  viewerOverrides: {} as Record<string, unknown>,
  trustOverrides: {} as Record<string, unknown>,
  addEntityDialogProps: null as AddEntityDialogProps | null,
  standardEditorLayoutProps: null as StandardEditorLayoutProps | null,
  deleteConfirmProps: null as DeleteConfirmProps | null,
  branchOnChange: null as ((branch: string) => void) | null,
  guardConflict: null as RevisionConflictFixture | null,
  setSourceContent: vi.fn(),
  setSourceSnapshot: vi.fn(),
  resetSourceState: vi.fn(),
  reloadSourceContent: vi.fn(),
  getFileAtVersion: vi.fn(),
  deleteClass: vi.fn(),
  persistGeneratedEntity: vi.fn(),
  saveDirectSource: vi.fn(),
  captureSourceConflict: vi.fn(),
  updateClassInTurtle: vi.fn(),
}));

const noop = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => lifecycle.sessionState,
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/projects/project-1/editor",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/editor/CommitMessageDialog", () => ({ CommitMessageDialog: () => null }));
vi.mock("@/components/editor/AddEntityDialog", () => ({
  AddEntityDialog: (props: AddEntityDialogProps) => {
    lifecycle.addEntityDialogProps = props;
    return null;
  },
}));
vi.mock("@/components/editor/ModeSwitcher", () => ({ ModeSwitcher: () => null }));
vi.mock("@/components/editor/ViewerEditorSwitcher", () => ({ ViewerEditorSwitcher: () => null }));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({
  DeveloperEditorLayout: () => <div data-testid="developer-layout" />,
}));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({
  StandardEditorLayout: (props: StandardEditorLayoutProps) => {
    lifecycle.standardEditorLayoutProps = props;
    return <div data-testid="standard-layout" />;
  },
}));
vi.mock("@/components/revision", () => ({
  BranchSelector: ({ onBranchChange }: { onBranchChange: (branch: string) => void }) => {
    lifecycle.branchOnChange = onBranchChange;
    return null;
  },
  RevisionHistoryPanel: () => null,
  HistoryButton: () => null,
}));
vi.mock("@/components/editor/HealthCheckPanel", () => ({ HealthCheckPanel: () => null }));
vi.mock("@/components/ui/ConnectionStatus", () => ({ ConnectionStatus: () => null }));
vi.mock("@/components/editor/KeyboardShortcutDialog", () => ({ KeyboardShortcutDialog: () => null }));
vi.mock("@/components/editor/SuggestionSubmitDialog", () => ({ SuggestionSubmitDialog: () => null }));
vi.mock("@/components/editor/DeleteImpactAnalysis", () => ({ DeleteImpactAnalysis: () => null }));
vi.mock("@/components/editor/RemoteSyncIndicator", () => ({ RemoteSyncIndicator: () => null }));
vi.mock("@/components/editor/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/suggestions/CreditModal", () => ({ CreditModal: () => null }));
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: DeleteConfirmProps & { title?: string }) => {
    if (props.title === "Delete Class") lifecycle.deleteConfirmProps = props;
    return null;
  },
}));

vi.mock("@/lib/api/revisions", () => ({
  revisionsApi: { getFileAtVersion: lifecycle.getFileAtVersion },
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    projectOntologyApi: {
      ...actual.projectOntologyApi,
      deleteClass: lifecycle.deleteClass,
    },
  };
});

vi.mock("@/lib/editor/generatedEntityPersistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/editor/generatedEntityPersistence")>();
  return { ...actual, persistGeneratedEntity: lifecycle.persistGeneratedEntity };
});

vi.mock("@/lib/hooks/useSourceRevisionGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hooks/useSourceRevisionGuard")>();
  return {
    ...actual,
    useSourceRevisionGuard: () => ({
      conflict: lifecycle.guardConflict,
      isLoadingLatest: false,
      saveSource: lifecycle.saveDirectSource,
      loadLatest: vi.fn(),
      captureConflict: lifecycle.captureSourceConflict,
    }),
  };
});

vi.mock("@/lib/ontology/turtleClassUpdater", () => ({
  updateClassInTurtle: lifecycle.updateClassInTurtle,
}));

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock("@/lib/context/BranchContext", () => ({
  BranchProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  branchQueryKeys: { list: () => ["branches"] },
}));

vi.mock("@/lib/stores/editorModeStore", () => ({
  useEditorModeStore: (selector: (state: { editorMode: string }) => unknown) =>
    selector({ editorMode: "standard" }),
}));

vi.mock("@/lib/stores/selectionStore", () => ({
  useSelectionStore: (selector: (state: { setMode: typeof noop }) => unknown) =>
    selector({ setMode: noop }),
}));

vi.mock("@/lib/hooks/useLLMGate", () => ({
  useLLMGate: () => ({ canUseLLM: false }),
}));

vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock("@/lib/hooks/useSuggestionBeacon", () => ({
  useSuggestionBeacon: () => undefined,
}));

vi.mock("@/lib/hooks/useSuggestionSession", () => ({
  useSuggestionSession: () => ({
    sessionId: null,
    beaconToken: null,
    changesCount: 0,
    entitiesModified: [],
    isActive: false,
    isResumed: false,
    startSession: vi.fn(),
    saveToSession: vi.fn(),
    submitSession: vi.fn(),
    resubmitSession: vi.fn(),
    discardSession: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAnonymousSuggestion", () => ({
  useAnonymousSuggestion: (options: typeof lifecycle.anonymousOptions) => {
    lifecycle.anonymousOptions = options;
    return {
      sessionId: "anonymous-session",
      branch: "suggest/anonymous-session",
      changesCount: 0,
      isActive: true,
      startSession: vi.fn(),
      saveToSession: vi.fn(),
      submitSession: vi.fn(),
      discardSession: vi.fn(),
    };
  },
}));

vi.mock("@/lib/hooks/useTrustCapabilities", () => ({
  useTrustCapabilities: () => ({
    tier: "anonymous",
    canMintEntities: false,
    isLoading: false,
    isError: false,
    promotionProgress: null,
    refetch: vi.fn(),
    ...lifecycle.trustOverrides,
  }),
}));

vi.mock("@/lib/hooks/useProjectViewer", () => ({
  useProjectViewer: () => ({
    project: { id: "project-1", name: "Public Ontology", is_public: true },
    isLoading: false,
    error: null,
    errorKind: null,
    openPRCount: 0,
    pendingSuggestionCount: 0,
    lintSummary: null,
    normalizationStatus: null,
    canManage: false,
    canEdit: false,
    canSuggest: false,
    isSuggestionMode: false,
    hasValidAccess: false,
    hasOntology: true,
    nodes: [],
    totalClasses: 0,
    isTreeLoading: false,
    treeError: null,
    selectedIri: null,
    loadRootClasses: vi.fn(),
    expandNode: vi.fn(),
    collapseNode: vi.fn(),
    selectNode: vi.fn(),
    navigateToNode: vi.fn().mockResolvedValue(undefined),
    addOptimisticNode: vi.fn(),
    removeOptimisticNode: vi.fn(),
    updateNodeLabel: vi.fn(),
    collapseAll: vi.fn(),
    collapseOneLevel: vi.fn(),
    expandOneLevel: vi.fn(),
    expandAllFully: vi.fn(),
    hasExpandableNodes: false,
    hasExpandedNodes: false,
    isExpandingAll: false,
    reparentOptimistic: vi.fn(),
    rollbackReparent: vi.fn(),
    selectedNodeFallback: null,
    sourceContent: "",
    setSourceContent: lifecycle.setSourceContent,
    sourceRevision: null,
    setSourceSnapshot: lifecycle.setSourceSnapshot,
    isLoadingSource: false,
    sourceError: null,
    isPreloading: false,
    loadSourceContent: vi.fn(),
    reloadSourceContent: lifecycle.reloadSourceContent,
    sourceIriIndex: new Map(),
    setSourceIriIndex: vi.fn(),
    connectionStatus: "disabled",
    wsEndpoint: "",
    wsPurpose: "",
    resetSourceState: lifecycle.resetSourceState,
    ...lifecycle.viewerOverrides,
  }),
}));

import EditorPage from "@/app/projects/[id]/editor/page";

describe("anonymous proposal submission lifecycle", () => {
  beforeEach(() => {
    lifecycle.anonymousOptions = null;
    lifecycle.sessionState.data = null;
    lifecycle.sessionState.status = "unauthenticated";
    lifecycle.viewerOverrides = {};
    lifecycle.trustOverrides = {};
    lifecycle.addEntityDialogProps = null;
    lifecycle.standardEditorLayoutProps = null;
    lifecycle.deleteConfirmProps = null;
    lifecycle.branchOnChange = null;
    lifecycle.guardConflict = null;
    lifecycle.setSourceContent.mockReset();
    lifecycle.setSourceSnapshot.mockReset();
    lifecycle.resetSourceState.mockReset();
    lifecycle.reloadSourceContent.mockReset();
    lifecycle.getFileAtVersion.mockReset();
    lifecycle.deleteClass.mockReset().mockResolvedValue(undefined);
    lifecycle.persistGeneratedEntity.mockReset();
    lifecycle.saveDirectSource.mockReset().mockResolvedValue({ commit_hash: "revision-saved" });
    lifecycle.captureSourceConflict.mockReset();
    lifecycle.updateClassInTurtle.mockReset().mockImplementation((source: string) => `${source}\n# modified`);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  });

  function configureDirectEditor(sourceContent = "", sourceRevision: string | null = null) {
    lifecycle.sessionState.data = { accessToken: "access-token" };
    lifecycle.sessionState.status = "authenticated";
    lifecycle.viewerOverrides = {
      canEdit: true,
      canSuggest: true,
      hasValidAccess: true,
      sourceContent,
      sourceRevision,
    };
    lifecycle.trustOverrides = {
      tier: "established",
      canMintEntities: true,
    };
  }

  function selectMainBranch() {
    act(() => lifecycle.branchOnChange?.("main"));
  }

  it("renders the public editor while optional-auth session state is loading", () => {
    lifecycle.sessionState.status = "loading";

    renderWithQueryClient(<EditorPage />);

    expect(screen.getByTestId("standard-layout")).toBeDefined();
  });

  it("opens from onSubmitted and clears the page-owned dialog state when closed", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<EditorPage />);

    expect(screen.queryByText(/Thank you — your proposal is in/)).toBeNull();
    expect(lifecycle.anonymousOptions?.onSubmitted).toBeTypeOf("function");

    act(() => {
      lifecycle.anonymousOptions?.onSubmitted?.(42, "https://example.org/pr/42");
    });

    expect(await screen.findByText(/Thank you — your proposal is in/)).toBeDefined();
    expect(screen.getByText(/proposal #42/)).toBeDefined();
    expect(screen.getByRole("link", { name: /View proposal/ }).getAttribute("href")).toBe(
      "https://example.org/pr/42",
    );

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText(/Thank you — your proposal is in/)).toBeNull();
  });

  it("pairs a preloaded add-entity draft with the response revision", async () => {
    configureDirectEditor();
    lifecycle.getFileAtVersion.mockResolvedValue({
      content: "@prefix : <https://example.org/> .\n",
      revision: "revision-preloaded",
    });
    renderWithQueryClient(<EditorPage />);
    selectMainBranch();

    await act(async () => {
      await lifecycle.addEntityDialogProps?.onConfirm({
        iri: "https://example.org/Child",
        label: "Child",
        entityType: "class",
        parentIri: "https://example.org/Parent",
      });
    });

    expect(lifecycle.getFileAtVersion).toHaveBeenCalledWith(
      "project-1",
      "main",
      "access-token",
      undefined,
    );
    expect(lifecycle.setSourceSnapshot).toHaveBeenCalledWith(
      expect.stringContaining("https://example.org/Child"),
      "revision-preloaded",
    );
    expect(lifecycle.setSourceContent).not.toHaveBeenCalled();
  });

  it("resets the paired snapshot after delete so the next form edit refetches", async () => {
    configureDirectEditor("stale source", "revision-stale");
    lifecycle.getFileAtVersion.mockResolvedValue({
      content: "fresh source",
      revision: "revision-fresh",
    });
    const rendered = renderWithQueryClient(<EditorPage />);
    selectMainBranch();
    lifecycle.resetSourceState.mockClear();

    act(() => {
      lifecycle.standardEditorLayoutProps?.onDeleteClass(
        "https://example.org/Deleted",
        "Deleted",
      );
    });
    await act(async () => {
      await lifecycle.deleteConfirmProps?.onConfirm();
    });

    expect(lifecycle.resetSourceState).toHaveBeenCalledTimes(1);

    lifecycle.viewerOverrides = {
      ...lifecycle.viewerOverrides,
      sourceContent: "",
      sourceRevision: null,
    };
    rendered.rerender(<EditorPage />);

    await act(async () => {
      await lifecycle.standardEditorLayoutProps?.onUpdateClass(
        "https://example.org/Kept",
        {
          labels: [{ value: "Updated" }],
          comments: [],
          parent_iris: [],
          annotations: [],
          deprecated: false,
        },
      );
    });

    expect(lifecycle.getFileAtVersion).toHaveBeenCalledWith(
      "project-1",
      "main",
      "access-token",
      undefined,
    );
    expect(lifecycle.saveDirectSource).toHaveBeenCalledWith(
      "fresh source\n# modified",
      "Update class Updated",
      "revision-fresh",
    );
  });

  it("blocks generated direct persistence while source conflict recovery is pending", async () => {
    configureDirectEditor("stale source", "revision-stale");
    lifecycle.guardConflict = {
      detail: {
        code: "SOURCE_REVISION_CONFLICT",
        message: "The branch changed.",
        base_revision: "revision-stale",
        current_revision: "revision-current",
        branch: "main",
      },
      draftContent: "preserved draft",
    };
    renderWithQueryClient(<EditorPage />);
    selectMainBranch();

    await expect(lifecycle.standardEditorLayoutProps?.onAddSuggestedChild(
      "https://example.org/Generated",
      "Generated",
      "https://example.org/Parent",
    )).rejects.toThrow(/Load the latest source/);

    expect(lifecycle.persistGeneratedEntity).not.toHaveBeenCalled();
    expect(lifecycle.getFileAtVersion).not.toHaveBeenCalled();
    expect(lifecycle.setSourceSnapshot).not.toHaveBeenCalled();
  });
});
