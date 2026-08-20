import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListResponse } from "@/lib/api/projects";

const { listProjects, sessionState } = vi.hoisted(() => ({
  listProjects: vi.fn(),
  sessionState: {
    data: null as { accessToken?: string } | null,
    status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
  },
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  useSession: () => sessionState,
}));

vi.mock("@/lib/api/projects", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/projects")>();
  return {
    ...original,
    projectApi: { ...original.projectApi, list: listProjects },
  };
});

vi.mock("@/components/layout/header", () => ({
  Header: () => <header>OntoKit</header>,
}));

vi.mock("@/components/projects/project-card", () => ({
  ProjectCard: ({ project }: { project: { name: string } }) => (
    <article>{project.name}</article>
  ),
}));

vi.mock("@/components/projects/demo-project-entry", () => ({
  DemoProjectEntry: () => <section>Demo entry</section>,
}));

import HomePage from "@/app/page";

const seededResponse: ProjectListResponse = {
  items: [
    {
      id: "folio-dev",
      name: "FOLIO DEV",
      is_public: true,
      owner_id: "seed-user",
      created_at: "2026-08-08T00:00:00Z",
      member_count: 1,
    },
  ],
  total: 1,
  unfiltered_total: 1,
  skip: 0,
  limit: 50,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe("HomePage public projects", () => {
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;

  beforeEach(() => {
    listProjects.mockReset();
    sessionState.data = null;
    sessionState.status = "unauthenticated";
    process.env.NEXT_PUBLIC_AUTH_MODE = "disabled";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
  });

  it("shows public projects to an anonymous visitor", async () => {
    listProjects.mockResolvedValue(seededResponse);

    renderPage();

    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(listProjects).toHaveBeenCalledWith(0, 50, "public", undefined, undefined);
    expect(screen.queryByText("No projects available")).toBeNull();
  });

  it("does not gate the public list on a loading session in auth-disabled mode", async () => {
    sessionState.status = "loading";
    listProjects.mockResolvedValue(seededResponse);

    renderPage();

    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("shows the empty state only after a genuinely empty successful response", async () => {
    listProjects.mockResolvedValue({
      items: [],
      total: 0,
      unfiltered_total: 0,
      skip: 0,
      limit: 50,
    });

    renderPage();

    expect(await screen.findByText("No projects available")).toBeDefined();
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("shows an error instead of the empty state when the public request fails", async () => {
    listProjects.mockRejectedValue(new Error("Failed to load projects"));

    renderPage();

    expect(await screen.findByText("Failed to load projects")).toBeDefined();
    expect(screen.queryByText("No projects available")).toBeNull();
    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce());
  });
});
