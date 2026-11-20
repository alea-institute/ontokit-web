import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectChangesPage from "@/app/projects/[id]/changes/page";
import ProjectViewerPage from "@/app/projects/[id]/page";
import { changes, changesWithTransient, lease, legacyTenant, renewal, temporaryClause } from "@/__tests__/components/changes/changeFixtures";
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
    expect(screen.getByRole("button", { name: "Human", description: "3 events" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("link", { name: "Back to project" }).getAttribute("href")).toBe("/projects/project-1");

    const editor = "/projects/project-1/editor";
    expect(screen.getByRole("link", { name: "Lease" }).getAttribute("href"))
      .toBe(`${editor}?classIri=https%3A%2F%2Fexample.org%2Fonto%23Lease&branch=review`);
    expect(screen.getByRole("link", { name: "has renewal" }).getAttribute("href"))
      .toBe(`${editor}?propertyIri=https%3A%2F%2Fexample.org%2Fonto%23hasRenewal&branch=review`);
    expect(within(screen.getByRole("link", { name: "has renewal" }).closest("li")!).getByText("Property")).toBeDefined();
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
  });

  it("round-trips the entity type the feed stores for properties", async () => {
    navigation.search = "?entity_type=property";
    respond = (params) => json(params.get("entity_type") === "property"
      ? { ...changes, items: [renewal] }
      : changes);
    render(page());

    const properties = within(screen.getByRole("group", { name: "Entity type" }))
      .getByRole("button", { name: "Property" });
    expect(properties.getAttribute("aria-pressed")).toBe("true");
    expect(await screen.findByRole("link", { name: "has renewal" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Lease" })).toBeNull();
    expect(requests.some((params) => params.get("entity_type") === "property")).toBe(true);
  });

  it("makes row and event timestamps keyboard-accessible in the viewer's time zone", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const user = userEvent.setup();
    render(page());

    const row = (await screen.findByRole("link", { name: "Lease" })).closest("li")!;
    const rowTime = row.querySelector("time")!;
    rowTime.focus();
    expect(document.activeElement).toBe(rowTime);
    const expected = new Date(lease.last_changed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" });
    expect((await screen.findByRole("tooltip")).textContent).toBe(expected);

    await user.tab();
    const details = within(row).getByRole("button", { name: "Details for Lease" });
    expect(document.activeElement).toBe(details);
    expect(details.getAttribute("aria-expanded")).toBe("false");
    await user.keyboard("{Enter}");
    expect(details.getAttribute("aria-expanded")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(row.querySelectorAll("time")[1]);
    expect((await screen.findByRole("tooltip")).textContent).toBe(expected);
  });

  it("distinguishes an unavailable historical value from a known empty value", async () => {
    respond = () => json({
      ...changes,
      items: [{
        ...lease,
        field_changes: [{ field: "definitions", before: null, after: ["Recorded definition."] }],
      }],
    });
    render(page());

    fireEvent.click(await screen.findByRole("button", { name: "Details for Lease" }));
    expect(screen.getByText("Value unavailable")).toBeDefined();
    expect(screen.queryByText("None")).toBeNull();
    expect(screen.getByText("Recorded definition.").closest("ins")).toBeNull();
  });

  it("marks a repeated field value when only one occurrence was removed", async () => {
    respond = () => json({
      ...changes,
      items: [{
        ...lease,
        field_changes: [{ field: "labels", before: ["Lease", "Lease"], after: ["Lease"] }],
      }],
    });
    render(page());

    const details = await screen.findByRole("button", { name: "Details for Lease" });
    fireEvent.click(details);
    const field = screen.getByRole("heading", { name: "Labels" }).closest("li")!;
    const values = within(field).getAllByText("Lease");
    expect(values.filter((value) => value.closest("del"))).toHaveLength(1);
    expect(values.every((value) => !value.closest("ins"))).toBe(true);
  });

  it("counts and filters transient entities without linking to them in the editor", async () => {
    respond = () => json(changesWithTransient);
    const { rerender } = render(page());
    const count = await screen.findByRole("button", { name: "1 Added, then removed" });
    expect(count.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 Removed" })).toBeDefined();

    fireEvent.click(count);
    expect(new URLSearchParams(navigation.search).get("net_change")).toBe("transient");
    rerender(page());
    const filter = within(screen.getByRole("group", { name: "Change kind" }))
      .getByRole("button", { name: "Added, then removed" });
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Added, then removed")).toBeDefined();
    expect(within(row).getByText("Trial clause")).toBeDefined();
    expect(within(row).queryByRole("link")).toBeNull();
    expect(requests.every((params) => !params.has("event_type"))).toBe(true);

    fireEvent.click(filter);
    expect(new URLSearchParams(navigation.search).has("net_change")).toBe(false);
  });

  it("keeps the full entity history visible under an origin filter", async () => {
    navigation.search = "?origin=ai&net_change=transient";
    respond = () => json({
      ...changes,
      summary: {
        ...changes.summary,
        total_events: 3,
        entities_changed: 1,
        by_net_change: { added: 0, modified: 0, removed: 0, transient: 1 },
        by_origin: { human: 2, ai: 1, ai_edited: 0, system: 0 },
        authors: [
          { ...lease.authors[0], event_count: 1 },
          { ...temporaryClause.authors[0], event_count: 2 },
        ],
      },
      items: [temporaryClause],
    });
    render(page());

    const detailButton = await screen.findByRole("button", { name: "Details for Trial clause" });
    expect(requests.some((params) => params.get("origin") === "ai")).toBe(true);
    expect(screen.getByRole("button", { name: "Human", description: "2 events" })).toBeDefined();
    fireEvent.click(detailButton);
    expect(screen.getByText("Deleted")).toBeDefined();
    expect(screen.getByText("Created")).toBeDefined();
    expect(screen.getByText("example-model")).toBeDefined();
  });

  it("identifies a rename history event as a label change", async () => {
    respond = () => json({
      ...changes,
      items: [{
        ...lease,
        events: [{ ...lease.events[0], event_type: "rename", changed_fields: ["labels"] }],
      }],
    });
    render(page());

    fireEvent.click(await screen.findByRole("button", { name: "Details for Lease" }));
    expect(screen.getByText("Label changed")).toBeDefined();
  });

  it("exposes both origin toggles as the same named filter and synchronizes them through the URL", async () => {
    const user = userEvent.setup();
    respond = () => json(changesWithTransient);
    const { rerender } = render(page());
    const summary = screen.getByRole("region", { name: "Change summary" });
    const filters = screen.getByRole("region", { name: "Filters" });
    const summaryToggle = await within(within(summary).getByRole("group", { name: "Origin" }))
      .findByRole("button", { name: "AI", description: "1 event" });
    const filterToggle = within(within(filters).getByRole("group", { name: "Origin" }))
      .getByRole("button", { name: "AI" });
    expect(summaryToggle.getAttribute("aria-pressed")).toBe("false");
    expect(filterToggle.getAttribute("aria-pressed")).toBe("false");

    summaryToggle.focus();
    await user.keyboard("{Enter}");
    rerender(page());
    expect(new URLSearchParams(navigation.search).getAll("origin")).toEqual(["ai"]);
    expect(summaryToggle.getAttribute("aria-pressed")).toBe("true");
    expect(filterToggle.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(requests.at(-1)?.getAll("origin")).toEqual(["ai"]));

    filterToggle.focus();
    await user.keyboard(" ");
    rerender(page());
    expect(new URLSearchParams(navigation.search).getAll("origin")).toEqual([]);
    expect(summaryToggle.getAttribute("aria-pressed")).toBe("false");
    expect(filterToggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("opens Changes help with the keyboard and explains the window, IRI renames and AI origin", async () => {
    const user = userEvent.setup();
    render(page());

    const help = screen.getByRole("button", { name: "How changes are tracked" });
    expect(help.getAttribute("aria-expanded")).toBe("false");
    const helpText = document.getElementById(help.getAttribute("aria-controls")!);
    expect(helpText?.hidden).toBe(true);
    help.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(help);
    expect(help.getAttribute("aria-expanded")).toBe("true");
    expect(helpText?.hidden).toBe(false);
    expect(helpText?.textContent).toMatch(/renaming an entity's IRI shows as one removal plus one addition/i);
    expect(helpText?.textContent).toMatch(/AI origin tracks class creation only/i);
    expect(helpText?.textContent).toMatch(/AI-suggested annotations, parents, and edges on existing entities are not tracked/i);
    expect(helpText?.textContent).toMatch(/24-hour periods in UTC.*local time zone/i);
  });

  it("round-trips filters through the URL and refetches when the window changes", async () => {
    navigation.search = "?branch=review&author=reviewer";
    respond = (params) => json(params.has("author")
      ? { ...changes, summary: { ...changes.summary, authors: [changes.summary.authors[0]] } }
      : changes);
    const { rerender } = render(page());

    const origin = within(screen.getByRole("region", { name: "Filters" })).getByRole("group", { name: "Origin" });
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

    fireEvent.click(within(window).getByRole("radio", { name: "Last 24 hours" }));
    rerender(page());
    await waitFor(() => expect(requests.some((params) => params.get("days") === "1")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    rerender(page());
    expect([...new URLSearchParams(navigation.search)]).toEqual([["branch", "review"]]);
    expect((within(window).getByRole("radio", { name: "7 days" }) as HTMLInputElement).checked).toBe(true);
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("round-trips every filter on a shared URL and ignores unknown selections", async () => {
    navigation.search = "?branch=review&days=30&origin=ai&origin=unknown&author=reviewer&author=unknown&entity_type=class&entity_type=unknown&net_change=transient&net_change=unknown";
    respond = (params) => {
      if (params.getAll("author").includes("unknown")) return json({ detail: "Unknown author" }, 422);
      if (params.has("origin")) {
        return json({
          ...changesWithTransient,
          summary: { ...changesWithTransient.summary, authors: [] },
          items: [temporaryClause],
        });
      }
      return json(changesWithTransient);
    };
    const { rerender } = render(page());

    expect(await screen.findByText("Trial clause")).toBeDefined();
    expect(requests.map((params) => Object.fromEntries(params))).toContainEqual({
      days: "30", branch: "review", origin: "ai", entity_type: "class", author: "reviewer",
    });
    expect(requests.every((params) => !Array.from(params.values()).includes("unknown"))).toBe(true);
    expect(requests.every((params) => !params.has("event_type") && !params.has("net_change"))).toBe(true);
    expect((screen.getByRole("radio", { name: "30 days" }) as HTMLInputElement).checked).toBe(true);
    const filters = screen.getByRole("region", { name: "Filters" });
    for (const [group, name] of [
      ["Origin", "AI"], ["Author", "Reviewer"], ["Entity type", "Class"], ["Change kind", "Added, then removed"],
    ]) {
      expect(within(within(filters).getByRole("group", { name: group })).getByRole("button", { name }).getAttribute("aria-pressed"))
        .toBe("true");
    }
    expect(screen.queryByRole("button", { name: "unknown" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    rerender(page());
    expect(navigation.search).toBe("?branch=review");
    expect((screen.getByRole("radio", { name: "7 days" }) as HTMLInputElement).checked).toBe(true);
    expect(await screen.findByRole("link", { name: "Lease" })).toBeDefined();
    expect([...requests.at(-1)!]).toEqual([["days", "7"], ["branch", "review"]]);
  });

  it("clears a nondefault time window when it is the only filter", async () => {
    navigation.search = "?days=90";
    const { rerender } = render(page());

    expect((screen.getByRole("radio", { name: "90 days" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    rerender(page());
    expect(navigation.search).toBe("");
    expect((screen.getByRole("radio", { name: "7 days" }) as HTMLInputElement).checked).toBe(true);
  });

  it("uses the default window for an unknown window value", async () => {
    navigation.search = "?days=366";
    render(page());

    expect((screen.getByRole("radio", { name: "7 days" }) as HTMLInputElement).checked).toBe(true);
    expect(await screen.findByRole("link", { name: "Lease" })).toBeDefined();
    expect(requests[0].get("days")).toBe("7");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("filters by net change and can load matching entities on later pages", async () => {
    respond = (params) => json({
      ...changes,
      items: params.get("cursor") === "last" ? [renewal] : params.has("cursor") ? [legacyTenant] : [lease],
      next_cursor: params.get("cursor") === "last" ? null : params.has("cursor") ? "last" : "next",
    });
    const { rerender } = render(page());

    fireEvent.click(await screen.findByRole("button", { name: "1 Added" }));
    expect(new URLSearchParams(navigation.search).get("net_change")).toBe("added");
    rerender(page());
    expect(screen.queryByRole("link", { name: "Lease" })).toBeNull();
    expect(screen.getByText("0 of 1 matching entity shown from loaded pages.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("0 more changes loaded."));
    expect(screen.getByText("0 of 1 matching entity shown from loaded pages.")).toBeDefined();
    expect(requests.at(-1)?.get("cursor")).toBe("next");

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("link", { name: "has renewal" })).toBeDefined();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("1 more change loaded."));
    expect(requests.at(-1)?.get("cursor")).toBe("last");
    expect(requests.every((params) => !params.has("event_type") && !params.has("net_change"))).toBe(true);
  });

  it("shows a filtered empty state when the window has zero matches even with a cursor", async () => {
    navigation.search = "?net_change=transient";
    respond = () => json({ ...changes, items: [lease], next_cursor: "next" });
    render(page());

    expect(await screen.findByText("No changes match your filters")).toBeDefined();
    expect(screen.getByText(/widen the time window or clear filters/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows filters in the empty state when the API returns no matching entities", async () => {
    navigation.search = "?origin=system";
    respond = (params) => json(params.has("origin") ? {
      ...changes,
      summary: {
        total_events: 0, entities_changed: 0, by_net_change: { added: 0, modified: 0, removed: 0, transient: 0 },
        by_origin: { human: 0, ai: 0, ai_edited: 0, system: 0 }, authors: [],
      },
      items: [],
    } : changes);
    render(page());

    expect(await screen.findByText("No changes match your filters")).toBeDefined();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDefined();
  });

  it("announces loading and shows the empty state after retrying a failed read", async () => {
    const user = userEvent.setup();
    let release!: (response: Response) => void;
    respond = () => new Promise<Response>((resolve) => { release = resolve; });
    render(page());
    expect(screen.getByRole("status").textContent).toBe("Loading changes.");
    const region = screen.getByRole("region", { name: "Changed entities" });
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.querySelectorAll("[aria-hidden='true'] .animate-pulse")).toHaveLength(9);
    const empty: ProjectChangesResponse = {
      ...changes,
      summary: {
        total_events: 0, entities_changed: 0, by_net_change: { added: 0, modified: 0, removed: 0, transient: 0 },
        by_origin: { human: 0, ai: 0, ai_edited: 0, system: 0 }, authors: [],
      },
      items: [],
    };
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release(json({ detail: "Unavailable" }, 422));
    expect(await screen.findByText("Failed to load changes")).toBeDefined();
    respond = () => json(empty);
    screen.getByRole("button", { name: "Retry" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("No changes in the last 7 days")).toBeDefined();
    expect(screen.getByText(/widen the time window to look for earlier changes/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Changed entities" }));
    expect(requests).toHaveLength(2);
  });

  it("preserves keyboard focus during pagination and recovers it after the final page", async () => {
    const user = userEvent.setup();
    let release: ((response: Response) => void) | undefined;
    let fail = true;
    respond = (params) => {
      if (!params.has("cursor")) return json({ ...changes, items: [lease], next_cursor: "next" });
      if (fail) return json({ detail: "Unavailable" }, 422);
      return new Promise<Response>((resolve) => { release = resolve; });
    };
    render(page());

    const loadMore = await screen.findByRole("button", { name: "Load more" });
    loadMore.focus();
    await user.keyboard("{Enter}");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(document.activeElement).toBe(retry);
    expect(screen.getByRole("link", { name: "Lease" })).toBeDefined();
    fail = false;
    await user.keyboard("{Enter}");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    expect(document.activeElement).toBe(retry);
    expect(retry.getAttribute("aria-disabled")).toBe("true");
    release!(json({ ...changes, items: [legacyTenant, renewal] }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("2 more changes loaded."));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Changed entities" }));
    expect(requests.map((params) => params.get("cursor"))).toEqual([null, "next", "next"]);
  });
});
