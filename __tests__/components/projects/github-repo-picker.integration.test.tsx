import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubRepoPicker } from "@/components/projects/github-repo-picker";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { accessToken: "test-token" }, status: "authenticated" }) }));
const repo = { full_name: "example/ontology", owner: "example", name: "ontology", private: true, default_branch: "main", html_url: "https://github.com/example/ontology" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let request: ReturnType<typeof vi.fn>;
let route: (url: URL) => Response | undefined;
beforeEach(() => {
  route = () => undefined;
  request = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    return route(url) ?? (url.pathname.endsWith("github-token") ? json({ has_token: true }) : json({ items: [repo], total: 1 }));
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const search = (value: string) => fireEvent.change(screen.getByPlaceholderText("Search by name..."), { target: { value } });

describe("GitHub repository picker through the real settings API", () => {
  it.each([false, true])("links to settings without listing repositories when token is unavailable (HTTP failure: %s)", async (failed) => {
    route = url => url.pathname.endsWith("github-token") ? failed ? json({ detail: "Denied" }, 403) : json({ has_token: false }) : undefined;
    const select = vi.fn(); render(<GitHubRepoPicker onSelect={select} />);
    expect((await screen.findByRole("link", { name: "Go to Settings" })).getAttribute("href")).toBe("/settings");
    expect(request).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
  });

  it("recovers from an initial list failure by searching and selecting a decoded repository", async () => {
    route = url => url.pathname.endsWith("github-repos") && !url.searchParams.has("q") ? json({ detail: "Denied" }, 403) : undefined;
    const select = vi.fn(); render(<GitHubRepoPicker onSelect={select} />);
    await screen.findByText("No repositories available");
    search("ontology");
    fireEvent.click(await screen.findByRole("button", { name: /example\/ontology/ }));
    expect(select).toHaveBeenCalledExactlyOnceWith(repo);
  });

  it("shows an empty search after failure and recovers on a subsequent query", async () => {
    route = url => url.searchParams.get("q") === "denied" ? json({ detail: "Denied" }, 403) : undefined;
    const select = vi.fn(); render(<GitHubRepoPicker onSelect={select} />);
    await screen.findByText(repo.full_name);
    search("denied");
    await screen.findByText("No repositories found");
    expect(select).not.toHaveBeenCalled();
    search("ontology");
    expect(await screen.findByText(repo.full_name)).toBeDefined();
  });

  it("debounces rapid queries and omits the search parameter after clearing", async () => {
    render(<GitHubRepoPicker onSelect={vi.fn()} />);
    await screen.findByText(repo.full_name);
    search("ont"); search("ontology");
    await waitFor(() => expect(request.mock.calls.some(([url]) => new URL(url).searchParams.get("q") === "ontology")).toBe(true));
    expect(request.mock.calls.some(([url]) => new URL(url).searchParams.get("q") === "ont")).toBe(false);
    search("");
    await waitFor(() => expect(request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith("github-repos"))).toHaveLength(3));
    expect(new URL(request.mock.calls.at(-1)![0]).searchParams.has("q")).toBe(false);
  });
});
