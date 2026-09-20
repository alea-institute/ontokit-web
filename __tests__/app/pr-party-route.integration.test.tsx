import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";
import { qaDraftKey } from "@/components/pr-party/QAThread";
import { ToastProvider } from "@/lib/context/ToastContext";
import type { PRPartyCardDetail } from "@/lib/api/prParty";
import ReviewPage from "@/app/pr-party/page";

const boundary = vi.hoisted(() => ({ session: null as Session | null, params: new URLSearchParams(), push: vi.fn(), signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/pr-party", useSearchParams: () => boundary.params, useRouter: () => ({ push: boundary.push }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: boundary.session, status: boundary.session ? "authenticated" : "unauthenticated" }), signIn: boundary.signIn, signOut: vi.fn() }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const initial: PRPartyCardDetail = {
  card_id: "route-card", repo_full_name: "example/ontology", pr_number: 7,
  title: "Clarify definition", author_kind: "counterpart", author_github_login: "author",
  read_only: false, state: "open", head_sha: "abc123", mergeable_state: "clean",
  checks_rollup: "success", brief_status: "ready", brief_truncated: false,
  ready_at: "2026-09-01T00:00:00Z", updated_at_github: "2026-09-01T00:00:00Z",
  pr_url: "https://github.com/example/ontology/pull/7", diff_url: "https://github.com/example/ontology/pull/7/files",
  readiness: { ready: true, reason: null }, actions: [],
  other_reviewer: { has_approved: true, has_pending_intent: false }, stale: false, parked: false,
  brief_what: "Clarifies an axiom.", brief_why: "Remove ambiguity.", brief_decisions: [],
  brief_links: [], truncated_note: null, brewing_since: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", qa_thread: [],
};
let client: QueryClient;
let detail: PRPartyCardDetail;
let isReviewer: boolean;
let emptyQueue: boolean;
let detailStatus: number;
let unexpected: string[];
const requests: { path: string; method: string; authorization: string | null; body: unknown }[] = [];
function mount() {
  return render(<QueryClientProvider client={client}><ToastProvider><ScreenReaderAnnouncerProvider><ReviewPage /></ScreenReaderAnnouncerProvider></ToastProvider></QueryClientProvider>);
}
beforeEach(() => {
  boundary.session = { user: { id: "route-reviewer", email: "reviewer@example.test" }, accessToken: "route-token", expires: "2099-01-01T00:00:00Z" };
  boundary.params = new URLSearchParams(); boundary.signIn.mockClear(); boundary.push.mockClear();
  detail = { ...initial, qa_thread: [] }; isReviewer = true; emptyQueue = false; detailStatus = 200;
  unexpected = []; requests.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path, method: init?.method ?? "GET", authorization: new Headers(init?.headers).get("Authorization"), body });
    if (path.endsWith("/notifications")) return json({ items: [], unread_count: 0 });
    if (path === "/api/v1/pr-party/me") return json({ is_reviewer: isReviewer, degraded: false, credential: null });
    if (path === "/api/v1/pr-party/settings") return json({ merge_default: "manual" });
    if (path === "/api/v1/pr-party/queue") return json({ cards: emptyQueue ? [] : [detail] });
    if (path.endsWith("/cards/route-card")) return detailStatus === 200 ? json(detail) : json({ detail: "Detail unavailable" }, detailStatus);
    if (path.endsWith("/cards/route-card/questions")) {
      detail = { ...detail, qa_thread: [{ question_comment_id: "question-1", question_body: body.question, question_author: "route-reviewer", question_url: initial.pr_url + "#issuecomment-1", asked_at: initial.created_at, answer_comment_id: null, answer_body: null, answer_author: null, answer_url: null, answered_at: null }] };
      return json({ posted: true, degraded: false, card: detail });
    }
    unexpected.push(path); return json({ detail: "Unexpected fixture request" }, 404);
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); localStorage.removeItem(qaDraftKey("route-card", "route-reviewer")); expect(unexpected).toEqual([]); });

describe("review route through real queue, detail, question form and API hooks", () => {
  it("opens a deep-linked card and posts a question through its real detail panel", async () => {
    boundary.params = new URLSearchParams({ card: "route-card" }); mount();
    expect(screen.getByRole("heading", { name: "Review" })).toBeDefined();
    await screen.findByText("Clarifies an axiom.");
    const input = await screen.findByRole("textbox", { name: "Ask the author a question" });
    fireEvent.change(input, { target: { value: "  Why this definition?  " } });
    fireEvent.click(screen.getByRole("button", { name: "Ask on the pull request" }));
    await screen.findByText("No answer yet.");
    expect(requests.find(r => r.path.endsWith("/questions"))).toMatchObject({ method: "POST", authorization: "Bearer route-token", body: { question: "Why this definition?" } });
    expect((input as HTMLTextAreaElement).value).toBe("");
    expect(screen.getAllByRole("link", { name: /Merge it on GitHub/ }).every(link => link.getAttribute("href") === initial.pr_url)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clarify definition" }));
    expect(screen.queryByRole("textbox", { name: "Ask the author a question" })).toBeNull();
  });

  it("recovers a detail error by collapsing and reopening the same queue card", async () => {
    detailStatus = 403; mount();
    fireEvent.click(await screen.findByRole("button", { name: "Clarify definition" }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Ask the author a question" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clarify definition" })); detailStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "Clarify definition" }));
    await screen.findByText("Clarifies an axiom.");
    expect(requests.filter(r => r.path.endsWith("/cards/route-card"))).toHaveLength(2);
  });

  it("shows the empty queue inside the route without requesting card details", async () => {
    emptyQueue = true; mount(); await screen.findByText("Nothing waiting on you");
    expect(requests.some(r => r.path.includes("/cards/"))).toBe(false);
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Review" })).toBeDefined();
  });

  it("gates a signed-in non-reviewer before queue or detail requests", async () => {
    isReviewer = false; mount(); await screen.findByText("PR Party is limited to designated reviewers");
    expect(requests.some(r => r.path.endsWith("/queue") || r.path.includes("/cards/"))).toBe(false);
  });

  it("keeps an anonymous deep link gated without authenticated HTTP requests", async () => {
    boundary.session = null; boundary.params = new URLSearchParams({ card: "route-card" }); mount();
    await waitFor(() => expect(within(screen.getByRole("main")).getByRole("button", { name: /Sign in/i })).toBeDefined());
    expect(requests).toEqual([]);
  });
});
