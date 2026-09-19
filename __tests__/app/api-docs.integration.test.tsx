import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";

const scalar = vi.hoisted(() => ({ configuration: {} as { url: string; servers: { url: string }[]; hideDarkModeToggle: boolean } }));
vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: ({ configuration }: { configuration: typeof scalar.configuration }) => {
    scalar.configuration = configuration;
    return <div aria-label="API reference boundary" />;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/api-docs" }));
import ApiDocsPage from "@/app/api-docs/page";

let client: QueryClient;
let rootClass: string;
let bodyClass: string;
const originalMode = useEditorModeStore.getState();
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  rootClass = document.documentElement.className;
  bodyClass = document.body.className;
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Documentation should not fetch through the Scalar boundary"); }));
});
afterEach(() => {
  cleanup(); client?.clear();
  useEditorModeStore.setState(originalMode);
  document.documentElement.className = rootClass; document.body.className = bodyClass;
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SessionProvider session={null} refetchOnWindowFocus={false}><QueryClientProvider client={client}><ToastProvider><ApiDocsPage /></ToastProvider></QueryClientProvider></SessionProvider>);
}
describe("API documentation and application theme integration", () => {
  it("connects the reference boundary to the configured backend and exposes application navigation", () => {
    mount();
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    expect(scalar.configuration).toMatchObject({ url: base + "/openapi.json", servers: [{ url: base }], hideDarkModeToggle: true });
    expect(screen.getByRole("link", { name: "Documentation" }).getAttribute("href")).toBe("/docs");
    expect(screen.getByLabelText("API reference boundary")).toBeDefined();
  });

  it("synchronizes Scalar classes through real header theme controls and removes the opposite theme", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.body.classList.contains("dark-mode")).toBe(true));
    expect(document.body.classList.contains("light-mode")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    await waitFor(() => expect(document.body.classList.contains("light-mode")).toBe(true));
    expect(document.body.classList.contains("dark-mode")).toBe(false);
  });

  it("reads an existing dark theme and disconnects observation after unmount", async () => {
    document.documentElement.classList.add("dark");
    const view = mount();
    expect(document.body.classList.contains("dark-mode")).toBe(true);
    view.unmount();
    document.documentElement.classList.remove("dark");
    // Let the actual MutationObserver delivery checkpoint run.
    await Promise.resolve();
    expect(document.body.classList.contains("dark-mode")).toBe(true);
  });
});
