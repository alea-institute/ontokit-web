import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useSelectionStore } from "@/lib/stores/selectionStore";

const boundary = vi.hoisted(() => ({
  session: { data: null as null | { accessToken: string; user: { email: string } }, status: "unauthenticated" },
  replace: vi.fn(), push: vi.fn(), signIn: vi.fn(),
  search: new URLSearchParams(),
}));
vi.mock("next-auth/react", () => ({ useSession: () => boundary.session, signIn: boundary.signIn, signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "route-project" }),
  useSearchParams: () => boundary.search,
  usePathname: () => "/projects/route-project",
  useRouter: () => ({ replace: boundary.replace, push: boundary.push }),
}));

vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: ({ value, options }: { value: string; options: { readOnly: boolean } }) => (
    <textarea aria-label="Turtle source boundary" value={value} readOnly={options.readOnly} />
  ),
}));
import ViewerPage from "@/app/projects/[id]/page";

// The page, its hooks, API client, stores, header and providers are real.
// HTTP, socket/worker/browser APIs, Monaco, and framework session/router are
// replaced at their boundaries; application orchestration stays real.
let projectResponse: object;
let projectStatus: number;
let client: QueryClient;
const originalSource = '@prefix ex: <https://example.test/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .';
let sourceStatus: number;
let sourceContent: string;
let sourceGate: Promise<void> | undefined;
let treeStatus: number;

let unexpected: string[];
const requests: { path: string; method: string; search: string; authorization: string | null }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ViewerPage /></ToastProvider></QueryClientProvider>);
}
function authenticate() {
  boundary.session = { data: { accessToken: "route-fixture-token", user: { email: "reader@example.test" } }, status: "authenticated" };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSelectionStore.getState().clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "required");
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  boundary.session = { data: null, status: "unauthenticated" };
  projectResponse = { id: "route-project", name: "Route ontology", source_file_path: null, user_role: "owner", is_public: false };
  projectStatus = 200;
  sourceStatus = 200;
  sourceContent = originalSource;
  sourceGate = undefined;
  treeStatus = 200;
  boundary.search = new URLSearchParams();
  useEditorModeStore.getState().setEditorMode("developer");
  unexpected = [];
  requests.length = 0;
  // No socket opens against a live service. The production hook still creates
  // and closes its connection when authenticated session state enables it.
  vi.stubGlobal("WebSocket", class { close() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("Worker", class { postMessage() {} terminate() {} });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    requests.push({ path, method: init?.method ?? "GET", search: new URL(String(input)).search, authorization: new Headers(init?.headers).get("Authorization") });
    if (path === "/api/v1/projects") return json({ items: [], total: 0 });
    if (path.endsWith("/references")) return json({ target_iri: "https://example.test/Person", total: 0, groups: [] });
    if (path.endsWith("/history")) return json({ entity_iri: "https://example.test/Person", total: 0, events: [] });
    if (path.endsWith("/similar")) return json([]);
    if (path.endsWith("/ancestors")) return json({ nodes: [] });
    if (path === "/api/v1/projects/route-project") return json(projectResponse, projectStatus);
    if (path.endsWith("/suggestions/capabilities")) return json({ tier: "reviewer", can_mint_entities: true, accepted_count: 0, promotion_threshold: 3 });
    if (path.endsWith("/ontology/tree")) return treeStatus === 200 ? json({ nodes: [{ iri: "https://example.test/Person", label: "Person", has_children: false, children_count: 0 }], total_classes: 1 }) : json({ detail: "Tree unavailable" }, treeStatus);
    if (path.includes("/ontology/classes/")) return json({ iri: "https://example.test/Person", labels: [{ value: "Person", lang: "en" }], comments: [{ value: "A human being", lang: "en" }], parent_iris: [], parent_labels: {}, annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true });
    if (path.endsWith("/pull-requests")) return json({ items: [], total: 0 });
    if (path.endsWith("/lint/status")) return json(null);
    if (path.endsWith("/llm/status")) return json({ configured: false });
    if (path === "/api/v1/pr-party/me") return json({ is_reviewer: false });
    if (path.endsWith("/suggestions/pending")) return json({ items: [] });
    if (path.endsWith("/branches")) return json({ items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" });
    if (path.endsWith("/normalization/status")) return json({ needs_normalization: false });
    if (path.endsWith("/revisions/file")) {
      await sourceGate;
      return sourceStatus === 200 ? json({ content: sourceContent, revision: "base-commit", filename: "ontology.ttl" }) : new Response("Source unavailable", { status: sourceStatus });
    }
    if (path.endsWith("/remote-sync")) return json({ enabled: false });
    if (path.endsWith("/translation/config")) return json({ enabled: false, source_language: "en", language_tags: [] });
    if (path.endsWith("/translation/palette")) return json([]);
    if (path.endsWith("/translation/entity-state")) return json({ items: [] });
    if (path.endsWith("/lint/issues")) return json({ items: [], total: 0 });
    unexpected.push(path);
    return json({ detail: "Unexpected test request" }, 404);
  }));
});
afterEach(() => {
  cleanup();
  useSelectionStore.getState().clear();
  useEditorModeStore.getState().setEditorMode("standard");
  client?.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unexpected).toEqual([]);
});

describe("Project viewer route through real providers and API", () => {
  it("shows a private project sign-in action after an anonymous 403", async () => {
    projectStatus = 403;
    mount();
    await screen.findByRole("heading", { name: "This is a private project. Sign in to request access." });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(boundary.signIn).toHaveBeenCalledWith("zitadel");
  });
  it("shows authenticated denial without the private-project sign-in action", async () => {
    authenticate(); projectStatus = 403; mount();
    await screen.findByRole("heading", { name: "You don't have access to this project" });
    expect(screen.queryByRole("button", { name: "Sign In" })).toBeNull();
    expect(requests[0].authorization).toBe("Bearer route-fixture-token");
  });
  it("renders a not-found return path for a missing project", async () => {
    projectStatus = 404; mount();
    await screen.findByRole("heading", { name: "Project not found" });
    expect(screen.getByRole("link", { name: "Back to projects" }).getAttribute("href")).toBe("/");
  });
  it("offers the settings import path only to an authenticated owner of an empty project", async () => {
    authenticate(); mount();
    await screen.findByRole("heading", { name: "No Ontology File" });
    expect(screen.getByRole("link", { name: "Go to Settings" }).getAttribute("href")).toBe("/projects/route-project/settings");
    expect(screen.getByTitle("Project settings")).toBeTruthy();
  });
  it("keeps the anonymous empty-project view free of management controls", async () => {
    projectResponse = { ...projectResponse, is_public: true, user_role: null }; mount();
    await screen.findByRole("heading", { name: "No Ontology File" });
    expect(screen.queryByTitle("Project settings")).toBeNull();
    expect(screen.queryByRole("link", { name: "Go to Settings" })).toBeNull();
  });
  it("waits for required session resolution even after project data arrives", async () => {
    boundary.session.status = "loading"; mount();
    await waitFor(() => expect(client.getQueryData(["project", "route-project", false])).toEqual(projectResponse));
    expect(screen.queryByText("No Ontology File")).toBeNull();
  });
  it("allows disabled-auth loading sessions to read a public project", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "disabled"); boundary.session.status = "loading";
    projectResponse = { ...projectResponse, is_public: true, user_role: null }; mount();
    await screen.findByRole("heading", { name: "No Ontology File" });
    expect(requests[0].authorization).toBeNull();
  });
  it("loads the default branch source into a read-only real editor for an owner", async () => {
    authenticate(); projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" }; mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const input = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(originalSource));
    expect((input as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(requests.find(r => r.path.endsWith("/revisions/file"))?.search).toContain("version=main");
    expect(useSelectionStore.getState().mode).toBe("viewer");
  });
  it("keeps a pending source request in its loading state until the transport resolves", async () => {
    let release!: () => void;
    sourceGate = new Promise<void>(resolve => { release = resolve; });
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" }; mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    await screen.findByText("Loading source...");
    expect(screen.queryByRole("textbox", { name: "Turtle source boundary" })).toBeNull();
    await act(async () => release());
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement).value).toBe(originalSource));
  });
  it("recovers an explicit source read failure through the real retry action", async () => {
    sourceStatus = 403; projectResponse = { ...projectResponse, source_file_path: "ontology.ttl", user_role: null, is_public: true }; mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    await screen.findByRole("heading", { name: "Failed to load source" });
    expect(screen.getByText("Source unavailable")).toBeTruthy();
    sourceStatus = 200; fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement).value).toBe(originalSource));
    expect(requests.filter(r => r.path.endsWith("/revisions/file"))).toHaveLength(2);
  });
  it("selects a visible class and renders its read-only detail through the real tree and API", async () => {
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl", user_role: null, is_public: true }; mount();
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/ontology/tree") && r.search.includes("branch=main"))).toBe(true));
    fireEvent.click(await screen.findByText("Person"));
    await screen.findByText("A human being");
    expect(requests.some(r => r.path.includes("/ontology/classes/") && r.search.includes("branch=main"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(useSelectionStore.getState().mode).toBe("viewer");
  });
  it("surfaces a failed tree request without losing project navigation", async () => {
    treeStatus = 403; projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" }; mount();
    await screen.findByText(/Tree unavailable/);
    expect(screen.getByTitle("Project dashboard")).toBeTruthy();
  });
});
