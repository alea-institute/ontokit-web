import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRList } from "@/components/pr/PRList";
import type { PullRequest } from "@/lib/api/pullRequests";

const now = new Date("2026-09-19T12:00:00Z");
const makePR = (days: number): PullRequest => ({ id: "pr-1", project_id: "project", pr_number: 42, title: "Add Person", source_branch: "feature", target_branch: "main", status: "open", author_id: "author", author: { id: "author", name: "Alice" }, github_sync_status: "synced", github_pr_url: "https://github.com/example/ontology/pull/42", created_at: new Date(now.getTime() - days * 86_400_000).toISOString(), review_count: 0, approval_count: 0, comment_count: 0, commits_ahead: 1, can_merge: true });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function serve(days: number) {
  const request = vi.fn(async (input: string, init: RequestInit) => {
    expect(new URL(input).searchParams.get("status")).toBe("open");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    return new Response(JSON.stringify({ items: [makePR(days)], total: 1, skip: 0, limit: 20 }), { status: 200 });
  });
  vi.stubGlobal("fetch", request);
  return request;
}

describe("pull request rows rendered by their real list and API", () => {
  it.each([{ days: 1, label: "yesterday" }, { days: 2, label: "2 days ago" }, { days: 6, label: "6 days ago" }])("renders a $days day old API result as $label", async ({ days, label }) => {
    const request = serve(days);
    render(<PRList projectId="project" accessToken="test-token" />);
    expect(await screen.findByText(`opened ${label}`)).toBeDefined();
    expect(screen.getByRole("link", { name: /Add Person/ }).getAttribute("href")).toBe("/projects/project/pull-requests/42");
    expect(request).toHaveBeenCalledOnce();
  });

  it("keeps an external GitHub click from bubbling into surrounding row navigation", async () => {
    serve(1);
    const outerClick = vi.fn();
    render(<div onClick={outerClick}><PRList projectId="project" accessToken="test-token" /></div>);
    const link = await screen.findByRole("link", { name: "View on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/example/ontology/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    event.preventDefault(); // Keep actual browser navigation outside the local test.
    fireEvent(link, event);
    expect(outerClick).not.toHaveBeenCalled();
  });
});
