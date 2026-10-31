import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListResponse } from "@/lib/api/projects";

const { listProjects, sessionState, signIn } = vi.hoisted(() => ({
  listProjects: vi.fn(),
  signIn: vi.fn(),
  sessionState: {
    data: null as { accessToken?: string } | null,
    status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
  },
}));

vi.mock("next-auth/react", () => ({
  signIn,
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

  const view = render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("HomePage public projects", () => {
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  const originalConfigured = process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;

  beforeEach(() => {
    listProjects.mockReset();
    sessionState.data = null;
    sessionState.status = "unauthenticated";
    process.env.NEXT_PUBLIC_AUTH_MODE = "disabled";
    process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = "false";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
    if (originalConfigured === undefined) delete process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;
    else process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = originalConfigured;
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

  it("keeps the public query gated while required-auth session state is loading", async () => {
    sessionState.status = "loading";
    process.env.NEXT_PUBLIC_AUTH_MODE = "required";
    listProjects.mockResolvedValue(seededResponse);

    renderPage();

    expect(await screen.findByText("Demo entry")).toBeDefined();
    expect(listProjects).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Checking your session…");
    expect(screen.queryByText("No projects available")).toBeNull();
  });

  it("announces the initial request until projects arrive", async () => {
    let resolve!: (response: ProjectListResponse) => void;
    listProjects.mockReturnValue(new Promise<ProjectListResponse>((done) => { resolve = done; }));

    renderPage();

    expect(screen.getByRole("status").textContent).toBe("Loading projects…");
    expect(screen.queryByText("No projects available")).toBeNull();
    await act(async () => resolve(seededResponse));
    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(screen.queryByText("Loading projects…")).toBeNull();
  });

  it("starts providerless optional browsing while the session is pending", async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = "optional";
    sessionState.status = "loading";
    listProjects.mockResolvedValue(seededResponse);

    renderPage();

    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(screen.queryByText("Checking your session…")).toBeNull();
  });

  it("clears search by keyboard, cancels a pending term and returns to page one of the same tab", async () => {
    const user = userEvent.setup();
    sessionState.status = "authenticated";
    sessionState.data = { accessToken: "fixture-token" };
    const firstPage = { ...seededResponse, total: 51, unfiltered_total: 51 };
    const lastPage = {
      ...firstPage,
      skip: 50,
      items: [{ ...seededResponse.items[0], id: "second", name: "Second page project" }],
    };
    listProjects.mockImplementation(async (skip, _limit, _filter, _token, search) =>
      search ? { ...firstPage, items: [], total: 0, skip: 0 } : skip === 50 ? lastPage : firstPage,
    );

    renderPage();
    await screen.findByText("FOLIO DEV");
    await user.click(screen.getByRole("button", { name: "Load More" }));
    await screen.findByText("Second page project");
    const input = screen.getByRole("textbox", { name: "Search projects" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "missing" } });
    await screen.findByText("No projects found");
    fireEvent.change(input, { target: { value: "pending term" } });
    screen.getByRole("button", { name: "Clear search" }).focus();
    await user.keyboard("{Enter}");

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    await screen.findByText("FOLIO DEV");
    expect(screen.queryByText("Second page project")).toBeNull();
    expect(listProjects).toHaveBeenLastCalledWith(0, 50, "mine", "fixture-token", undefined);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(listProjects.mock.calls.some((call) => call[4] === "pending term")).toBe(false);
    expect(screen.queryByText("No projects found")).toBeNull();
  });

  it("offers public browsing alongside creation for an authenticated empty My Projects", async () => {
    sessionState.status = "authenticated";
    sessionState.data = { accessToken: "fixture-token" };
    listProjects.mockImplementation(async (_skip, _limit, filter) =>
      filter === "mine" ? { ...seededResponse, items: [], total: 0, unfiltered_total: 0 } : seededResponse,
    );

    renderPage();
    await screen.findByText("No projects yet");
    expect(screen.getByRole("link", { name: "Create Project" }).getAttribute("href")).toBe("/projects/new");
    fireEvent.click(screen.getByRole("button", { name: "Browse public projects" }));
    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(listProjects).toHaveBeenLastCalledWith(0, 50, "public", "fixture-token", undefined);
  });

  it("keeps cards visible during background refresh and offers retry if refresh fails", async () => {
    listProjects.mockResolvedValue(seededResponse);
    const { queryClient } = renderPage();
    await screen.findByText("FOLIO DEV");
    let reject!: (error: Error) => void;
    listProjects.mockReturnValueOnce(new Promise<ProjectListResponse>((_resolve, fail) => { reject = fail; }));

    act(() => { void queryClient.invalidateQueries({ queryKey: ["projects"] }); });
    expect(await screen.findByText("Refreshing projects…")).toBeDefined();
    expect(screen.getByText("FOLIO DEV")).toBeDefined();
    await act(async () => reject(new Error("Refresh unavailable")));
    expect(await screen.findByText(/Refresh unavailable/)).toBeDefined();
    expect(screen.getByText("FOLIO DEV")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect(screen.queryByText(/Refresh unavailable/)).toBeNull());
    expect(screen.getByText("FOLIO DEV")).toBeDefined();
  });

  it("announces load-more without hiding existing cards", async () => {
    const firstPage = { ...seededResponse, total: 51, unfiltered_total: 51 };
    listProjects.mockResolvedValueOnce(firstPage);
    let resolve!: (response: ProjectListResponse) => void;
    listProjects.mockReturnValueOnce(new Promise<ProjectListResponse>((done) => { resolve = done; }));
    renderPage();
    await screen.findByText("FOLIO DEV");

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(await screen.findByText("Loading more projects…")).toBeDefined();
    expect(screen.getByText("FOLIO DEV")).toBeDefined();
    expect((screen.getByRole("button", { name: "Loading..." }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({
      ...firstPage, skip: 50,
      items: [{ ...seededResponse.items[0], id: "second", name: "Second page project" }],
    }));
    expect(await screen.findByText("Second page project")).toBeDefined();
    expect(screen.getByText("FOLIO DEV")).toBeDefined();
    expect(screen.queryByText("Loading more projects…")).toBeNull();
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

describe("HomePage private-tab sign-in prompt by authentication mode", () => {
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  const originalConfigured = process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;

  function setMode(mode: string, configured: boolean) {
    process.env.NEXT_PUBLIC_AUTH_MODE = mode;
    process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = configured ? "true" : "false";
  }

  beforeEach(() => {
    listProjects.mockReset();
    listProjects.mockResolvedValue(seededResponse);
    signIn.mockReset();
    sessionState.data = null;
    sessionState.status = "unauthenticated";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
    if (originalConfigured === undefined) delete process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;
    else process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = originalConfigured;
  });

  it.each([
    ["required", true],
    ["optional", true],
  ] as const)("keeps the Sign In prompt in %s mode with a provider", async (mode, configured) => {
    setMode(mode, configured);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Private" }));
    expect(await screen.findByRole("heading", { name: "Sign in to see private projects" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(signIn).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([
    ["optional", false, "Private", "Private projects aren't available here"],
    ["optional", false, "My Projects", "Your projects aren't available here"],
  ] as const)("explains unavailable sign-in in %s mode (provider flag %s) on the %s tab", async (mode, configured, tab, heading) => {
    setMode(mode, configured);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: tab }));
    expect(await screen.findByRole("heading", { name: heading })).toBeDefined();
    expect(screen.getByText(/Sign-in is unavailable in this configuration/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Sign in to/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Browse public projects" }));
    expect(await screen.findByText("FOLIO DEV")).toBeDefined();
    expect(signIn).not.toHaveBeenCalled();
  });
});

// Disabled mode keeps public browsing and explains unavailable personal tabs.
describe("HomePage in auth-disabled read-and-suggest mode", () => {
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  const originalConfigured = process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;

  beforeEach(() => {
    listProjects.mockReset();
    listProjects.mockResolvedValue(seededResponse);
    signIn.mockReset();
    sessionState.data = null;
    sessionState.status = "unauthenticated";
    process.env.NEXT_PUBLIC_AUTH_MODE = "disabled";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
    if (originalConfigured === undefined) delete process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED;
    else process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = originalConfigured;
  });

  it.each([
    ["My Projects", "mine", "false"],
    ["Private", "private", "true"],
  ] as const)("explains the unavailable %s tab (filter %s, provider flag %s) without sign-in", async (tab, filter, configured) => {
    process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = configured;
    renderPage();
    await screen.findByText("FOLIO DEV");
    fireEvent.click(screen.getByRole("button", { name: tab }));
    expect(await screen.findByRole("heading", { name: /aren't available here/ })).toBeDefined();
    expect(listProjects).not.toHaveBeenCalledWith(0, 50, filter, undefined, undefined);
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("offers no project creation from the header or personal tabs", async () => {
    listProjects.mockResolvedValue({ items: [], total: 0, unfiltered_total: 0, skip: 0, limit: 50 });
    renderPage();
    expect(screen.queryByRole("link", { name: "New Project" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "My Projects" }));
    expect(await screen.findByRole("heading", { name: "Your projects aren't available here" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Create Project" })).toBeNull();
  });

  it("keeps the anonymous prompt and no New Project action in optional mode without a provider", async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = "optional";
    process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED = "false";
    renderPage();
    await screen.findByText("FOLIO DEV");
    expect(screen.queryByRole("link", { name: "New Project" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "My Projects" }));
    expect(await screen.findByRole("heading", { name: "Your projects aren't available here" })).toBeDefined();
    expect(listProjects).not.toHaveBeenCalledWith(0, 50, "mine", undefined, undefined);
  });
});
