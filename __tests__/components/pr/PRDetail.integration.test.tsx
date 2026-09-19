import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PRDetail } from "@/components/pr/PRDetail";
import type { Comment, PullRequest } from "@/lib/api/pullRequests";

const pr: PullRequest = {
  id: "pr", project_id: "project", pr_number: 7, title: "Review ontology",
  source_branch: "feature", target_branch: "main", status: "open", author_id: "author",
  github_sync_status: "not_configured", created_at: "2026-09-01T12:00:00Z",
  review_count: 0, approval_count: 0, comment_count: 0, commits_ahead: 0, can_merge: false,
};
const comment: Comment = {
  id: "comment", pull_request_id: "pr", author_id: "author", body: "Original comment",
  created_at: pr.created_at, replies: [],
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
let current: PullRequest;
let comments: Comment[];
let handler: (path: string, init: RequestInit) => Response | Promise<Response> | undefined;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = new URL(String(input)).pathname;
  const response = handler(path, init);
  if (response) return response;
  if (path.endsWith("/reviews")) return json({ items: [], total: 0 });
  if (path.endsWith("/comments")) return json({ items: comments, total: comments.length });
  if (path.endsWith("/7")) return json(current);
  throw new Error(`Unexpected request: ${init.method} ${path}`);
});
beforeEach(() => {
  current = { ...pr }; comments = []; handler = () => undefined;
  fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const mount = () => render(<PRDetail projectId="project" prNumber={7} accessToken="test-token" currentUserId="author" />);

describe("PRDetail real API and child integration", () => {
  it("renders renamed, added and deleted files and preserves patch content across collapse and expand", async () => {
    handler = path => path.endsWith("/diff") ? json({
      files: [
        { path: "renamed.ttl", old_path: "original.ttl", change_type: "renamed", additions: 1, deletions: 1,
          patch: "--- a/original.ttl\n+++ b/renamed.ttl\n@@ -1,2 +1,2 @@\n-Old axiom\n+New axiom\n unchanged\n" },
        { path: "added.ttl", change_type: "added", additions: 1, deletions: 0, patch: "+Added axiom" },
        { path: "removed.ttl", change_type: "deleted", additions: 0, deletions: 1, patch: "-Removed axiom" },
        { path: "asset.bin", change_type: "modified", additions: 0, deletions: 0, patch: null },
      ], total_additions: 2, total_deletions: 2, files_changed: 4,
    }) : undefined;
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Files Changed" }));
    expect(await screen.findByText("renamed from original.ttl")).toBeDefined();
    for (const line of ["--- a/original.ttl", "+++ b/renamed.ttl", "@@ -1,2 +1,2 @@", "-Old axiom", "+New axiom", "unchanged", "+Added axiom", "-Removed axiom"]) {
      expect(screen.getByText(line)).toBeDefined();
    }
    fireEvent.click(screen.getByRole("button", { name: /renamed.ttl/ }));
    expect(screen.queryByText("+New axiom")).toBeNull();
    expect(screen.getByText("+Added axiom")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /renamed.ttl/ }));
    expect(screen.getByText("+New axiom")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /asset.bin/ }));
    expect(screen.getByText("asset.bin")).toBeDefined();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/diff"))).toHaveLength(1);
  });

  it("edits a real comment thread and refreshes the parent through the API", async () => {
    comments = [{ ...comment }];
    handler = (path, init) => {
      if (path.endsWith("/comments/comment") && init.method === "PATCH") {
        comments = [{ ...comment, body: JSON.parse(String(init.body)).body }];
        return json(comments[0]);
      }
    };
    mount();
    fireEvent.click(await screen.findByTitle("Edit"));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "  Revised comment  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Revised comment")).toBeDefined();
    expect(screen.queryByText("Original comment")).toBeNull();
    const request = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/comments/comment") && init?.method === "PATCH");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ body: "Revised comment" });
    expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("preserves an unsent comment after rejection and permits a successful retry", async () => {
    let attempts = 0;
    handler = (path, init) => {
      if (path.endsWith("/comments") && init.method === "POST") {
        if (++attempts === 1) return json({ detail: "Comment denied" }, 403);
        comments = [{ ...comment, body: JSON.parse(String(init.body)).body }];
        return json(comments[0]);
      }
    };
    mount();
    const input = await screen.findByPlaceholderText("Leave a comment...");
    fireEvent.change(input, { target: { value: "Retry this comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement).disabled).toBe(false));
    expect((input as HTMLTextAreaElement).value).toBe("Retry this comment");
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("Retry this comment")).toBeDefined();
    expect((input as HTMLTextAreaElement).value).toBe("");
    expect(attempts).toBe(2);
  });

  it.each(["commits", "diff"])("recovers a rejected %s tab request when revisited", async (endpoint) => {
    let attempts = 0;
    handler = (path) => {
      if (!path.endsWith(`/${endpoint}`)) return;
      if (++attempts === 1) return json({ detail: "Temporarily forbidden" }, 403);
      return endpoint === "commits"
        ? json({ items: [{ hash: "abc123", short_hash: "abc", message: "Recovered commit", author_name: "Author", author_email: "test@example.test", timestamp: pr.created_at }], total: 1 })
        : json({ files: [{ path: "ontology.ttl", change_type: "modified", additions: 1, deletions: 0, patch: "+Recovered axiom" }], total_additions: 1, total_deletions: 0, files_changed: 1 });
    };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: endpoint === "commits" ? "Commits" : "Files Changed" }));
    await screen.findByText(endpoint === "commits" ? "No commits found" : "No file changes found");
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    fireEvent.click(screen.getByRole("button", { name: endpoint === "commits" ? "Commits" : "Files Changed" }));
    expect(await screen.findByText(endpoint === "commits" ? "Recovered commit" : "+Recovered axiom")).toBeDefined();
    expect(attempts).toBe(2);
  });

  it("renders mirror retry errors and replaces them with a successful receipt", async () => {
    current.github_sync_status = "failed";
    let attempts = 0;
    handler = (path) => {
      if (path.endsWith("/github-sync/retry")) {
        return ++attempts === 1 ? json({ detail: "Integration offline" }, 403) : json({ ...pr, github_sync_status: "synced" });
      }
    };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Retry GitHub sync" }));
    expect(await screen.findByText("Integration offline")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry GitHub sync" }));
    expect(await screen.findByText("Synced with GitHub")).toBeDefined();
    expect(screen.queryByText("Integration offline")).toBeNull();
  });

  it("recovers a pending mirror with no attempt timestamp without starting background polls", async () => {
    current = { ...pr, github_sync_status: "pending", github_sync_last_attempted_at: undefined };
    handler = path => path.endsWith("/github-sync/retry")
      ? json({ ...pr, github_sync_status: "synced" }) : undefined;
    mount();
    expect(await screen.findByText(/last sync attempt did not finish/i)).toBeDefined();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/7"))).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry GitHub sync" }));
    expect(await screen.findByText("Synced with GitHub")).toBeDefined();
    const retries = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/github-sync/retry"));
    expect(retries).toHaveLength(1);
    expect(retries[0][1]?.method).toBe("POST");
    expect(new Headers(retries[0][1]?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(screen.queryByRole("button", { name: "Retry GitHub sync" })).toBeNull();
  });

  it.each([undefined, { id: "reviewer-without-name" }])("attributes a review to its ID when the reviewer profile has no name (%j)", async reviewer => {
    handler = path => path.endsWith("/reviews") ? json({ items: [{
      id: "review", pull_request_id: "pr", reviewer_id: "reviewer-without-name", reviewer,
      status: "changes_requested", body: "Please clarify the axiom", created_at: pr.created_at,
    }], total: 1 }) : undefined;
    mount();
    expect(await screen.findByText("reviewer-without-name")).toBeDefined();
    expect(screen.getByText("requested changes")).toBeDefined();
    expect(screen.getByText("Please clarify the axiom")).toBeDefined();
    expect(screen.queryByText("No reviews yet")).toBeNull();
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/reviews"));
    expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it.each(["response", "rejection"])("stops polling when an in-flight request settles after unmount (%s)", async outcome => {
    current = { ...pr, github_sync_status: "pending", github_sync_last_attempted_at: new Date().toISOString() };
    mount();
    await screen.findByText("Syncing with GitHub…");
    cleanup();
    vi.useFakeTimers();
    const view = mount();
    await act(async () => { await Promise.resolve(); });
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((done, fail) => { resolve = done; reject = fail; });
    let signal: AbortSignal | undefined;
    let polls = 0;
    handler = (path, init) => {
      if (!path.endsWith("/7")) return;
      polls++;
      signal = init.signal ?? undefined;
      return pending;
    };
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(polls).toBe(1);
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === "response") resolve(json(current));
      else reject(new DOMException("Transport cancelled", "AbortError"));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(polls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("polls past a failed status request, then stops after synchronization", async () => {
    current = { ...pr, github_sync_status: "pending", github_sync_last_attempted_at: new Date().toISOString() };
    mount();
    await screen.findByText("Syncing with GitHub…");
    vi.useFakeTimers();
    // Re-rendering with a new identity starts polling under the controlled clock.
    cleanup(); mount();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    let polls = 0;
    handler = path => path.endsWith("/7")
      ? (++polls === 1 ? json({ detail: "Unavailable" }, 503) : polls === 2 ? json(current) : json({ ...pr, github_sync_status: "synced" }))
      : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(polls).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("Syncing with GitHub…")).toBeDefined();
    expect(polls).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("Synced with GitHub")).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(polls).toBe(3);
  });
});
