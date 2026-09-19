import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PRPartyQueueView } from "@/components/pr-party/PRPartyQueueView";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";
import type { PRPartyQueueCard } from "@/lib/api/prParty";

let params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));
vi.mock("next-auth/react", () => ({ useSession: () => ({
  data: { user: { id: "reviewer-id", email: "reviewer@example.test" }, accessToken: "queue-token" },
  status: "authenticated",
}), signIn: vi.fn() }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
function makeCard(overrides: Partial<PRPartyQueueCard> = {}): PRPartyQueueCard {
  return {
    card_id: "card-1", repo_full_name: "example/ontology", pr_number: 3,
    title: "Refine hierarchy", author_kind: "counterpart", author_github_login: "author",
    read_only: false, state: "open", head_sha: "abc123", mergeable_state: "clean",
    checks_rollup: "success", brief_status: "ready", brief_truncated: false,
    ready_at: "2026-09-01T00:00:00Z", updated_at_github: "2026-09-01T00:00:00Z",
    pr_url: "https://github.com/example/ontology/pull/3", diff_url: "https://github.com/example/ontology/pull/3/files",
    readiness: { ready: true, reason: null }, actions: [],
    other_reviewer: { has_approved: true, has_pending_intent: false }, stale: false, parked: false,
    ...overrides,
  };
}
let client: QueryClient;
let rows: PRPartyQueueCard[];
let respond: (path: string, init: RequestInit) => Response | Promise<Response>;
const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
  Promise.resolve(respond(new URL(String(input)).pathname, init)));
function normalResponse(path: string) {
  if (path.endsWith("/me")) return json({ is_reviewer: true, degraded: false, credential: null });
  if (path.endsWith("/settings")) return json({ merge_default: "manual" });
  if (path.endsWith("/queue")) return json({ cards: rows });
  throw new Error(`Unexpected request: ${path}`);
}
function mount() {
  const tree = () => <QueryClientProvider client={client}><ScreenReaderAnnouncerProvider>
    <PRPartyQueueView renderCardDetail={(card, reviewer) => <p>Detail {card.card_id} for {reviewer}</p>} />
  </ScreenReaderAnnouncerProvider></QueryClientProvider>;
  const view = render(tree());
  return () => view.rerender(tree());
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  rows = [makeCard()]; params = new URLSearchParams(); respond = normalResponse;
  fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); });

describe("PRPartyQueueView with capabilities, queue, settings and mutations", () => {
  it("keeps data requests gated until the actual capability response authorizes the reviewer", async () => {
    let release!: (value: Response) => void;
    respond = path => path.endsWith("/me")
      ? new Promise<Response>(resolve => { release = resolve; }) : normalResponse(path);
    mount();
    expect(screen.getByRole("status", { name: "Loading the review queue" })).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(json({ is_reviewer: true, degraded: false }));
    expect(await screen.findByRole("button", { name: "Refine hierarchy" })).toBeDefined();
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/api/v1/pr-party/me", "/api/v1/pr-party/queue", "/api/v1/pr-party/settings",
    ]);
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer queue-token");
  });

  it("fails closed when the capability endpoint denies access", async () => {
    respond = () => json({ detail: "Permission denied" }, 403);
    mount();
    expect(await screen.findByText("PR Party is limited to designated reviewers")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("opens and collapses detail, then lets a new deep link replace both user overrides", async () => {
    rows.push(makeCard({ card_id: "parked", title: "Discuss definitions", parked: true }));
    params = new URLSearchParams("card=card-1");
    const rerender = mount();
    expect(await screen.findByText("Detail card-1 for reviewer-id")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Refine hierarchy" }));
    expect(screen.queryByText("Detail card-1 for reviewer-id")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refine hierarchy" }));
    expect(screen.getByText("Detail card-1 for reviewer-id")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(screen.getByText("No concluded reviews yet")).toBeDefined();
    params = new URLSearchParams("card=parked"); rerender();
    expect(screen.getByRole("button", { name: /^Agenda/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Detail parked for reviewer-id")).toBeDefined();
  });

  it("follows the deep-linked card into Done after the verdict invalidates and refreshes the queue", async () => {
    params = new URLSearchParams("card=card-1");
    respond = (path, init) => {
      if (!path.endsWith("/actions")) return normalResponse(path);
      expect(JSON.parse(String(init.body))).toMatchObject({ verdict: "approve", head_sha: "abc123" });
      rows = [makeCard({ actions: [{ kind: "review", verdict: "approve", status: "degraded_confirmed", head_sha: "abc123", override: false, created_at: "2026-09-01T00:00:00Z" }] })];
      return json({ action: rows[0].actions[0], card: rows[0] });
    };
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Done/ }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("Detail card-1 for reviewer-id")).toBeDefined();
    expect(screen.getByRole("button", { name: /^Queue\s*0$/ })).toBeDefined();
  });

  it("recovers an initial queue error through the real retry request and empty state", async () => {
    let attempts = 0;
    respond = path => path.endsWith("/queue") && ++attempts === 1
      ? json({ detail: "Queue unavailable" }, 403) : normalResponse(path);
    rows = []; mount();
    expect(await screen.findByText(/Queue unavailable/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nothing waiting on you")).toBeDefined();
    expect(attempts).toBe(2);
  });

  it("shows queue loading after capabilities settle and follows an unpark back to Queue", async () => {
    rows = [makeCard({ parked: true })];
    params = new URLSearchParams("card=card-1");
    let release!: (value: Response) => void;
    let requests = 0;
    respond = path => {
      if (path.endsWith("/queue") && ++requests === 1) {
        return new Promise<Response>(resolve => { release = resolve; });
      }
      if (path.endsWith("/unpark")) {
        rows = [makeCard()];
        return json(rows[0]);
      }
      return normalResponse(path);
    };
    mount();
    await waitFor(() => expect(requests).toBe(1));
    expect(screen.getByRole("group", { name: "Filter the review queue" })).toBeDefined();
    expect(screen.getByRole("status", { name: "Loading the review queue" })).toBeDefined();
    release(json({ cards: rows }));
    fireEvent.click(await screen.findByRole("button", { name: "Unpark — back to the queue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Queue/ }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("Detail card-1 for reviewer-id")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Unpark — back to the queue" })).toBeNull();
    expect(requests).toBe(2);
  });

  it("keeps a background-refresh retry disabled until its response restores the cached queue", async () => {
    rows = [makeCard({ brief_status: "failed" })];
    let requests = 0;
    let release!: (value: Response) => void;
    respond = path => {
      if (path.endsWith("/rerun-review")) return json({ status: "requested" });
      if (path.endsWith("/queue")) {
        requests++;
        if (requests === 2) return json({ detail: "Refresh denied" }, 403);
        if (requests === 3) return new Promise<Response>(resolve => { release = resolve; });
      }
      return normalResponse(path);
    };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Run AI review again" }));
    expect(await screen.findByText(/Refresh denied/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Retrying…" })).toHaveProperty("disabled", true);
    release(json({ cards: [makeCard({ brief_status: "brewing" })] }));
    expect(await screen.findByRole("button", { name: "Refine hierarchy" })).toBeDefined();
    expect(screen.queryByText(/Refresh denied/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Run AI review again" })).toBeNull();
    expect(requests).toBe(3);
  });

  it.each(["https://github.com.evil.test/example/ontology/pull/3", "javascript:alert(1)"])("keeps manual merging unavailable for an untrusted server URL %s", async pr_url => {
    rows = [makeCard({ author_kind: "own", read_only: true, pr_url })];
    mount();
    expect(await screen.findByText("The GitHub merge link is unavailable.")).toBeDefined();
    expect(screen.queryByRole("link", { name: /Merge it on GitHub/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Merge pull request" })).toBeNull();
    expect([...document.querySelectorAll("a")].some(link => link.getAttribute("href") === pr_url)).toBe(false);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("uses loaded manual merge preferences for an approved own pull request", async () => {
    rows = [makeCard({ author_kind: "own", read_only: true })];
    mount();
    expect((await screen.findByRole("link", { name: /Merge it on GitHub/i })).getAttribute("href")).toBe(rows[0].pr_url);
    expect(screen.queryByRole("button", { name: "Merge pull request" })).toBeNull();
  });
});
