import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectChangesPage from "@/app/projects/[id]/changes/page";
import ProjectViewerPage from "@/app/projects/[id]/page";
import { changes, lease, renewal } from "@/__tests__/components/changes/changeFixtures";
import type { ProjectChangesResponse } from "@/lib/api/changes";

const navigation = vi.hoisted(() => ({
  path: "/projects/project-1/changes",
  search: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  usePathname: () => navigation.path,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push }),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
vi.mock("@/components/layout/header", () => ({ Header: () => <header>OntoKit</header> }));
vi.mock("@/components/editor/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/projects/demo-project-entry", () => ({ DemoProjectLink: () => null }));
vi.mock("@/components/editor/standard/StandardEditorLayout", () => ({ StandardEditorLayout: () => null }));
vi.mock("@/components/editor/developer/DeveloperEditorLayout", () => ({ DeveloperEditorLayout: () => null }));

let client: QueryClient;
let requests: URLSearchParams[];
let respond: (params: URLSearchParams) => Response | Promise<Response>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function page() {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider><ProjectChangesPage /></TooltipProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  navigation.search = "";
  navigation.push.mockReset().mockImplementation((href: string) => {
    navigation.search = new URL(href, "https://example.org").search;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  requests = [];
  respond = () => json(changes);
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/analytics/changes")) {
      requests.push(url.searchParams);
      return respond(url.searchParams);
    }
    if (url.pathname.endsWith("/projects/project-1")) {
      return json({ id: "project-1", name: "Example ontology", is_public: true });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

describe("project Changes page", () => {
  it("offers a Changes link from the project navigation", async () => {
    render(<QueryClientProvider client={client}><ProjectViewerPage /></QueryClientProvider>);

    expect((await screen.findByRole("link", { name: "Changes" })).getAttribute("href"))
      .toBe("/projects/project-1/changes");
  });

  it("shows the summary, typed editor links and collapsed details", async () => {
    render(page());

    expect(await screen.findByRole("heading", { name: "Changes", level: 1 })).toBeDefined();
    expect(await screen.findByText("Branch: review")).toBeDefined();
    expect(screen.getByRole("group", { name: "Net change" })).toBeDefined();
    expect(screen.getByRole("button", { name: "1 Modified" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "1 AI" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("link", { name: "Back to project" }).getAttribute("href")).toBe("/projects/project-1");

    const editor = "/projects/project-1/editor";
    expect(screen.getByRole("link", { name: "Lease" }).getAttribute("href"))
      .toBe(`${editor}?classIri=https%3A%2F%2Fexample.org%2Fonto%23Lease&branch=review`);
    expect(screen.getByRole("link", { name: "has renewal" }).getAttribute("href"))
      .toBe(`${editor}?propertyIri=https%3A%2F%2Fexample.org%2Fonto%23hasRenewal&branch=review`);
    expect(screen.getByText("LegacyTenant")).toBeDefined();
    expect(screen.queryByRole("link", { name: "LegacyTenant" })).toBeNull();

    const details = screen.getByRole("button", { name: "Details for Lease" });
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("A rental agreement.")).toBeNull();
    fireEvent.click(details);
    expect(details.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("A rental agreement.").closest("del")).toBeTruthy();
    expect(screen.getByText("A contract granting use of property for a set period.").closest("ins")).toBeTruthy();
    expect(screen.getByText("Contract").closest("[title]")?.getAttribute("title")).toBe("https://example.org/onto#Contract");
    expect(screen.getByText("example-model")).toBeDefined();
  });

  it("round-trips filters through the URL and refetches when the window changes", async () => {
    navigation.search = "?branch=review&author=reviewer";
    respond = (params) => json(params.has("author")
      ? { ...changes, summary: { ...changes.summary, authors: [changes.summary.authors[0]] } }
      : changes);
    const { rerender } = render(page());

    const origin = screen.getByRole("group", { name: "Origin" });
    const ai = within(origin).getByRole("button", { name: "AI" });
    const window = screen.getByRole("radiogroup", { name: "Time window" });
    await waitFor(() => expect(requests.some((params) => params.get("author") === "reviewer")).toBe(true));
    const authors = screen.getByRole("group", { name: "Author" });
    expect((await within(authors).findByRole("button", { name: "Reviewer" })).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(await within(authors).findByRole("button", { name: "Editor" }));
    rerender(page());
    await waitFor(() => expect(requests.at(-1)?.getAll("author")).toEqual(["reviewer", "editor"]));
    expect((within(window).getByRole("radio", { name: "7 days" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(ai);
    expect(new URLSearchParams(navigation.search).getAll("origin")).toEqual(["ai"]);
    rerender(page());
    expect(ai.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(requests.some((params) => params.get("origin") === "ai" && params.has("author"))).toBe(true));

    const types = screen.getByRole("group", { name: "Entity type" });
    fireEvent.click(within(types).getByRole("button", { name: "Class" }));
    rerender(page());
    await waitFor(() => expect(requests.some((params) => params.get("entity_type") === "class")).toBe(true));

    fireEvent.click(within(window).getByRole("radio", { name: "30 days" }));
    rerender(page());
    await waitFor(() => expect(requests.some((params) => params.get("days") === "30")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    rerender(page());
    expect([...new URLSearchParams(navigation.search)]).toEqual([["branch", "review"], ["days", "30"]]);
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("filters by net change and can load matching entities on later pages", async () => {
    respond = (params) => json({
      ...changes,
      items: params.has("cursor") ? [renewal] : [lease],
      next_cursor: params.has("cursor") ? null : "next",
    });
    const { rerender } = render(page());

    fireEvent.click(await screen.findByRole("button", { name: "1 Added" }));
    expect(new URLSearchParams(navigation.search).get("net_change")).toBe("added");
    rerender(page());
    expect(screen.queryByRole("link", { name: "Lease" })).toBeNull();
    expect(requests[0].has("event_type")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("link", { name: "has renewal" })).toBeDefined();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("1 more change loaded."));
    expect(requests.at(-1)?.get("cursor")).toBe("next");
  });

  it("announces loading and shows the empty state after retrying a failed read", async () => {
    let release!: (response: Response) => void;
    respond = () => new Promise<Response>((resolve) => { release = resolve; });
    render(page());
    expect(screen.getByRole("status").textContent).toBe("Loading changes.");
    const empty: ProjectChangesResponse = {
      ...changes,
      summary: {
        total_events: 0, entities_changed: 0, by_net_change: { added: 0, modified: 0, removed: 0 },
        by_origin: { human: 0, ai: 0, ai_edited: 0, system: 0 }, authors: [],
      },
      items: [],
    };
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release(json({ detail: "Unavailable" }, 422));
    expect(await screen.findByText("Failed to load changes")).toBeDefined();
    respond = () => json(empty);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No changes in the last 7 days")).toBeDefined();
    expect(screen.getByText(/widen the time window or clear filters/i)).toBeDefined();
    expect(requests).toHaveLength(2);
  });
});
