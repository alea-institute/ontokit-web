import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BranchProvider, useBranch } from "@/lib/context/BranchContext";
import { BranchSelector } from "@/components/revision/BranchSelector";
import type { BranchInfo, BranchListResponse } from "@/lib/api/revisions";

const branch = (name: string, extra: Partial<BranchInfo> = {}): BranchInfo => ({
  name, is_current: name === "main", is_default: name === "main",
  commits_ahead: 0, commits_behind: 0, remote_commits_ahead: null,
  remote_commits_behind: null, can_delete: name !== "main", has_open_pr: false,
  has_delete_permission: name !== "main", ...extra,
});
let items: BranchInfo[];
let mutationFailure: string | null;
let listFailure: boolean;
let responseOverrides: Partial<BranchListResponse>;
const requests: { url: URL; method: string; body?: BodyInit | null; headers: Headers }[] = [];
const clients: QueryClient[] = [];
function PendingChanges() {
  const { setPendingChanges } = useBranch();
  return <button onClick={() => setPendingChanges(true)}>Edit ontology</button>;
}
function mount(token: string | null = "fixture-token") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const callback = vi.fn();
  const view = render(<QueryClientProvider client={client}><BranchProvider projectId="selector-fixture" accessToken={token ?? undefined}>
    <BranchSelector canCreateBranch onBranchChange={callback} /><PendingChanges />
  </BranchProvider></QueryClientProvider>);
  return { ...view, callback };
}
async function open() {
  const trigger = screen.getByRole("button", { name: /^main/ });
  await waitFor(() => expect(trigger.hasAttribute("disabled")).toBe(false));
  fireEvent.click(trigger);
}
function create(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Create new branch" }));
  const input = screen.getByPlaceholderText("feature/my-changes");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
}
beforeEach(() => {
  sessionStorage.clear(); requests.length = 0; mutationFailure = null; listFailure = false; responseOverrides = {};
  items = [branch("main"), branch("feature/topic")];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input); const method = init.method ?? "GET";
    requests.push({ url, method, body: init.body, headers: new Headers(init.headers) });
    if (method === "GET" && listFailure) return new Response(JSON.stringify({ detail: "Branch list unavailable" }), { status: 403 });
    if (method === "GET") return new Response(JSON.stringify({ items, current_branch: "main", default_branch: "main", preferred_branch: null, has_github_remote: false, last_sync_at: null, sync_status: null, ...responseOverrides }));
    if (mutationFailure) return new Response(mutationFailure, { status: 409 });
    if (method === "POST") {
      const created = branch((JSON.parse(String(init.body)) as { name: string }).name);
      items = [...items, created]; return new Response(JSON.stringify(created));
    }
    if (method === "DELETE") items = items.filter(item => !url.pathname.endsWith(encodeURIComponent(item.name)));
    return new Response(null, { status: 204 });
  }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("BranchSelector real context and API integration", () => {
  it("shows branch-list errors and retries the real request", async () => {
    listFailure = true;
    mount();
    await screen.findByRole("alert");
    expect(screen.getByText("Branch list unavailable")).toBeDefined();
    listFailure = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry branches" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await open();
    expect(screen.getByRole("option", { name: "feature/topic" })).toBeDefined();
    expect(requests.filter(request => request.method === "GET")).toHaveLength(2);
  });

  it("creates a trimmed branch, refreshes the server list and persists the selected branch", async () => {
    const { callback } = mount(); await open(); create("  feature/new  ");
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    expect(screen.getByRole("button", { name: "feature/new" })).toBeDefined();
    expect(callback).toHaveBeenCalledWith("feature/new");
    expect(sessionStorage.getItem("ontokit:branch:selector-fixture")).toBe("feature/new");
    const post = requests.find(request => request.method === "POST")!;
    expect(JSON.parse(String(post.body))).toEqual({ name: "feature/new" });
    expect(post.headers.get("Authorization")).toBe("Bearer fixture-token");
    expect(requests.filter(request => request.method === "GET")).toHaveLength(2);
    expect(requests.find(request => request.method === "PUT")?.url.searchParams.get("branch")).toBe("feature/new");
  });
  it("keeps a rejected create open and clears the error after a successful retry", async () => {
    mutationFailure = "Branch already exists"; mount(); await open(); create("feature/new");
    expect(await screen.findByText("Branch already exists")).toBeDefined();
    expect(screen.getByPlaceholderText("feature/my-changes").getAttribute("value")).toBe("feature/new");
    mutationFailure = null; fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "feature/new" }));
    expect(screen.queryByText("Branch already exists")).toBeNull();
  });
  it("deletes a confirmed inactive branch through the API without switching branches", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { callback } = mount(); await open(); fireEvent.click(screen.getByTitle("Delete branch"));
    await waitFor(() => expect(screen.queryByRole("option", { name: "feature/topic" })).toBeNull());
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete branch "feature/topic"?');
    const deletion = requests.find(request => request.method === "DELETE")!;
    expect(deletion.url.pathname).toContain("feature%2Ftopic");
    expect(deletion.url.searchParams.get("force")).toBe("false");
    expect(callback.mock.calls).toEqual([["main"]]);
    expect(screen.getByRole("option", { name: /main/ }).getAttribute("aria-selected")).toBe("true");
  });
  it("cancels deletion without a mutation or selection change", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false); mount(); await open();
    fireEvent.click(screen.getByTitle("Delete branch"));
    expect(screen.getByRole("option", { name: "feature/topic" })).toBeDefined();
    expect(requests.every(request => request.method === "GET")).toBe(true);
  });
  it("shows delete failures and preserves the branch for retry", async () => {
    mutationFailure = "Branch has unmerged changes"; vi.spyOn(window, "confirm").mockReturnValue(true);
    mount(); await open(); fireEvent.click(screen.getByTitle("Delete branch"));
    expect(await screen.findByText("Branch has unmerged changes")).toBeDefined();
    expect(screen.getByRole("option", { name: "feature/topic" })).toBeDefined();
  });
  it.each(["Enter", " "])("switches by %s and persists preference through the real client", async key => {
    mount(); await open(); fireEvent.keyDown(screen.getByRole("option", { name: "feature/topic" }), { key });
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    expect(sessionStorage.getItem("ontokit:branch:selector-fixture")).toBe("feature/topic");
    expect(requests.find(request => request.method === "PUT")?.url.searchParams.get("branch")).toBe("feature/topic");
  });
  it("rejects switching while ontology changes are pending", async () => {
    mount(); await open(); fireEvent.click(screen.getByRole("button", { name: "Edit ontology" }));
    fireEvent.click(screen.getByRole("option", { name: "feature/topic" }));
    expect(await screen.findByText(/You have pending changes/)).toBeDefined();
    expect(requests.some(request => request.method === "PUT")).toBe(false);
  });
  it("rejects unauthenticated branch creation through provider validation", async () => {
    mount(null); await open(); create("feature/no-auth");
    expect(await screen.findByText("Authentication required")).toBeDefined();
    expect(requests.some(request => request.method === "POST")).toBe(false);
  });
  it.each([[2, 3, "↑2 ↓3"], [2, null, "↑2"], [null, 3, "↓3"]] as const)("renders remote divergence %s/%s in both trigger and option", async (ahead, behind, label) => {
    items[0] = branch("main", { remote_commits_ahead: ahead, remote_commits_behind: behind, commits_behind: 4 });
    responseOverrides = { has_github_remote: true }; mount(); await open();
    expect(screen.getAllByTitle("Ahead/behind remote").map(node => node.textContent)).toEqual([label, label]);
    expect(screen.getByText("-4")).toBeDefined();
  });
  it("disables deletion of a branch with an open pull request", async () => {
    items[1] = branch("feature/topic", { can_delete: false, has_open_pr: true }); mount(); await open();
    expect(screen.getByTitle("Cannot delete: branch has an open pull request").hasAttribute("disabled")).toBe(true);
  });
  it("dismisses the menu on the backdrop and ignores unrelated option keys", async () => {
    const { container } = mount(); await open();
    fireEvent.keyDown(screen.getByRole("option", { name: "feature/topic" }), { key: "ArrowDown" });
    expect(requests.some(request => request.method === "PUT")).toBe(false);
    fireEvent.click(container.querySelector(".fixed.inset-0")!);
    expect(screen.queryByRole("option")).toBeNull();
  });
  it.each(["create", "delete"] as const)("shows a safe fallback for non-Error %s transport rejection", async action => {
    mount(); await open();
    vi.mocked(fetch).mockRejectedValueOnce("transport unavailable");
    if (action === "create") create("feature/offline");
    else {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      fireEvent.click(screen.getByTitle("Delete branch"));
    }
    expect(await screen.findByText(`Failed to ${action} branch`)).toBeDefined();
    expect(screen.getByRole("option", { name: "feature/topic" })).toBeDefined();
  });
  it("shows the empty server state and ignores a whitespace-only create", async () => {
    items = []; mount(); await open();
    expect(screen.getByText("No branches found")).toBeDefined();
    create("   ");
    expect(requests.some(request => request.method === "POST")).toBe(false);
    expect(screen.getByPlaceholderText("feature/my-changes")).toBeDefined();
  });
  it("hides remote divergence badges when the server reports branches in sync", async () => {
    items[0] = branch("main", { remote_commits_ahead: 0, remote_commits_behind: 0 });
    responseOverrides = { has_github_remote: true }; mount(); await open();
    expect(screen.queryByTitle("Ahead/behind remote")).toBeNull();
    expect(screen.getByText("GitHub connected")).toBeDefined();
  });

});
