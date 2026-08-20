import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { viewerState } = vi.hoisted(() => ({
  viewerState: {
    canSuggest: true,
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  usePathname: () => "/projects/proj-1",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/hooks/useProject", () => ({
  useProject: () => ({
    project: { id: "proj-1", name: "Public ontology", source_file_path: "ontology.ttl" },
    isLoading: false,
    error: null,
    errorKind: null,
  }),
  derivePermissions: () => ({ canManage: false, hasOntology: true }),
}));

vi.mock("@/lib/hooks/useTrustCapabilities", () => ({
  useTrustCapabilities: () => ({
    capabilities: {
      tier: "reviewer",
      can_suggest: true,
      can_mint_entities: true,
    },
  }),
}));

vi.mock("@/lib/hooks/useProjectViewer", () => ({
  useProjectViewer: () => ({
    project: { name: "Public ontology" },
    canManage: false,
    canSuggest: viewerState.canSuggest,
    hasValidAccess: false,
    nodes: [],
    totalClasses: 1,
    isTreeLoading: false,
    treeError: null,
    selectedIri: null,
    expandNode: vi.fn(),
    collapseNode: vi.fn(),
    selectNode: vi.fn(),
    navigateToNode: vi.fn(),
    collapseAll: vi.fn(),
    collapseOneLevel: vi.fn(),
    expandOneLevel: vi.fn(),
    expandAllFully: vi.fn(),
    hasExpandableNodes: false,
    hasExpandedNodes: false,
    isExpandingAll: false,
    selectedNodeFallback: null,
    sourceContent: "",
    setSourceContent: vi.fn(),
    isLoadingSource: false,
    sourceError: null,
    isPreloading: false,
    loadSourceContent: vi.fn(),
    sourceIriIndex: new Map(),
  }),
}));

vi.mock("@/lib/context/BranchContext", () => ({
  BranchProvider: ({ children }: { children: React.ReactNode }) => children,
  useBranch: () => ({ defaultBranch: "main", isLoading: false }),
}));

vi.mock("@/lib/context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/components/layout/header", () => ({ Header: () => <header /> }));
vi.mock("@/components/editor/ModeSwitcher", () => ({ ModeSwitcher: () => null }));
vi.mock("@/components/editor/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/projects/demo-project-entry", () => ({ DemoProjectLink: () => null }));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({ StandardEditorLayout: () => null }));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({ DeveloperEditorLayout: () => null }));
vi.mock("@/lib/stores/editorModeStore", () => ({ useEditorModeStore: () => "standard" }));
vi.mock("@/lib/stores/selectionStore", () => ({ useSelectionStore: () => vi.fn() }));

import ProjectViewerPage from "@/app/projects/[id]/page";

describe("Project viewer capability affordances", () => {
  beforeEach(() => {
    viewerState.canSuggest = true;
  });

  it("renders the editor switcher for an anonymous auth-disabled principal with can_suggest", () => {
    render(<ProjectViewerPage />);

    expect(screen.getByRole("link", { name: "Editor" })).toBeDefined();
    expect(screen.queryByText("Sign in to edit")).toBeNull();
  });
});
