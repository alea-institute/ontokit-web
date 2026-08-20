import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listProjects } = vi.hoisted(() => ({ listProjects: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/api/projects", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/projects")>();
  return {
    ...original,
    projectApi: { ...original.projectApi, list: listProjects },
  };
});

import { DemoProjectEntry, DemoProjectLink } from "@/components/projects/demo-project-entry";

function renderEntry(loader?: () => Promise<{ projects: []; unavailable: boolean }>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DemoProjectEntry loader={loader} />
    </QueryClientProvider>,
  );
}

function renderSourceLink(sourceProjectId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DemoProjectLink sourceProjectId={sourceProjectId} />
    </QueryClientProvider>,
  );
}

describe("DemoProjectEntry", () => {
  beforeEach(() => listProjects.mockReset());

  it("offers explore and edit actions only for server-marked demos", async () => {
    listProjects.mockResolvedValue({
      items: [
        {
          id: "demo-folio",
          name: "FOLIO Demo",
          is_public: true,
          is_demo: true,
          owner_id: "owner",
          created_at: "2026-08-20T00:00:00Z",
          member_count: 1,
        },
        {
          id: "ordinary",
          name: "Ordinary public project",
          is_public: true,
          owner_id: "owner",
          created_at: "2026-08-20T00:00:00Z",
          member_count: 1,
        },
      ],
      total: 2,
      unfiltered_total: 2,
      skip: 0,
      limit: 100,
    });

    renderEntry();

    expect(await screen.findByText("FOLIO Demo")).toBeDefined();
    expect(screen.queryByText("Ordinary public project")).toBeNull();
    expect(screen.getByRole("link", { name: /Explore/ }).getAttribute("href"))
      .toBe("/projects/demo-folio");
    expect(screen.getByRole("link", { name: /Try editing/ }).getAttribute("href"))
      .toBe("/projects/demo-folio/editor");
  });

  it("shows an explicit unavailable state when the loader cannot reach demos", async () => {
    renderEntry(async () => ({ projects: [], unavailable: true }));

    expect(await screen.findByText("Demo workspaces are temporarily unavailable.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("shows a preparation state when no server-marked demo exists", async () => {
    listProjects.mockResolvedValue({
      items: [],
      total: 0,
      unfiltered_total: 0,
      skip: 0,
      limit: 100,
    });
    renderEntry();

    expect(await screen.findByText("Demo workspaces are being prepared.")).toBeDefined();
  });

  it("links a live source project to only its server-linked demo", async () => {
    listProjects.mockResolvedValue({
      items: [
        {
          id: "demo-folio",
          name: "FOLIO Demo",
          is_public: true,
          is_demo: true,
          demo_source_project_id: "folio-live",
          owner_id: "owner",
          created_at: "2026-08-20T00:00:00Z",
          member_count: 1,
        },
      ],
      total: 1,
      unfiltered_total: 1,
      skip: 0,
      limit: 100,
    });

    renderSourceLink("folio-live");

    expect(
      (await screen.findByRole("link", { name: /Try demo/ })).getAttribute("href"),
    ).toBe("/projects/demo-folio");
  });
});
