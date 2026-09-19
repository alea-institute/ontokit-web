import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CardDetail } from "@/components/pr-party/CardDetail";
import { qaDraftKey } from "@/components/pr-party/QAThread";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/ScreenReaderAnnouncer";
import type { PRPartyCardDetail } from "@/lib/api/prParty";

vi.mock("next-auth/react", () => ({ useSession: () => ({
  data: { user: { id: "reviewer", email: "reviewer@example.test" }, accessToken: "fixture-token" },
  status: "authenticated",
}) }));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const initial: PRPartyCardDetail = {
  card_id: "card-1", repo_full_name: "example/ontology", pr_number: 7,
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
const draftKey = qaDraftKey(initial.card_id, "reviewer");
let detail: PRPartyCardDetail;
let client: QueryClient;
let mutate: (path: string, init: RequestInit) => Response;
let failDetail: boolean;
let mergePlacement: "manual" | "dashboard";
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const fetchBoundary = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = new URL(String(input)).pathname;
  if (init.method === "POST") return mutate(path, init);
  if (path.endsWith("/cards/card-1")) return failDetail ? json({ detail: "Forbidden" }, 403) : json(detail);
  if (path.endsWith("/queue")) return json({ cards: [detail] });
  if (path.endsWith("/settings")) return json({ merge_default: mergePlacement });
  throw new Error(`Unexpected request: ${init.method} ${path}`);
});
function mount() {
  return render(<QueryClientProvider client={client}><ScreenReaderAnnouncerProvider>
    <CardDetail card={initial} reviewerId="reviewer" />
  </ScreenReaderAnnouncerProvider></QueryClientProvider>);
}
async function ask(value = "  Why this axiom?  ") {
  const input = await screen.findByRole("textbox", { name: "Ask the author a question" });
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Ask on the pull request" }));
  return input as HTMLTextAreaElement;
}
beforeEach(() => {
  detail = { ...initial, qa_thread: [] }; failDetail = false;
  mergePlacement = "dashboard";
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mutate = path => { throw new Error(`Unexpected mutation: ${path}`); };
  localStorage.clear(); fetchBoundary.mockClear(); vi.stubGlobal("fetch", fetchBoundary);
});
afterEach(() => {
  cleanup(); client.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("expanded review card with real queries, mutations and question drafts", () => {
  it("renders trusted brief links and excludes lookalike hosts and executable URLs", async () => {
    const trusted = "https://github.com/example/ontology/issues/12";
    const lookalike = "https://github.com.attacker.test/example/ontology/issues/12";
    const executable = "javascript:alert(1)";
    detail = { ...detail, brief_links: [trusted, lookalike, executable] };
    mount();
    const link = await screen.findByRole("link", { name: trusted });
    expect(link.getAttribute("href")).toBe(trusted);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByRole("link", { name: lookalike })).toBeNull();
    expect(screen.queryByRole("link", { name: executable })).toBeNull();
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === "POST")).toEqual([]);
  });

  it.each([true, false])("honors manual merge settings with a trusted PR URL: %s", async trusted => {
    mergePlacement = "manual";
    if (!trusted) detail = { ...detail, pr_url: "https://github.com.attacker.test/example/ontology/pull/7" };
    mount();
    if (trusted) expect((await screen.findByRole("link", { name: "Merge it on GitHub" })).getAttribute("href")).toBe(initial.pr_url);
    else {
      expect(await screen.findByText("The GitHub merge link is unavailable.")).toBeDefined();
      expect(screen.queryByRole("link", { name: "Merge it on GitHub" })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "Merge pull request" })).toBeNull();
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === "POST")).toEqual([]);
  });

  it("reports an incomplete merge receipt as unknown and keeps the trusted fallback link", async () => {
    mutate = () => json({ card: detail, deep_link: "https://github.com.attacker.test/merge" });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).toBe("skipped");
    expect(outcome.textContent).toContain("(unknown) without merging");
    expect(screen.getByRole("link", { name: "Open it on GitHub" }).getAttribute("href")).toBe(initial.pr_url);
  });

  it("posts a trimmed question, refreshes the thread and clears the persisted draft", async () => {
    mutate = (path, init) => {
      expect(path).toBe("/api/v1/pr-party/cards/card-1/questions");
      expect(JSON.parse(String(init.body))).toEqual({ question: "Why this axiom?" });
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer fixture-token");
      detail = { ...detail, qa_thread: [{ question_comment_id: "question-1", question_body: "Why this axiom?",
        question_author: "reviewer", question_url: initial.pr_url + "#issuecomment-1", asked_at: initial.created_at,
        answer_comment_id: null, answer_body: null, answer_author: null, answer_url: null, answered_at: null }] };
      return json({ posted: true, degraded: false, card: detail });
    };
    mount();
    const input = await ask();
    expect(await screen.findByText("No answer yet.")).toBeDefined();
    expect(input.value).toBe("");
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(fetchBoundary.mock.calls.filter(([url]) => String(url).endsWith("/cards/card-1"))).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
    expect(input.value).toBe("Why this axiom?");
    expect(document.activeElement).toBe(input);
    expect(localStorage.getItem(draftKey)).toBe("Why this axiom?");
  });

  it("keeps a rejected question across remount and clears the error after a successful retry", async () => {
    let attempts = 0;
    mutate = () => ++attempts === 1 ? json({ detail: "Posting denied" }, 403) : json({ posted: true, degraded: false, card: detail });
    const view = mount();
    await ask("Preserve this question");
    expect(await screen.findByText(/Posting denied/)).toBeDefined();
    expect(localStorage.getItem(draftKey)).toBe("Preserve this question");
    view.unmount(); mount();
    const input = await screen.findByRole("textbox", { name: "Ask the author a question" });
    expect((input as HTMLTextAreaElement).value).toBe("Preserve this question");
    fireEvent.click(screen.getByRole("button", { name: "Ask on the pull request" }));
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(""));
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(attempts).toBe(2);
  });

  it("uses the submitted question when a degraded response omits compose text", async () => {
    mutate = () => json({ posted: false, degraded: true, deep_link: null, card: detail });
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    mount();
    const input = await ask("  Keep this question  ");
    await screen.findByText("Not posted — GitHub would not take it.");
    fireEvent.click(screen.getByRole("button", { name: "Copy the question" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(copy).toHaveBeenCalledExactlyOnceWith("Keep this question");
    expect(input.value).toBe("  Keep this question  ");
    expect(screen.getByRole("link", { name: "Post it yourself on GitHub" }).getAttribute("href")).toBe(initial.pr_url);
  });

  it("renders an answered thread with absent and invalid timestamps without losing either message", async () => {
    detail = { ...detail, qa_thread: [{ question_comment_id: "question", question_body: "Why this change?", question_author: "Reviewer", question_url: initial.pr_url,
      asked_at: "invalid timestamp", answer_comment_id: "answer", answer_body: "It fixes the definition.", answer_author: "Author", answer_url: initial.pr_url, answered_at: null }] };
    mount();
    await screen.findByText("It fixes the definition.");
    expect(screen.getByText("Why this change?")).toBeDefined();
    const entry = screen.getByTestId("pr-party-qa-entry");
    expect(entry.getAttribute("data-answered")).toBe("true");
    expect(entry.textContent).not.toContain("Invalid Date");
    expect(entry.textContent).toContain("Reviewer asked");
    expect(entry.textContent).toContain("Author answered");
  });

  it("retains a degraded draft and retries clipboard failure with the exact returned body", async () => {
    mutate = () => json({ posted: false, degraded: true, body: "Exact server compose text", deep_link: "javascript:alert(1)", card: detail });
    const copy = vi.fn().mockRejectedValueOnce(new Error("Clipboard denied")).mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    mount();
    const input = await ask();
    expect(await screen.findByText("Not posted — GitHub would not take it.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Post it yourself on GitHub" }).getAttribute("href")).toBe(initial.pr_url);
    fireEvent.click(screen.getByRole("button", { name: "Copy the question" }));
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy the question" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();
    expect(copy.mock.calls).toEqual([["Exact server compose text"], ["Exact server compose text"]]);
    expect(input.value).toBe("  Why this axiom?  ");
    expect(localStorage.getItem(draftKey)).toBe(input.value);
  });

  it("can post when browser storage rejects draft reads and writes", async () => {
    const getItem = vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("Storage denied"); });
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("Storage denied"); });
    const removeItem = vi.spyOn(localStorage, "removeItem").mockImplementation(() => { throw new Error("Storage denied"); });
    mutate = () => json({ posted: true, degraded: false, card: detail });
    mount();
    const input = await ask();
    await waitFor(() => expect(input.value).toBe(""));
    expect(getItem).toHaveBeenCalledWith(draftKey);
    expect(setItem).toHaveBeenCalledWith(draftKey, "  Why this axiom?  ");
    expect(removeItem).toHaveBeenCalledWith(draftKey);
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("shows the safe GitHub fallback when loading the full review fails", async () => {
    failDetail = true; mount();
    expect(await screen.findByText("The full review could not be loaded. Read it on GitHub instead.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Open on GitHub" }).getAttribute("href")).toBe(initial.pr_url);
    expect(screen.queryByRole("button", { name: "Merge pull request" })).toBeNull();
  });

  it.each([true, false])("reports merge result only from the receipt (merged=%s)", async merged => {
    mutate = (path, init) => {
      expect(path).toBe("/api/v1/pr-party/cards/card-1/actions");
      expect(JSON.parse(String(init.body))).toMatchObject({ action_kind: "merge", head_sha: "abc123" });
      return json({ action: { merged, status: merged ? "merged" : "skipped" }, card: detail });
    };
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    expect((await screen.findByTestId("pr-party-merge-outcome")).getAttribute("data-outcome")).toBe(merged ? "merged" : "skipped");
    if (!merged) expect(screen.getByRole("link", { name: "Open it on GitHub" }).getAttribute("href")).toBe(initial.pr_url);
    await waitFor(() => expect(fetchBoundary.mock.calls.filter(([url]) => String(url).endsWith("/cards/card-1"))).toHaveLength(2));
  });

  it("keeps a failed merge actionable and replaces the failure with the successful retry receipt", async () => {
    let attempts = 0;
    mutate = () => ++attempts === 1
      ? json({ detail: "Branch protection refused the merge" }, 403)
      : json({ action: { merged: true, status: "merged" }, card: detail });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Merge pull request" }));
    const outcome = await screen.findByTestId("pr-party-merge-outcome");
    expect(outcome.getAttribute("data-outcome")).toBe("failed");
    expect(outcome.textContent).toContain("Branch protection refused the merge");
    fireEvent.click(screen.getByRole("button", { name: "Merge pull request" }));
    await waitFor(() => expect(screen.getByTestId("pr-party-merge-outcome").getAttribute("data-outcome")).toBe("merged"));
    expect(attempts).toBe(2);
  });
});
