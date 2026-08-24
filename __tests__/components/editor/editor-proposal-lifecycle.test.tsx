import React from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/helpers/renderWithProviders";

const lifecycle = vi.hoisted(() => ({
  anonymousOptions: null as null | {
    onSubmitted?: (prNumber: number, prUrl: string | null) => void;
  },
  sessionState: {
    data: null as { accessToken?: string } | null,
    status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
  },
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
vi.mock("@/components/editor/AddEntityDialog", () => ({ AddEntityDialog: () => null }));
vi.mock("@/components/editor/ModeSwitcher", () => ({ ModeSwitcher: () => null }));
vi.mock("@/components/editor/ViewerEditorSwitcher", () => ({ ViewerEditorSwitcher: () => null }));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({
  DeveloperEditorLayout: () => <div data-testid="developer-layout" />,
}));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({
  StandardEditorLayout: () => <div data-testid="standard-layout" />,
}));
vi.mock("@/components/revision", () => ({
  BranchSelector: () => null,
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
vi.mock("@/components/ui/confirm-dialog", () => ({ ConfirmDialog: () => null }));

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
    setSourceContent: vi.fn(),
    isLoadingSource: false,
    sourceError: null,
    isPreloading: false,
    loadSourceContent: vi.fn(),
    sourceIriIndex: new Map(),
    setSourceIriIndex: vi.fn(),
    connectionStatus: "disabled",
    wsEndpoint: "",
    wsPurpose: "",
    resetSourceState: vi.fn(),
  }),
}));

import EditorPage from "@/app/projects/[id]/editor/page";

describe("anonymous proposal submission lifecycle", () => {
  beforeEach(() => {
    lifecycle.anonymousOptions = null;
    lifecycle.sessionState.data = null;
    lifecycle.sessionState.status = "unauthenticated";
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  });

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
});
