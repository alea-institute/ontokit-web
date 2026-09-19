import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SuggestionReviewPage from "@/app/projects/[id]/suggestions/review/page";
import type { SuggestionSessionSummary } from "@/lib/api/suggestions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/hooks/useNotifications";

const auth = vi.hoisted(() => ({ token: "review-token" as string | undefined }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: auth.token ? { accessToken: auth.token } : null, status: "authenticated" }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "project-review" }), useSearchParams: () => new URLSearchParams() }));
// Site chrome has separate notification/auth queries unrelated to the review workflow.
vi.mock("@/components/layout/header", () => ({ Header: () => <header>Site header</header> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const suggestion = (id: string): SuggestionSessionSummary => ({ session_id: id, branch: `suggestion/${id}`, changes_count: 1, last_activity: "2026-09-18T10:00:00Z", entities_modified: ["Thing"], status: "submitted", submitter: { id, name: id }, summary: `Update ${id}`, submitter_tier: "trusted" });
let items: SuggestionSessionSummary[];
let role: string;
let projectStatus: number;
let pendingStatus: number;
let bulk: (body: { session_ids: string[]; action: string }) => Response | Promise<Response>;
let actionStatus: number;
let fetchMock: ReturnType<typeof vi.fn>;
let client: QueryClient;

function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><SuggestionReviewPage /></QueryClientProvider>);
}
async function ready() { await screen.findByRole("heading", { name: "Review Suggestions" }); }
function posted() { return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"); }
beforeEach(() => {
  auth.token = "review-token";
  items = [suggestion("Ada"), suggestion("Bea")]; role = "editor"; projectStatus = 200; pendingStatus = 200; actionStatus = 200;
  bulk = () => { items = []; return json({ succeeded: ["Ada", "Bea"], failed: [] }); };
  fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/api/v1/projects/project-review") return json(projectStatus === 200 ? { id: "project-review", name: "Review project", user_role: role } : { detail: "Missing" }, projectStatus);
    if (url.pathname.endsWith("/pending")) return json(pendingStatus === 200 ? { items } : { detail: "Queue unavailable" }, pendingStatus);
    if (url.pathname.endsWith("/bulk-review")) return bulk(JSON.parse(init?.body as string));
    if (/\/sessions\/[^/]+\/(approve|dismiss|reject|request-changes)$/.test(url.pathname)) {
      if (actionStatus !== 200) return json({ detail: "Review conflict" }, actionStatus);
      items = items.filter(item => !url.pathname.includes(`/sessions/${item.session_id}/`));
      return json({});
    }
    throw new Error(`Unexpected request ${input}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); client?.clear(); vi.unstubAllGlobals(); });

describe("Suggestion review page through real project hook, API client and review controls", () => {
  it("shares the real project query between page and home-link hook and authenticates queue requests", async () => {
    mount(); await ready();
    expect(fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === "/api/v1/projects/project-review")).toHaveLength(1);
    const [url, options] = fetchMock.mock.calls.find(([url]) => url.includes("/pending"))!;
    expect(new URL(url).search).toBe("");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer review-token");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("keeps only failed bulk items selected, shows their reason, and retries just those items", async () => {
    const notified = vi.fn(); window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, notified);
    try {
      bulk = body => {
        if (body.session_ids.length === 2) { items = [suggestion("Bea")]; return json({ succeeded: ["Ada"], failed: [{ session_id: "Bea", reason: "Merge conflict" }] }); }
        items = []; return json({ succeeded: ["Bea"], failed: [] });
      };
      mount(); await ready();
      fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Select all 2" }));
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));
      expect((await screen.findByRole("alert")).textContent).toContain("Merge conflict");
      expect((screen.getByRole("checkbox", { name: "Select suggestion from Bea" }) as HTMLInputElement).checked).toBe(true);
      expect(screen.queryByRole("checkbox", { name: "Select suggestion from Ada" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText("No pending suggestions");
      expect(posted().map(([, init]) => JSON.parse(init.body))).toEqual([{ session_ids: ["Ada", "Bea"], action: "accept" }, { session_ids: ["Bea"], action: "accept" }]);
      expect(notified).toHaveBeenCalledTimes(2);
    } finally { window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, notified); }
  });

  it("clears selection and expanded details when switching queue and sends the filter", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    expect(screen.getByRole("tabpanel")).not.toBeNull();
    items = []; fireEvent.click(screen.getByRole("button", { name: "Triage" }));
    await screen.findByText("Nothing waiting in triage");
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).searchParams.get("queue") === "triage")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Trusted" }));
    await screen.findByText("No trusted suggestions waiting");
  });

  it("caps select-all at 100 and re-enables unchecked rows after clearing", async () => {
    items = Array.from({ length: 101 }, (_, i) => suggestion(`Person${i}`)); mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Person0" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all 100" }));
    expect(screen.getByText("100 selected")).not.toBeNull();
    expect((screen.getByRole("checkbox", { name: "Select suggestion from Person100" }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect((screen.getByRole("checkbox", { name: "Select suggestion from Person100" }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
  });

  it.each(["viewer", "suggester"])("denies review controls for %s permissions", async deniedRole => {
    role = deniedRole; mount();
    await screen.findByRole("heading", { name: "Access Restricted" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(posted()).toHaveLength(0);
  });

  it("does not request an authenticated queue when signed out", async () => {
    auth.token = undefined; role = "viewer"; mount();
    await screen.findByRole("heading", { name: "Access Restricted" });
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/pending"))).toBe(false);
  });

  it("renders missing project and pending-list failures without action controls", async () => {
    projectStatus = 404; mount(); await screen.findByRole("heading", { name: "Project not found" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("exposes a queue HTTP failure instead of presenting a false empty queue", async () => {
    pendingStatus = 403; mount(); await screen.findByRole("heading", { name: /Queue unavailable/ });
    expect(screen.queryByText("No pending suggestions")).toBeNull();
  });

  it.each(["Approve", "Dismiss"])("%s removes the individual item and its bulk selection", async action => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    fireEvent.click(within(screen.getByRole("tabpanel").parentElement!).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select suggestion from Ada" })).toBeNull());
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    expect(posted()[0][0]).toContain(`/sessions/Ada/${action.toLowerCase()}`);
  });

  it.each([["Reject", "Reason for rejection", "reject", "reason"], ["Request Changes", "Feedback", "request-changes", "feedback"]])("submits %s dialog feedback through the API", async (action, label, endpoint, field) => {
    mount(); await ready(); fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    fireEvent.click(screen.getByRole("button", { name: action }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value: "  Please revise the label  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select suggestion from Ada" })).toBeNull());
    expect(posted()[0][0]).toContain(`/sessions/Ada/${endpoint}`);
    expect(JSON.parse(posted()[0][1].body)).toEqual({ [field]: "Please revise the label" });
  });

  it.each([["Reject", "Reason for rejection"], ["Request Changes", "Feedback"]])("dismisses %s with Escape without posting and clears its draft when reopened", async (action, label) => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    fireEvent.click(screen.getByRole("button", { name: action }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value: "Unsubmitted feedback" } });
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posted()).toHaveLength(0);
    expect(screen.getByRole("checkbox", { name: "Select suggestion from Ada" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: action }));
    const reopened = within(screen.getByRole("dialog"));
    expect((reopened.getByLabelText(label) as HTMLTextAreaElement).value).toBe("");
    expect((reopened.getByRole("button", { name: action }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(reopened.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posted()).toHaveLength(0);
  });

  it("reports failed bulk review without silently clearing it as successful", async () => {
    bulk = () => json({ detail: "Batch conflict" }, 409); mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await screen.findByRole("heading", { name: /Batch conflict/ });
    expect(posted()).toHaveLength(1);
    expect(items).toHaveLength(2);
  });

  it("locks selection and filters while a bulk request is pending", async () => {
    let finish!: (response: Response) => void;
    bulk = () => new Promise<Response>(resolve => { finish = resolve; });
    mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(posted()).toHaveLength(1));
    expect((screen.getByRole("button", { name: "Triage" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Select suggestion from Bea" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement).disabled).toBe(true);
    items = []; finish(json({ succeeded: ["Ada"], failed: [] }));
    await screen.findByText("No pending suggestions");
    expect((screen.getByRole("button", { name: "Triage" }) as HTMLButtonElement).disabled).toBe(false);
    expect(JSON.parse(posted()[0][1].body)).toEqual({ session_ids: ["Ada"], action: "dismiss" });
  });

  it("toggles select-all off and collapses a detail row without server mutation", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select suggestion from Ada" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all 2" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all 2" }));
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    expect(screen.getByText("No PR associated with this suggestion yet.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(posted()).toHaveLength(0);
  });

  it.each(["Approve", "Dismiss"])("shows %s failure and leaves the server queue unchanged", async action => {
    actionStatus = 409; mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: /Ada.*Update Ada/ }));
    fireEvent.click(screen.getByRole("button", { name: action }));
    await screen.findByRole("heading", { name: /Review conflict/ });
    expect(items).toHaveLength(2);
    expect(posted()).toHaveLength(1);
  });

});
