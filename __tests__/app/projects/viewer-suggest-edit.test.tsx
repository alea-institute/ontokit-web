import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viewerState = vi.hoisted(() => ({
  session: { data: null as { accessToken?: string } | null, status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated" },
  project: { id: "project-1", name: "Public Ontology", is_public: true } as { id: string; name: string; is_public: boolean },
  permissions: { canEdit: false, canSuggest: false, hasValidAccess: false },
  searchParams: "",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => viewerState.session,
  signIn: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useSearchParams: () => new URLSearchParams(viewerState.searchParams),
  usePathname: () => "/projects/project-1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/editor/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/projects/demo-project-entry", () => ({ DemoProjectLink: () => null }));
vi.mock("@/components/editor/ModeSwitcher", () => ({ ModeSwitcher: () => null }));
vi.mock("@/components/editor/ViewerEditorSwitcher", () => ({ ViewerEditorSwitcher: () => null }));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({ DeveloperEditorLayout: () => null }));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({ StandardEditorLayout: () => null }));
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/context/BranchContext", () => ({
  BranchProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBranch: () => ({ defaultBranch: "main", isLoading: false }),
}));
vi.mock("@/lib/hooks/useProject", () => ({
  useProject: () => ({
    project: viewerState.project, isRetiredRedirecting: false, isLoading: false, error: null, errorKind: null,
  }),
  derivePermissions: () => ({ canManage: false, hasOntology: true }),
}));
vi.mock("@/lib/hooks/useProjectViewer", () => ({
  useProjectViewer: () => ({
    project: viewerState.project,
    canManage: false,
    ...viewerState.permissions,
    nodes: [], totalClasses: 0, isTreeLoading: false, treeError: null,
    selectedIri: null, expandNode: vi.fn(), collapseNode: vi.fn(), selectNode: vi.fn(),
    navigateToNode: vi.fn().mockResolvedValue(undefined), collapseAll: vi.fn(), collapseOneLevel: vi.fn(),
    expandOneLevel: vi.fn(), expandAllFully: vi.fn(),
    hasExpandableNodes: false, hasExpandedNodes: false, isExpandingAll: false,
    selectedNodeFallback: null,
    sourceContent: "", setSourceContent: vi.fn(), isLoadingSource: false, sourceError: null,
    isPreloading: false, loadSourceContent: vi.fn(), sourceIriIndex: new Map(),
  }),
}));

import ProjectViewerPage from "@/app/projects/[id]/page";
import { useSelectionStore } from "@/lib/stores/selectionStore";

const suggestButton = () => screen.queryByRole("link", { name: /Suggest an edit/ });

describe("viewer \"Suggest an edit\" entry point", () => {
  beforeEach(() => {
    viewerState.session = { data: null, status: "unauthenticated" };
    viewerState.project = { id: "project-1", name: "Public Ontology", is_public: true };
    viewerState.permissions = { canEdit: false, canSuggest: false, hasValidAccess: false };
    viewerState.searchParams = "";
    useSelectionStore.setState({ iri: null, type: null });
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows for an anonymous visitor on a public project and opens the editor in propose mode for the selected class", () => {
    viewerState.searchParams = "classIri=https%3A%2F%2Fexample.org%2FA&branch=main";
    render(<ProjectViewerPage />);

    const link = suggestButton();
    expect(link).not.toBeNull();
    const href = new URL(link!.getAttribute("href")!, "http://localhost");
    expect(href.pathname).toBe("/projects/project-1/editor");
    expect(href.searchParams.get("classIri")).toBe("https://example.org/A");
    expect(href.searchParams.get("branch")).toBe("main");
    expect(href.searchParams.get("propose")).toBe("1");
  });

  it("prefers the in-page selection over the URL selection", () => {
    viewerState.searchParams = "classIri=https%3A%2F%2Fexample.org%2FStale";
    useSelectionStore.setState({ iri: "https://example.org/Current", type: "class" });
    render(<ProjectViewerPage />);

    const href = new URL(suggestButton()!.getAttribute("href")!, "http://localhost");
    expect(href.searchParams.get("classIri")).toBe("https://example.org/Current");
  });

  it("is hidden when AUTH_MODE is required", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "required");
    render(<ProjectViewerPage />);
    expect(suggestButton()).toBeNull();
  });

  it("is hidden on a private project", () => {
    viewerState.project = { id: "project-1", name: "Private Ontology", is_public: false };
    render(<ProjectViewerPage />);
    expect(suggestButton()).toBeNull();
  });

  it.each([
    ["can edit", { canEdit: true, canSuggest: true, hasValidAccess: true }],
    ["can suggest", { canEdit: false, canSuggest: true, hasValidAccess: true }],
  ])("is hidden when the user %s normally", (_label, permissions) => {
    viewerState.session = { data: { accessToken: "token" }, status: "authenticated" };
    viewerState.permissions = permissions;
    render(<ProjectViewerPage />);
    expect(suggestButton()).toBeNull();
  });

  it("is hidden while the session status is still loading", () => {
    viewerState.session = { data: null, status: "loading" };
    render(<ProjectViewerPage />);
    expect(suggestButton()).toBeNull();
  });
});
