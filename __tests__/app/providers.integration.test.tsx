import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { useToast } from "@/lib/context/ToastContext";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

const boundary = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("next-auth/react", async importOriginal => ({
  ...await importOriginal<typeof import("next-auth/react")>(),
  signIn: boundary.signIn,
}));
let session: object | null;
let client: QueryClient;
let fetcher: ReturnType<typeof vi.fn>;
function Consumer({ title = "Child" }: { title?: string }) {
  const queryClient = useQueryClient();
  useEffect(() => { client = queryClient; }, [queryClient]);
  const auth = useSession();
  const toast = useToast();
  const { announce } = useAnnounce();
  const query = useQuery({ queryKey: ["provider-probe"], queryFn: async () => "query value" });
  return <div>
    <h1>{title}</h1><p>{auth.status}</p><p>{query.data}</p>
    <button onClick={() => toast.addToast({ type: "success", title: "Saved ontology", duration: 0 })}>Notify</button>
    <button onClick={() => announce("Selection changed")}>Announce</button>
    <button onClick={() => announce("Save failed", "assertive")}>Alert</button>
    <button onClick={() => { void auth.update(); }}>Refresh session</button>
  </div>;
}
beforeEach(() => {
  boundary.signIn.mockClear();
  useByoKeyStore.setState({ ownerId: null, entries: {} });
  session = { user: { id: "first-user", email: "first@example.invalid" }, expires: "2099-01-01T00:00:00Z" };
  fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), window.location.href).pathname;
    if (path === "/api/auth/session") return new Response(JSON.stringify(session), { headers: { "Content-Type": "application/json" } });
    throw new Error("Unexpected provider request: " + path);
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup(); client?.clear();
  useByoKeyStore.setState({ ownerId: null, entries: {} });
  vi.unstubAllGlobals();
});

describe("application provider stack", () => {
  it("loads the real session, binds key ownership and retains a query client across rerenders", async () => {
    const view = render(<Providers><Consumer /></Providers>);
    await screen.findByText("authenticated"); await screen.findByText("query value");
    expect(useByoKeyStore.getState().ownerId).toBe("first-user");
    expect(client.getDefaultOptions().queries).toMatchObject({ staleTime: 60000, refetchOnWindowFocus: false });
    const originalClient = client;
    client.setQueryData(["retained"], "cached");
    view.rerender(<Providers><Consumer title="Rerendered child" /></Providers>);
    expect(client).toBe(originalClient); expect(client.getQueryData(["retained"])).toBe("cached");
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith("/api/auth/session"))).toBe(true);
  });

  it("delivers toast and both announcement priorities through the mounted containers", async () => {
    render(<Providers><Consumer /></Providers>); await screen.findByText("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Notify" })); await screen.findByText("Saved ontology");
    fireEvent.click(screen.getByRole("button", { name: "Announce" })); await screen.findByText("Selection changed");
    expect(screen.getByText("Selection changed").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "Alert" })); await screen.findByText("Save failed");
    expect(screen.getByText("Save failed").getAttribute("aria-live")).toBe("assertive");
  });

  it("clears a prior account's fixture key when a refreshed session changes identity", async () => {
    render(<Providers><Consumer /></Providers>); await screen.findByText("authenticated");
    act(() => useByoKeyStore.getState().setKey("project", "openai", "fixture-only-key"));
    session = { user: { id: "second-user" }, expires: "2099-01-01T00:00:00Z" };
    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await waitFor(() => expect(useByoKeyStore.getState().ownerId).toBe("second-user"));
    expect(useByoKeyStore.getState().getKey("project")).toBeNull();
  });

  it("renders anonymous children and clears keys after loading an empty session", async () => {
    session = null;
    useByoKeyStore.setState({ ownerId: "expired-user", entries: { project: { provider: "openai", key: "fixture-only-key", validatedAt: null } } });
    render(<Providers><Consumer /></Providers>);
    await screen.findByText("unauthenticated");
    expect(screen.getByRole("heading", { name: "Child" })).toBeDefined();
    expect(useByoKeyStore.getState().entries).toEqual({});
    expect(boundary.signIn).not.toHaveBeenCalled();
  });

  it("starts reauthentication with the current URL when a loaded session has a refresh error", async () => {
    session = { user: { id: "first-user" }, error: "RefreshAccessTokenError", expires: "2099-01-01T00:00:00Z" };
    render(<Providers><Consumer /></Providers>);
    await waitFor(() => expect(boundary.signIn).toHaveBeenCalledWith("zitadel", { callbackUrl: window.location.href }));
    expect(boundary.signIn).toHaveBeenCalledTimes(1);
  });
});
