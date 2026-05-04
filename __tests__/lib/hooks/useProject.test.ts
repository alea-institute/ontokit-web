import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { derivePermissions, useProject } from "@/lib/hooks/useProject";
import { ApiError } from "@/lib/api/client";
import type { Project } from "@/lib/api/projects";

// Mock the projectApi module
vi.mock("@/lib/api/projects", () => ({
  projectApi: {
    get: vi.fn(),
  },
}));

import { projectApi } from "@/lib/api/projects";

const mockedGet = projectApi.get as ReturnType<typeof vi.fn>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    is_public: true,
    owner_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    member_count: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// derivePermissions
// ---------------------------------------------------------------------------
describe("derivePermissions", () => {
  it("returns all false/falsy when project is null", () => {
    const perms = derivePermissions(null);
    expect(perms.canManage).toBe(false);
    expect(perms.canEdit).toBe(false);
    expect(perms.canSuggest).toBe(false);
    expect(perms.isSuggester).toBe(false);
    expect(perms.isSuggestionMode).toBe(false);
    expect(perms.hasValidAccess).toBe(false);
    expect(perms.hasOntology).toBe(false);
    expect(perms.hasExplicitRole).toBe(false);
  });

  it("grants canManage and canEdit for owner role", () => {
    const perms = derivePermissions(makeProject({ user_role: "owner" }));
    expect(perms.canManage).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canSuggest).toBe(true);
    expect(perms.isSuggester).toBe(false);
    expect(perms.isSuggestionMode).toBe(false);
    expect(perms.hasExplicitRole).toBe(true);
  });

  it("grants canManage and canEdit for admin role", () => {
    const perms = derivePermissions(makeProject({ user_role: "admin" }));
    expect(perms.canManage).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canSuggest).toBe(true);
    expect(perms.isSuggester).toBe(false);
    expect(perms.hasExplicitRole).toBe(true);
  });

  it("grants canEdit but not canManage for editor role", () => {
    const perms = derivePermissions(makeProject({ user_role: "editor" }));
    expect(perms.canManage).toBe(false);
    expect(perms.canEdit).toBe(true);
    expect(perms.canSuggest).toBe(true);
    expect(perms.isSuggester).toBe(false);
    expect(perms.isSuggestionMode).toBe(false);
    expect(perms.hasExplicitRole).toBe(true);
  });

  it("grants canSuggest but not canEdit for suggester role", () => {
    const perms = derivePermissions(makeProject({ user_role: "suggester" }));
    expect(perms.canManage).toBe(false);
    expect(perms.canEdit).toBe(false);
    expect(perms.canSuggest).toBe(true);
    expect(perms.isSuggester).toBe(true);
    expect(perms.isSuggestionMode).toBe(true);
    expect(perms.hasExplicitRole).toBe(true);
  });

  it("grants no edit/manage for viewer role", () => {
    const perms = derivePermissions(makeProject({ user_role: "viewer" }));
    expect(perms.canManage).toBe(false);
    expect(perms.canEdit).toBe(false);
    expect(perms.isSuggester).toBe(false);
    expect(perms.canSuggest).toBe(false);
    expect(perms.hasExplicitRole).toBe(true);
  });

  it("treats authenticated user without explicit role as suggester", () => {
    const perms = derivePermissions(
      makeProject({ user_role: undefined }),
      "token-123"
    );
    expect(perms.isSuggester).toBe(true);
    expect(perms.isSuggestionMode).toBe(true);
    expect(perms.canSuggest).toBe(true);
    expect(perms.canEdit).toBe(false);
    expect(perms.hasExplicitRole).toBe(false);
  });

  it("treats unauthenticated user without role as having no suggest access", () => {
    const perms = derivePermissions(makeProject({ user_role: undefined }));
    expect(perms.isSuggester).toBe(false);
    expect(perms.canSuggest).toBe(false);
    expect(perms.hasValidAccess).toBe(false);
  });

  it("grants canManage and canEdit for superadmin regardless of role", () => {
    const perms = derivePermissions(
      makeProject({ user_role: undefined, is_superadmin: true })
    );
    expect(perms.canManage).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canSuggest).toBe(true);
  });

  it("superadmin with viewer role still gets canManage/canEdit", () => {
    const perms = derivePermissions(
      makeProject({ user_role: "viewer", is_superadmin: true })
    );
    expect(perms.canManage).toBe(true);
    expect(perms.canEdit).toBe(true);
  });

  it("reports hasValidAccess when accessToken is provided", () => {
    const perms = derivePermissions(makeProject(), "token-abc");
    expect(perms.hasValidAccess).toBe(true);
  });

  it("reports hasOntology when source_file_path is set", () => {
    const perms = derivePermissions(
      makeProject({ source_file_path: "ontology.ttl" })
    );
    expect(perms.hasOntology).toBe(true);
  });

  it("reports no ontology when source_file_path is absent", () => {
    const perms = derivePermissions(makeProject({ source_file_path: undefined }));
    expect(perms.hasOntology).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useProject hook
// ---------------------------------------------------------------------------
describe("useProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loading state initially", () => {
    mockedGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.project).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
  });

  it("returns project data on success", async () => {
    const project = makeProject({ id: "proj-1", name: "My Project" });
    mockedGet.mockResolvedValue(project);

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.project).toEqual(project);
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
  });

  it("classifies 403 without token as private-403", async () => {
    mockedGet.mockRejectedValue(
      new ApiError(403, "Forbidden", "Not allowed")
    );

    const { result } = renderHook(() => useProject("proj-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorKind).toBe("private-403");
    expect(result.current.error).toBe(
      "This is a private project. Sign in to request access."
    );
    expect(result.current.project).toBeNull();
  });

  it("classifies 403 with token as no-access", async () => {
    mockedGet.mockRejectedValue(
      new ApiError(403, "Forbidden", "Not allowed")
    );

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorKind).toBe("no-access");
    expect(result.current.error).toBe("You don't have access to this project");
  });

  it("classifies 404 as not-found", async () => {
    mockedGet.mockRejectedValue(
      new ApiError(404, "Not Found", "Project not found")
    );

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorKind).toBe("not-found");
    expect(result.current.error).toBe("Project not found");
  });

  it("classifies other errors as generic with the error message", async () => {
    mockedGet.mockRejectedValue(new Error("Network failure"));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper,
    });

    // The hook retries non-ApiError errors up to 3 times (with retryDelay: 0 for speed)
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.errorKind).toBe("generic");
    expect(result.current.error).toBe("Network failure");
  });

  it("classifies non-Error throwable as generic with fallback message", async () => {
    mockedGet.mockRejectedValue("something weird");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper,
    });

    // The hook retries non-ApiError errors up to 3 times (with retryDelay: 0 for speed)
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.errorKind).toBe("generic");
    expect(result.current.error).toBe("Failed to load project");
  });

  it("does not fetch when projectId is empty", async () => {
    const { result } = renderHook(() => useProject("", "token"), {
      wrapper: createWrapper(),
    });

    // Wait a tick to confirm no fetch happened
    await new Promise((r) => setTimeout(r, 50));

    expect(mockedGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("provides a refetch function", async () => {
    mockedGet.mockResolvedValue(makeProject());

    const { result } = renderHook(() => useProject("proj-1", "token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.refetch).toBe("function");
  });
});
