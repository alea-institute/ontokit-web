import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ replace: vi.fn(), get: vi.fn(), noop: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: window.location.pathname.split("/")[2] }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: state.replace, push: state.noop }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
}));
vi.mock("@/lib/api/projects", () => ({ projectApi: { get: state.get } }));
vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ success: state.noop, error: state.noop }) }));
vi.mock("@/lib/hooks/useLLMGate", () => ({ useLLMGate: () => ({ canUseLLM: false }) }));
vi.mock("@/lib/hooks/useTrustCapabilities", () => ({ useTrustCapabilities: () => ({ tier: "anonymous", refetch: state.noop }) }));
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: () => undefined }));
vi.mock("@/lib/hooks/useSuggestionBeacon", () => ({ useSuggestionBeacon: () => undefined }));
vi.mock("@/lib/hooks/useSuggestionSession", () => ({ useSuggestionSession: () => ({ entitiesModified: [], changesCount: 0 }) }));
vi.mock("@/lib/hooks/useAnonymousSuggestion", () => ({ useAnonymousSuggestion: () => ({ changesCount: 0 }) }));
vi.mock("@/lib/hooks/useSourceRevisionGuard", () => ({
  SourceRevisionConflictError: class extends Error {},
  useSourceRevisionGuard: () => ({ conflict: null }),
}));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({ DeveloperEditorLayout: () => null }));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({ StandardEditorLayout: () => null }));
vi.mock("@/components/editor/HealthCheckPanel", () => ({ HealthCheckPanel: () => null }));
vi.mock("@/components/editor/AddEntityDialog", () => ({ AddEntityDialog: () => null }));
vi.mock("@/components/revision", () => ({ BranchSelector: () => null, RevisionHistoryPanel: () => null, HistoryButton: () => null }));

// Keep the actual project query and editor error rendering; isolate tree/source work.
vi.mock("@/lib/hooks/useProjectViewer", async () => {
  const { useProject } = await import("@/lib/hooks/useProject");
  return {
    useProjectViewer: ({ projectId }: { projectId: string }) => ({
      ...useProject(projectId),
      nodes: [], isTreeLoading: false, selectedIri: null,
      sourceContent: "", sourceIriIndex: new Map(),
      setSourceContent: state.noop, setSourceSnapshot: state.noop,
      setSourceIriIndex: state.noop, resetSourceState: state.noop,
      reloadSourceContent: state.noop,
    }),
  };
});

import { ApiError } from "@/lib/api/client";
import { DemoProjectShell } from "@/components/projects/demo-project-banner";
import EditorPage from "@/app/projects/[id]/editor/page";

const G1 = "aaaaaaaa-1111-4111-8111-111111111111";
const G2 = "bbbbbbbb-2222-4222-8222-222222222222";
const G3 = "cccccccc-3333-4333-8333-333333333333";
const retirement = (target: string) => new ApiError(410, "Gone", JSON.stringify({
  detail: { code: "demo_generation_retired", current_project_id: target, retired_at: null },
}));

function renderRoute(children: React.ReactNode = <EditorPage />) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  const tree = () => <QueryClientProvider client={client}><DemoProjectShell>{children}</DemoProjectShell></QueryClientProvider>;
  const view = render(tree());
  return { ...view, rerenderRoute: () => view.rerender(tree()) };
}

describe("project shell retirement redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.replace.mockReset();
    state.get.mockReset();
    window.history.replaceState(null, "", `/projects/${G1}/editor?classIri=x&foo=1`);
  });

  it("AE1: first response replaces the editor URL without retry or a not-found flash", async () => {
    let rejectProject!: (error: Error) => void;
    state.get.mockReturnValue(new Promise((_, reject) => { rejectProject = reject; }));
    const { container } = renderRoute();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    state.replace.mockImplementation(() => {
      expect(container.querySelector(".animate-spin")).not.toBeNull();
      expect(screen.queryByText("Project not found")).toBeNull();
      expect(container.querySelector("h2")).toBeNull();
    });
    await act(async () => rejectProject(retirement(G2)));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith(`/projects/${G2}/editor?classIri=x&retired_from=${G1}`));
    expect(state.get).toHaveBeenCalledTimes(1);
    expect(state.replace).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("AE3: a target already in the chain shows not-found without navigation", async () => {
    window.history.replaceState(null, "", `/projects/${G2}/editor?retired_from=${G1.toUpperCase()}`);
    state.get.mockRejectedValue(retirement(G1));
    renderRoute();
    await waitFor(() => expect(screen.getByText("Project not found")).toBeDefined());
    expect(state.replace).not.toHaveBeenCalled();
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it("AE7: follows a second retirement and appends the previous project to the chain", async () => {
    window.history.replaceState(null, "", `/projects/${G2}/editor?branch=work&foo=1&retired_from=${G1}`);
    state.get.mockRejectedValue(retirement(G3));
    renderRoute();
    await waitFor(() => expect(state.replace).toHaveBeenCalledTimes(1));
    const url = new URL(state.replace.mock.calls[0][0], window.location.origin);
    expect(url.pathname).toBe(`/projects/${G3}/editor`);
    expect([...url.searchParams]).toEqual([["branch", "work"], ["retired_from", `${G1},${G2}`]]);
  });

  it.each(["", "/dashboard", "/settings", "/suggestions", "/suggestions/review", "/translations", "/pull-requests"])("preserves sub-path %s and only carries allowed parameters", async (subPath) => {
    window.history.replaceState(null, "", `/projects/${G2}${subPath}?classIri=x&branch=work&foo=1&retired_from=invalid,${G2},${G1}`);
    state.get.mockRejectedValue(retirement(G3));
    renderRoute(<main>Route</main>);
    await waitFor(() => expect(state.replace).toHaveBeenCalledTimes(1));
    const url = new URL(state.replace.mock.calls[0][0], window.location.origin);
    expect(url.pathname).toBe(`/projects/${G3}${subPath}`);
    expect([...url.searchParams]).toEqual([["classIri", "x"], ["branch", "work"], ["retired_from", `${G1},${G2}`]]);
  });

  it("dismisses the notice without fetching the project again", async () => {
    window.history.replaceState(null, "", `/projects/${G2}/editor?retired_from=${G1}`);
    state.get.mockResolvedValue({ id: G2, name: "Demo", is_demo: true });
    const { rerenderRoute } = renderRoute(<main>Route</main>);
    await waitFor(() => expect(screen.getByRole("status")).toBeDefined());
    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss retired demo notice" }));
    rerenderRoute();
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.location.search).toBe("");
    expect(state.get).toHaveBeenCalledTimes(1);
    expect(state.replace).not.toHaveBeenCalled();
  });
});
