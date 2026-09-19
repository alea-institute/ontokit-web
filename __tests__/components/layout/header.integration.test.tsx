import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/header";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "header-user", name: "Ada", email: "ada@example.test" }, accessToken: "header-token" } }),
  signIn: vi.fn(), signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/pr-party", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, onClick, ...props }: ComponentProps<"a">) => <a {...props} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a> }));

let client: QueryClient;
let resolveCapabilities: (response: Response) => void;
const fetchBoundary = vi.fn<typeof fetch>();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const capabilities = new Promise<Response>(resolve => { resolveCapabilities = resolve; });
  fetchBoundary.mockReset().mockImplementation(async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/pr-party/me")) return capabilities;
    if (path.endsWith("/notifications")) return json({ items: [], total: 0, unread_count: 0 });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchBoundary);
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function mount() { render(<QueryClientProvider client={client}><Header /></QueryClientProvider>); }

describe("header with real account menu and capability queries", () => {
  it("closes the account menu on Settings while reviewer navigation loads independently", async () => {
    mount();
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings.getAttribute("href")).toBe("/settings");
    fireEvent.click(settings);
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    await act(async () => { resolveCapabilities(json({ is_reviewer: true })); });
    const review = await screen.findByRole("link", { name: "Review" });
    expect(review.getAttribute("href")).toBe("/pr-party");
    expect(review.className).toContain("bg-blue-100");
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(screen.getByRole("link", { name: "Settings" })).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    const [, init] = fetchBoundary.mock.calls.find(([url]) => String(url).includes("/pr-party/me"))!;
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer header-token");
  });

  it("keeps ordinary account controls available when reviewer capabilities fail", async () => {
    mount();
    await act(async () => { resolveCapabilities(json({ detail: "Forbidden" }, 403)); });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
    expect(screen.getByRole("link", { name: "Projects" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(screen.getByRole("link", { name: "Settings" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });
});
