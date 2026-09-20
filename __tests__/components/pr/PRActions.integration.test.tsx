import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PRActions } from "@/components/pr/PRActions";
import type { PullRequest } from "@/lib/api/pullRequests";

const pr: PullRequest = {
  id: "pr", project_id: "project", pr_number: 7, title: "Merged ontology",
  source_branch: "feature/topic", target_branch: "main", status: "merged", author_id: "author",
  github_sync_status: "not_configured", created_at: "2026-09-01T12:00:00Z",
  review_count: 0, approval_count: 0, comment_count: 0, commits_ahead: 0, can_merge: false,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mount(list: Response, rejectDelete = false) {
  let deletes = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    if (init?.method === "GET" && url.pathname.endsWith("/branches")) return list;
    if (init?.method === "DELETE" && url.pathname.endsWith("/branches/feature%2Ftopic")) {
      if (rejectDelete && ++deletes === 1) return json({ detail: "Branch deletion denied" }, 403);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${init?.method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<PRActions projectId="project" pr={pr} accessToken="test-token" userRole="owner" onUpdate={vi.fn()} />);
  return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("merged PR actions through the real branch API and confirmation dialog", () => {
  it("deletes the listed source branch only after confirmation and preserves the editor destination", async () => {
    const fetcher = mount(json({ items: [{ name: "main" }, { name: pr.source_branch }] }));
    fireEvent.click(await screen.findByRole("button", { name: /Delete Branch/ }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Branch" }));
    await screen.findByText(/Branch .* deleted/);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Continue to Editor" }).getAttribute("href")).toBe("/projects/project/editor?branch=main");
  });

  it("keeps deletion available after a failed branch lookup and retries a rejected deletion", async () => {
    const fetcher = mount(json({ detail: "Branch listing unavailable" }, 403), true);
    fireEvent.click(await screen.findByRole("button", { name: /Delete Branch/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Branch" }));
    await screen.findByText(/Branch deletion denied/);
    expect(screen.queryByText(/Branch .* deleted/)).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Branch" }));
    await screen.findByText(/Branch .* deleted/);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(2);
  });

  it("shows an already deleted source branch without offering a destructive action", async () => {
    const fetcher = mount(json({ items: [{ name: "main" }] }));
    await screen.findByText(/Branch .* deleted/);
    expect(screen.queryByRole("button", { name: /Delete Branch/ })).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
