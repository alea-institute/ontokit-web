import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListResponse } from "@/lib/api/projects";

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

import {
  DemoProjectEntry,
  DemoProjectLink,
  loadDemoProjectForSource,
  loadDemoProjects,
} from "@/components/projects/demo-project-entry";

function renderEntry() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DemoProjectEntry />
    </QueryClientProvider>,
  );
}

function projectList(items: ProjectListResponse["items"], limit = items.length) {
  return {
    items,
    total: items.length,
    unfiltered_total: items.length,
    skip: 0,
    limit,
  } satisfies ProjectListResponse;
}

function demoProject(id = "demo-folio", sourceProjectId = "folio-live") {
  return {
    id,
    name: id === "demo-folio" ? "FOLIO Demo" : id,
    is_public: true,
    is_demo: true,
    demo_source_project_id: sourceProjectId,
    owner_id: "owner",
    created_at: "2026-08-20T00:00:00Z",
    member_count: 1,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
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
    listProjects.mockResolvedValue(
      projectList([
        demoProject(),
        {
          id: "ordinary",
          name: "Ordinary public project",
          is_public: true,
          owner_id: "owner",
          created_at: "2026-08-20T00:00:00Z",
          member_count: 1,
        },
      ], 2),
    );

    renderEntry();

    expect(await screen.findByText("FOLIO Demo")).toBeDefined();
    expect(screen.queryByText("Ordinary public project")).toBeNull();
    expect(screen.getByRole("link", { name: /Explore/ }).getAttribute("href"))
      .toBe("/projects/demo-folio");
    expect(screen.getByRole("link", { name: /Try editing/ }).getAttribute("href"))
      .toBe("/projects/demo-folio/editor");
    expect(listProjects).toHaveBeenCalledOnce();
    expect(listProjects).toHaveBeenCalledWith(0, 2, "public", undefined, undefined, {
      isDemo: true,
    });
  });

  it("uses the real loader to translate a rejected request into unavailable", async () => {
    listProjects.mockRejectedValueOnce(new Error("offline"));
    renderEntry();

    expect(await screen.findByText("Demo workspaces are temporarily unavailable.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("disables retry in flight and recovers when the request succeeds", async () => {
    const user = userEvent.setup();
    const retry = deferred<ProjectListResponse>();
    listProjects
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(retry.promise);
    renderEntry();

    const retryButton = await screen.findByRole("button", { name: "Try again" });
    await user.click(retryButton);

    const pendingButton = screen.getByRole("button", { name: "Trying again…" });
    expect(pendingButton).toHaveProperty("disabled", true);
    await user.click(pendingButton);
    expect(listProjects).toHaveBeenCalledTimes(2);

    await act(async () => retry.resolve(projectList([demoProject()], 1)));

    expect(await screen.findByRole("link", { name: /Explore/ })).toBeDefined();
    expect(screen.queryByText("Demo workspaces are temporarily unavailable.")).toBeNull();
  });

  it("shows a preparation state when no server-marked demo exists", async () => {
    listProjects.mockResolvedValue(projectList([], 2));
    renderEntry();

    expect(await screen.findByText("Demo workspaces are being prepared.")).toBeDefined();
  });

  it("links a live source project to only its server-linked demo", async () => {
    listProjects.mockResolvedValue(projectList([demoProject()], 1));

    renderSourceLink("folio-live");

    expect(
      (await screen.findByRole("link", { name: /Try demo/ })).getAttribute("href"),
    ).toBe("/projects/demo-folio");
    expect(listProjects).toHaveBeenCalledWith(0, 1, "public", undefined, undefined, {
      isDemo: true,
      demoSourceProjectId: "folio-live",
    });
    expect(screen.queryByRole("button", { name: /Try demo/ })).toBeNull();
  });

  it("does not link a source when the exact lookup returns no match", async () => {
    listProjects.mockResolvedValue(projectList([demoProject("other-demo", "other-live")], 1));
    renderSourceLink("folio-live");

    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: /Try demo/ })).toBeNull();
  });

  it("degrades without a source link when exact lookup is unavailable", async () => {
    listProjects
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    renderSourceLink("folio-live");

    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: /Try demo/ })).toBeNull();
    await expect(loadDemoProjectForSource("folio-live")).resolves.toEqual({
      project: null,
      unavailable: true,
    });
  });

  it("keeps discovery to one bounded request", async () => {
    listProjects.mockResolvedValue(
      projectList([demoProject(), demoProject("demo-canon", "canon-live")], 2),
    );

    await expect(loadDemoProjects()).resolves.toMatchObject({ unavailable: false });
    expect(listProjects).toHaveBeenCalledOnce();
    expect(listProjects).toHaveBeenCalledWith(0, 2, "public", undefined, undefined, {
      isDemo: true,
    });
  });
});
