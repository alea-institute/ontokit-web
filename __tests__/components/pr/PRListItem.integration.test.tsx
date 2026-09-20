import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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

  it("loads both pages, returns to the first page and resets pagination when filtering", async () => {
    const requests: { skip: string | null; status: string | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
      const params = new URL(input).searchParams;
      expect(params.get("limit")).toBe("20");
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
      const skip = Number(params.get("skip"));
      const status = params.get("status");
      requests.push({ skip: params.get("skip"), status });
      const items = status === "closed" ? [] : Array.from({ length: skip === 0 ? 20 : 1 }, (_, i) => ({
        ...makePR(1), id: `pr-${skip + i}`, pr_number: skip + i + 1,
        title: `Change ${skip + i + 1}`, github_pr_url: undefined,
      }));
      return new Response(JSON.stringify({ items, total: status === "closed" ? 0 : 21, skip, limit: 20 }), { status: 200 });
    }));
    render(<PRList projectId="project" accessToken="test-token" />);
    await screen.findByText("Change 1");
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 21");
    expect(screen.getByText("21-21 of 21")).toBeDefined();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Change 1");
    expect(screen.queryByText("Change 21")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 21");
    fireEvent.click(screen.getByRole("button", { name: "Closed" }));
    await screen.findByText("No pull requests have been closed.");
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    await waitFor(() => expect(requests).toEqual([
      { skip: "0", status: "open" }, { skip: "20", status: "open" },
      { skip: "0", status: "open" }, { skip: "20", status: "open" },
      { skip: "0", status: "closed" },
    ]));
  });

  it("keeps an external GitHub click independent of the internal navigation link", async () => {
    serve(1);
    render(<PRList projectId="project" accessToken="test-token" />);
    const link = await screen.findByRole("link", { name: "View on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/example/ontology/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    const internal = screen.getByRole("link", { name: /Add Person/ });
    const internalClick = vi.fn();
    internal.addEventListener("click", internalClick);
    expect(internal.contains(link)).toBe(false);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    event.preventDefault(); // Keep actual browser navigation outside the local test.
    fireEvent(link, event);
    expect(internalClick).not.toHaveBeenCalled();
  });
});

it.each([undefined, 'https://github.com/fixture/ontology/pull/42'])('renders independently focusable valid links from the real list response (%s)', async github_pr_url => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [{ ...makePR(0), github_pr_url }], total: 1, skip: 0, limit: 20 }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const { container } = render(<PRList projectId="project" accessToken="fixture-token" />);
  await screen.findByText("Add Person");
  expect(container.querySelector('a a')).toBeNull();
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(github_pr_url ? 2 : 1);
  const internal = links.find(link => link.getAttribute('href') === '/projects/project/pull-requests/42')!;
  expect(internal).toBeDefined();
  internal.focus(); expect(document.activeElement).toBe(internal);
  if (github_pr_url) {
    const external = screen.getByRole('link', { name: 'View on GitHub' });
    expect(external.getAttribute('href')).toBe(github_pr_url);
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    await userEvent.tab(); expect(document.activeElement).toBe(external);
  }
});
