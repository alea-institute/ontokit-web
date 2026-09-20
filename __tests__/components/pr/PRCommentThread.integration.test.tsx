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
const root: Comment = {
  id: "root", pull_request_id: "pr", author_id: "author", body: "Check this axiom",
  created_at: pr.created_at, replies: [],
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const endpoint = "/api/v1/projects/project/pull-requests/7/comments";
let comments: Comment[];
let mutation: (path: string, init: RequestInit) => Response | Promise<Response>;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = new URL(String(input)).pathname;
  if (init.method && init.method !== "GET") return mutation(path, init);
  if (path === endpoint) return json({ items: comments, total: comments.length });
  if (path.endsWith("/reviews")) return json({ items: [], total: 0 });
  if (path.endsWith("/7")) return json(pr);
  throw new Error(`Unexpected request: ${init.method} ${path}`);
});
const mutations = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
const commentReads = () => fetchMock.mock.calls.filter(([url, init]) => new URL(String(url)).pathname === endpoint && init?.method === "GET");
const replySubmit = () => screen.getAllByRole("button", { name: "Reply" }).at(-1)!;
async function mount(currentUserId: string | undefined = "author") {
  render(<PRDetail projectId="project" prNumber={7} accessToken="test-token" currentUserId={currentUserId} />);
  await screen.findByText(root.body);
}
beforeEach(() => {
  comments = [{ ...root, replies: [] }];
  mutation = (path, init) => { throw new Error(`Unexpected mutation: ${init.method} ${path}`); };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PRCommentThread through its real parent and API client", () => {
  it("retries a rejected reply with its draft intact, then reloads the nested response", async () => {
    let attempts = 0;
    mutation = (path, init) => {
      expect(path).toBe(endpoint);
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({ body: "Please add a label", parent_id: "root" });
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
      if (++attempts === 1) return json({ detail: "Try again" }, 503);
      const reply = { ...root, id: "reply", body: "Please add a label", parent_id: "root" };
      comments = [{ ...root, replies: [reply] }];
      return json(reply, 201);
    };
    await mount();
    fireEvent.click(replySubmit());
    fireEvent.change(screen.getByPlaceholderText("Write a reply..."), { target: { value: "  Please add a label  " } });
    fireEvent.click(replySubmit());
    await waitFor(() => expect((replySubmit() as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByPlaceholderText("Write a reply...") as HTMLTextAreaElement).value).toBe("  Please add a label  ");
    expect(commentReads()).toHaveLength(1);
    expect(attempts).toBe(1);
    expect(screen.getByRole("alert").textContent).toContain("Try again");
    fireEvent.click(replySubmit());
    expect(await screen.findByText("Please add a label")).toBeDefined();
    expect(screen.queryByPlaceholderText("Write a reply...")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
    expect(commentReads()).toHaveLength(2);
    expect(attempts).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a failed nested edit open and refreshes its edited timestamp after retry", async () => {
    const reply = { ...root, id: "reply", body: "Original reply", parent_id: "root" };
    comments = [{ ...root, author_id: "someone-else", replies: [reply] }];
    let attempts = 0;
    mutation = (path, init) => {
      expect(path).toBe(`${endpoint}/reply`);
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(String(init.body))).toEqual({ body: "Corrected reply" });
      if (++attempts === 1) return json({ detail: "Forbidden temporarily" }, 403);
      const updated = { ...reply, body: "Corrected reply", updated_at: "2026-09-02T12:00:00Z" };
      comments = [{ ...comments[0], replies: [updated] }];
      return json(updated);
    };
    await mount();
    expect(screen.getAllByTitle("Edit")).toHaveLength(1);
    fireEvent.click(screen.getByTitle("Edit"));
    fireEvent.change(screen.getByDisplayValue(reply.body), { target: { value: "  Corrected reply  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByDisplayValue("Corrected reply") as HTMLTextAreaElement).value).toBe("  Corrected reply  ");
    expect(commentReads()).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toContain("Forbidden temporarily");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Corrected reply")).toBeDefined();
    expect(screen.getByText("(edited)")).toBeDefined();
    expect(screen.queryByText(reply.body)).toBeNull();
    expect(attempts).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(commentReads()).toHaveLength(2);
  });

  it("retries a rejected delete and reloads the empty thread after a 204 response", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let attempts = 0;
    mutation = (path, init) => {
      expect(path).toBe(`${endpoint}/root`);
      expect(init.method).toBe("DELETE");
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
      if (++attempts === 1) return json({ detail: "Delete denied" }, 403);
      comments = [];
      return new Response(null, { status: 204 });
    };
    const errors = vi.spyOn(console, "error"); // Keep the real stderr output.
    await mount();
    fireEvent.click(screen.getByTitle("Delete"));
    await waitFor(() => expect(errors).toHaveBeenCalledWith("Failed to delete:", expect.any(Error)));
    expect(screen.getByText(root.body)).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Delete denied");
    expect(commentReads()).toHaveLength(1);
    fireEvent.click(screen.getByTitle("Delete"));
    expect(await screen.findByText("No comments yet. Be the first to comment!")).toBeDefined();
    expect(screen.queryByText(root.body)).toBeNull();
    expect(commentReads()).toHaveLength(2);
    expect(attempts).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not send blank edits or replies and discards canceled drafts", async () => {
    await mount();
    fireEvent.click(screen.getByTitle("Edit"));
    fireEvent.change(screen.getByDisplayValue(root.body), { target: { value: " \n\t " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutations()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByTitle("Edit"));
    expect(screen.getByDisplayValue(root.body)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(replySubmit());
    fireEvent.change(screen.getByPlaceholderText("Write a reply..."), { target: { value: " \n\t " } });
    fireEvent.click(replySubmit());
    expect(mutations()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(replySubmit());
    expect((screen.getByPlaceholderText("Write a reply...") as HTMLTextAreaElement).value).toBe("");
    expect(commentReads()).toHaveLength(1);
  });

  it("keeps the thread untouched when deletion confirmation is declined", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount();
    fireEvent.click(screen.getByTitle("Delete"));
    expect(confirm).toHaveBeenCalledWith("Are you sure you want to delete this comment?");
    expect(mutations()).toHaveLength(0);
    expect(commentReads()).toHaveLength(1);
    expect(screen.getByText(root.body)).toBeDefined();
  });

  it("hides ownership actions for an anonymous viewer, including nested replies", async () => {
    comments = [{ ...root, replies: [{ ...root, id: "reply", body: "Nested reply" }] }];
    render(<PRDetail projectId="project" prNumber={7} accessToken="test-token" />);
    expect(await screen.findByText("Nested reply")).toBeDefined();
    expect(screen.queryByTitle("Edit")).toBeNull();
    expect(screen.queryByTitle("Delete")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
    expect(mutations()).toHaveLength(0);
  });

  it("disables reply submission while the real API request is pending", async () => {
    let resolve!: (response: Response) => void;
    mutation = () => new Promise<Response>(done => { resolve = done; });
    await mount();
    fireEvent.click(replySubmit());
    fireEvent.change(screen.getByPlaceholderText("Write a reply..."), { target: { value: "Pending reply" } });
    fireEvent.click(replySubmit());
    expect((replySubmit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(replySubmit());
    expect(mutations()).toHaveLength(1);
    const reply = { ...root, id: "reply", body: "Pending reply", parent_id: "root" };
    comments = [{ ...root, replies: [reply] }];
    await act(async () => resolve(json(reply)));
    expect(await screen.findByText("Pending reply")).toBeDefined();
    expect(screen.queryByPlaceholderText("Write a reply...")).toBeNull();
    expect(commentReads()).toHaveLength(2);
  });
});
