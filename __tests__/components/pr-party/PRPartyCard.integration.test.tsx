import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PRPartyCard } from "@/components/pr-party/PRPartyCard";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";
import { usePRPartyQueue } from "@/lib/hooks/usePRPartyQueue";
import type { PRPartyCardDetail, PRPartyQueueCard } from "@/lib/api/prParty";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "reviewer", email: "reviewer@example.test" }, accessToken: "test-token" }, status: "authenticated" }) }));
const card: PRPartyQueueCard = {
  card_id: "card-1", repo_full_name: "example/ontology", pr_number: 3,
  title: "Improve ontology", author_kind: "counterpart", author_github_login: "author",
  read_only: false, state: "open", head_sha: "abc123", mergeable_state: "clean",
  checks_rollup: "success", brief_status: "ready", brief_truncated: false,
  ready_at: "2026-09-01T00:00:00Z", updated_at_github: "2026-09-01T00:00:00Z",
  pr_url: "https://github.com/example/ontology/pull/3", diff_url: "https://github.com/example/ontology/pull/3/files",
  readiness: { ready: true, reason: null }, actions: [],
  other_reviewer: { has_approved: true, has_pending_intent: false }, stale: false, parked: false,
};
const detail: PRPartyCardDetail = {
  ...card, brief_what: "Improves class hierarchy", brief_why: "Removes ambiguity",
  brief_decisions: [], brief_links: [], truncated_note: null, brewing_since: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", qa_thread: [],
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let row: PRPartyQueueCard;
let respond: (path: string, init: RequestInit) => Response;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = new URL(String(input)).pathname;
  if (path.endsWith("/queue")) return json({ cards: [row], generated_at: "2026-09-01T00:00:00Z" });
  return respond(path, init);
});
let client: QueryClient;
function Harness({ highlighted = false }: { highlighted?: boolean }) {
  const queue = usePRPartyQueue();
  return <>{queue.cards.map(item => <PRPartyCard key={item.card_id} card={item} detail={detail} highlighted={highlighted}
    onSubmitAction={queue.submitAction} onUnpark={queue.unparkCard} onRerunReview={queue.rerunReview} />)}</>;
}
function mount(highlighted = false) {
  return render(<QueryClientProvider client={client}><ScreenReaderAnnouncerProvider><Harness highlighted={highlighted} /></ScreenReaderAnnouncerProvider></QueryClientProvider>);
}
beforeEach(() => {
  row = { ...card }; client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  fetchMock.mockClear(); sessionStorage.clear(); vi.stubGlobal("fetch", fetchMock);
  respond = () => json({ action: { merged: false, status: "recorded" }, card: detail });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PRPartyCard real queue, controls, API and announcements", () => {
  it.each(["plain", "structured"])("announces a %s verdict rejection and clears it after an explicit retry", async format => {
    let attempts = 0;
    respond = (path, init) => {
      expect(path.endsWith("/actions")).toBe(true);
      expect(init.method).toBe("POST");
      if (++attempts === 1) return format === "plain"
        ? new Response("Review permission denied", { status: 403 })
        : json({ detail: { message: "Review permission denied" } }, 403);
      return json({ action: { status: "submitted" }, card: detail });
    };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await screen.findByText("Review permission denied");
    await waitFor(() => expect(screen.getAllByRole("alert").map(node => node.textContent)).toContain("Verdict failed for Improve ontology: Review permission denied"));
    expect(attempts).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Approving review submitted"));
    expect(screen.queryByText("Review permission denied")).toBeNull();
    expect(attempts).toBe(2);
  });

  it.each([null, { message: "Gateway rejected review" }])("keeps a verdict retryable when an HTTP error lacks the review schema (%j)", async body => {
    let attempts = 0;
    respond = () => ++attempts === 1 ? json(body, 403) : json({ action: { status: "submitted" }, card: detail });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some(node => node.textContent?.includes("Verdict failed for Improve ontology"))).toBe(true));
    expect(attempts).toBe(1);
    expect(screen.getByRole("article", { name: "Improve ontology" })).toBeDefined();
    expect(screen.getByRole("status").textContent).not.toContain("Approving review submitted");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Approving review submitted"));
    expect(attempts).toBe(2);
    expect(screen.queryByText(JSON.stringify(body))).toBeNull();
    const actions = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"));
    expect(actions).toHaveLength(2);
    expect(JSON.parse(String(actions[1][1]?.body))).toMatchObject({ head_sha: "abc123" });
    expect(new Headers(actions[1][1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("scrolls the highlighted API-loaded card into view", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    try {
      mount(true);
      const article = await screen.findByRole("article", { name: "Improve ontology" });
      await waitFor(() => expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth", block: "center" }));
      expect(scroll.mock.contexts[0]).toBe(article);
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("cancels a stale approval without posting and still permits discussing the card", async () => {
    row = { ...card, stale: true };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(screen.getByRole("button", { name: "Confirm and accept anyway" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Confirm and accept anyway" })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Discuss live" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"))).toHaveLength(1));
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/actions"));
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ verdict: "discuss_live", head_sha: "abc123" });
  });

  it("cancels notes without submitting and retains the draft when reopened", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Accept with suggestions" }));
    fireEvent.change(screen.getByLabelText("Your notes"), { target: { value: "  Add an example  " } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Your notes")).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Accept with suggestions" }));
    expect((screen.getByLabelText("Your notes") as HTMLTextAreaElement).value).toBe("  Add an example  ");
    fireEvent.click(screen.getByRole("button", { name: "Send accept with suggestions" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"))).toHaveLength(1));
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/actions"));
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ verdict: "approve", body: "Add an example" });
  });

  it("opens a trusted degraded receipt and exposes the fallback link", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    respond = () => json({ action: { status: "recorded" }, card: detail, degraded: true, deep_link: card.pr_url });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("link", { name: "Recorded here — finish it on GitHub" })).toBeDefined();
    expect(open).toHaveBeenCalledWith(card.pr_url, "_blank", "noopener,noreferrer");
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Verdict recorded"));
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/actions"));
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ action_kind: "review", verdict: "approve", head_sha: "abc123", idempotency_key: expect.any(String) });
  });

  it("rejects unsafe degraded links while announcing the replay accurately", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    respond = () => json({ action: { status: "recorded" }, card: detail, degraded: true, replayed: true, deep_link: "javascript:alert(1)" });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("was already recorded"));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Recorded here — finish it on GitHub" })).toBeNull();
  });

  it("reports a confirmed own-PR merge from the actual response receipt", async () => {
    row = { ...card, read_only: true, author_kind: "own" };
    respond = () => json({ action: { merged: true, status: "merged" }, card: detail });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    expect(await screen.findByText("Merged. Improve ontology is in.")).toBeDefined();
    await waitFor(() => expect(screen.getByText("Improve ontology merged.")).toBeDefined());
    expect(screen.getByTestId("pr-party-card-merge-outcome").getAttribute("data-outcome")).toBe("merged");
  });

  it("does not claim merge success on an HTTP success with a declined receipt", async () => {
    row = { ...card, read_only: true, author_kind: "own" };
    respond = () => json({ action: { merged: false, status: "blocked" }, card: detail, deep_link: "https://evil.example/pull/3" });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    expect(await screen.findByText(/Not merged — GitHub recorded the request \(blocked\)/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Open it on GitHub" }).getAttribute("href")).toBe(card.pr_url);
  });

  it.each(["unpark", "rerun-review"])("shows %s errors, then announces and refreshes after retry", async endpoint => {
    row = { ...card, parked: true, brief_status: "failed" };
    let attempts = 0;
    respond = path => {
      expect(path.endsWith(`/${endpoint}`)).toBe(true);
      if (++attempts === 1) return json({ detail: "Request forbidden" }, 403);
      row = { ...row, parked: endpoint === "unpark" ? false : row.parked, brief_status: endpoint === "rerun-review" ? "brewing" : row.brief_status };
      return json(detail);
    };
    mount();
    const name = endpoint === "unpark" ? "Unpark — back to the queue" : "Run AI review again";
    fireEvent.click(await screen.findByRole("button", { name }));
    expect(await screen.findByText(/Request forbidden/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(endpoint === "unpark" ? "returned to the queue" : "AI review re-requested"));
    await waitFor(() => expect(screen.queryByRole("button", { name })).toBeNull());
    expect(screen.queryByText(/Request forbidden/)).toBeNull();
    expect(attempts).toBe(2);
  });

  it("requires a second explicit verdict after drift and submits the fresh head", async () => {
    let attempts = 0;
    const heads: string[] = [];
    respond = (_path, init) => {
      heads.push(JSON.parse(String(init.body)).head_sha);
      return ++attempts === 1
        ? json({ detail: { message: "PR moved", card: { ...detail, title: "Updated ontology", head_sha: "fresh456" } } }, 409)
        : json({ action: { status: "submitted" }, card: detail });
    };
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByTestId("pr-party-drift-strip")).toBeDefined();
    expect(screen.getByRole("article").getAttribute("aria-label")).toBe("Updated ontology");
    expect(heads).toEqual(["abc123"]);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.queryByTestId("pr-party-drift-strip")).toBeNull());
    expect(heads).toEqual(["abc123", "fresh456"]);
  });

  it("shows a rejected merge without retrying the side effect", async () => {
    row = { ...card, read_only: true, author_kind: "own" };
    respond = () => json({ detail: "Branch protection blocked merge" }, 403);
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    expect(await screen.findByText("Not merged. Branch protection blocked merge")).toBeDefined();
    expect(screen.getByTestId("pr-party-card-merge-outcome").getAttribute("data-outcome")).toBe("failed");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/actions"))).toHaveLength(1);
  });

  it.each([false, true])("waits for approval before offering a merge on an own PR (pending intent: %s)", async pending => {
    row = { ...card, author_kind: "own", read_only: true, author_github_login: null, other_reviewer: { has_approved: false, has_pending_intent: pending } };
    mount();
    const banner = await screen.findByTestId("pr-party-own-strip");
    expect(banner.textContent).toContain(pending ? "has a verdict in progress" : "waiting on your co-reviewer");
    expect(screen.queryByRole("button", { name: "Merge pull request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.getByText("example/ontology#3").textContent).toBe("example/ontology#3");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    row = { ...row, other_reviewer: { has_approved: true, has_pending_intent: false } };
    await act(async () => { await client.invalidateQueries(); });
    expect(await screen.findByRole("button", { name: "Merge pull request" })).toBeDefined();
    expect(banner.textContent).toContain("your co-reviewer has approved it");
    respond = () => json({ action: { merged: true, status: "merged" }, card: { ...detail, ...row } });
    fireEvent.click(screen.getByRole("button", { name: "Merge pull request" }));
    expect(await screen.findByText("Merged. Improve ontology is in.")).toBeDefined();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("renders an empty queue without actionable cards", async () => {
    fetchMock.mockImplementationOnce(async () => json({ cards: [], generated_at: "2026-09-01T00:00:00Z" }));
    mount(); await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByTestId("pr-party-card")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
