import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  usePathname: () => "/projects/route-project/editor",
  useRouter: () => ({ replace: boundary.replace, push: boundary.push }),
}));

vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Turtle source boundary" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
import EditorPage from "@/app/projects/[id]/editor/page";

// The page, its hooks, API client, stores, header and providers are real.
// HTTP, socket/worker/browser APIs, Monaco, and framework session/router are
// replaced at their boundaries; application orchestration stays real.
let projectResponse: object;
let projectStatus: number;
let client: QueryClient;
const originalSource = '@prefix ex: <https://example.test/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .';
let saveStatus: number;
let savedBodies: unknown[];
let unexpected: string[];
const requests: { path: string; method: string; search: string; authorization: string | null }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ToastProvider><EditorPage /></ToastProvider></QueryClientProvider>);
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
  saveStatus = 200;
  savedBodies = [];
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
    if (path === "/api/v1/projects/route-project") return json(projectResponse, projectStatus);
    if (path.endsWith("/suggestions/capabilities")) return json({ tier: "reviewer", can_mint_entities: true, accepted_count: 0, promotion_threshold: 3 });
    if (path.endsWith("/ontology/tree")) return json({ nodes: [], total_classes: 0 });
    if (path.endsWith("/pull-requests")) return json({ items: [], total: 0 });
    if (path.endsWith("/lint/status")) return json(null);
    if (path.endsWith("/llm/status")) return json({ configured: false });
    if (path === "/api/v1/pr-party/me") return json({ is_reviewer: false });
    if (path.endsWith("/suggestions/pending")) return json({ items: [] });
    if (path.endsWith("/branches")) return json({ items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" });
    if (path.endsWith("/normalization/status")) return json({ needs_normalization: false });
    if (path.endsWith("/revisions/file")) return json({ content: originalSource, revision: "base-commit", filename: "ontology.ttl" });
    if (path.endsWith("/source")) {
      savedBodies.push(JSON.parse(String(init?.body)));
      return saveStatus === 409
        ? json({ detail: { code: "SOURCE_REVISION_CONFLICT", message: "Source changed", base_revision: "base-commit", current_revision: "other-commit", branch: "main" } }, 409)
        : json({ commit_hash: "saved-commit" });
    }
    if (path.endsWith("/remote-sync")) return json({ enabled: false });
    if (path.endsWith("/translation/config")) return json({ enabled: false, source_language: "en", language_tags: [] });
    if (path.endsWith("/translation/palette")) return json({ languages: [] });
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

describe("Editor page real access and empty-state chains", () => {
  it("renders project-not-found from the real API error without redirecting", async () => {
    projectStatus = 404;
    projectResponse = { detail: "gone" };
    mount();
    expect(await screen.findByRole("heading", { name: "Project not found" })).toBeTruthy();
    expect(boundary.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Back to projects" }).getAttribute("href")).toBe("/");
  });
  it("offers sign-in for an anonymous private-project error when OIDC is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
    projectStatus = 403;
    projectResponse = { detail: "private" };
    mount();
    expect(await screen.findByRole("heading", { name: "This is a private project. Sign in to request access." })).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Sign In" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(boundary.signIn).toHaveBeenCalledWith("zitadel", { callbackUrl: window.location.href });
  });
  it("does not advertise sign-in when no identity provider is configured", async () => {
    projectStatus = 403;
    mount();
    await screen.findByRole("heading", { name: /private project/ });
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });
  it.each([
    ["optional", "false"],
    ["disabled", "false"],
    ["disabled", "true"],
  ])("explains unavailable sign-in on a private-project denial in %s mode (provider flag %s)", async (mode, configured) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", mode);
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", configured);
    projectStatus = 403;
    projectResponse = { detail: "private" };
    mount();
    expect(await screen.findByRole("heading", { name: "This is a private project" })).toBeTruthy();
    expect(screen.queryByText(/Sign in to request access/)).toBeNull();
    expect(screen.getByText("Sign-in is unavailable in this configuration, so private projects can't be opened here.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(boundary.signIn).not.toHaveBeenCalled();
  });
  it("keeps the editor's Sign in to edit action for an anonymous public project in optional mode with a provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl", user_role: null, is_public: true };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to edit" }));
    expect(boundary.signIn).toHaveBeenCalledWith("zitadel", { callbackUrl: window.location.href });
  });
  it.each([
    ["optional", "false"],
    ["disabled", "true"],
  ])("offers no editor sign-in action for an anonymous public project in %s mode (provider flag %s)", async (mode, configured) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", mode);
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", configured);
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl", user_role: null, is_public: true };
    mount();
    expect(await screen.findByRole("heading", { name: "Route ontology" })).toBeTruthy();
    await waitFor(() => expect(requests.some((request) => request.path.endsWith("/ontology/tree"))).toBe(true));
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(boundary.signIn).not.toHaveBeenCalled();
  });
  it("distinguishes a signed-in access denial and sends the real bearer header", async () => {
    authenticate();
    projectStatus = 403;
    mount();
    expect(await screen.findByRole("heading", { name: "You don't have access to this project" })).toBeTruthy();
    expect(requests.find((request) => request.path === "/api/v1/projects/route-project")?.authorization).toBe("Bearer route-fixture-token");
    expect(boundary.replace).not.toHaveBeenCalled();
  });
  it("redirects an unauthenticated visitor to the viewer even when project data claims an owner role", async () => {
    mount();
    await waitFor(() => expect(boundary.replace).toHaveBeenCalledWith("/projects/route-project"));
    expect(screen.queryByText("No Ontology File")).toBeNull();
  });
  it("redirects an authenticated explicit viewer before exposing editing controls", async () => {
    authenticate();
    projectResponse = { ...projectResponse, user_role: "viewer" };
    mount();
    await waitFor(() => expect(boundary.replace).toHaveBeenCalledWith("/projects/route-project"));
    expect(screen.queryByRole("button", { name: "Go to Settings" })).toBeNull();
  });
  it("renders the import entry point for an authorized owner with no ontology and records editor mode", async () => {
    authenticate();
    mount();
    expect(await screen.findByRole("heading", { name: "No Ontology File" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Route ontology" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Settings" }).getAttribute("href")).toBe("/projects/route-project/settings");
    expect(screen.getByTitle("Project settings")).toBeTruthy();
    expect(useSelectionStore.getState().mode).toBe("editor");
    expect(boundary.replace).not.toHaveBeenCalled();
  });
  it("keeps required-auth loading state closed until the session resolves", async () => {
    boundary.session.status = "loading";
    mount();
    await waitFor(() => expect(client.getQueryData(["project", "route-project", false])).toEqual(projectResponse));
    expect(screen.queryByText("No Ontology File")).toBeNull();
    expect(boundary.replace).not.toHaveBeenCalled();
  });
  it("allows an anonymous public project into the proposal route when authentication is optional", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    projectResponse = { ...projectResponse, user_role: null, is_public: true };
    mount();
    expect(await screen.findByRole("heading", { name: "No Ontology File" })).toBeTruthy();
    expect(boundary.replace).not.toHaveBeenCalled();
    expect(screen.queryByTitle("Project settings")).toBeNull();
    expect(requests.find((request) => request.path === "/api/v1/projects/route-project")?.authorization).toBeNull();
  });
  it("does not block a public proposal route on unresolved session state when authentication is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "disabled");
    boundary.session.status = "loading";
    projectResponse = { ...projectResponse, user_role: null, is_public: true };
    mount();
    expect(await screen.findByRole("heading", { name: "No Ontology File" })).toBeTruthy();
    expect(boundary.replace).not.toHaveBeenCalled();
  });

  it("saves an edited ontology through the actual source editor, commit dialog and revision guard", async () => {
    authenticate();
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const input = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(originalSource));
    fireEvent.change(input, { target: { value: originalSource + "\n# reviewed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("dialog", { name: "Save Changes" });
    fireEvent.change(within(dialog).getByPlaceholderText("Describe your changes..."), { target: { value: "Review ontology source" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save & Commit" }));
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(requests.find((request) => request.path.endsWith("/source"))).toEqual(expect.objectContaining({ method: "PUT", search: "?branch=main", authorization: "Bearer route-fixture-token" }));
    expect(savedBodies[0]).toEqual(expect.objectContaining({ content: originalSource + "\n# reviewed", commit_message: "Review ontology source", base_revision: "base-commit" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save Changes" })).toBeNull());
  });

  it("preserves the edited draft on a source revision conflict and reconciles only after confirmation", async () => {
    authenticate();
    saveStatus = 409;
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const input = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(originalSource));
    const draft = originalSource + "\n# local draft";
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("dialog", { name: "Save Changes" });
    fireEvent.change(within(dialog).getByPlaceholderText("Describe your changes..."), { target: { value: "Conflicting edit" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save & Commit" }));
    expect(await screen.findByText("A newer source revision is available.")).toBeTruthy();
    expect((input as HTMLTextAreaElement).value).toBe(draft);
    expect(screen.queryByRole("dialog", { name: "Save Changes" })).toBeNull();
    expect(savedBodies).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Load latest" }));
    const confirmation = await screen.findByRole("dialog", { name: "Discard your draft and load the latest source?" });
    expect((input as HTMLTextAreaElement).value).toBe(draft);
    fireEvent.click(within(confirmation).getByRole("button", { name: "Discard draft and load latest" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement).value).toBe(originalSource));
    expect(screen.queryByText("A newer source revision is available.")).toBeNull();
    expect(savedBodies).toHaveLength(1);
  });
  it("cancels a commit without submitting or losing the editable source draft", async () => {
    authenticate();
    projectResponse = { ...projectResponse, source_file_path: "ontology.ttl" };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const input = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(originalSource));
    const draft = originalSource + "\n# not committed";
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("dialog", { name: "Save Changes" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Save cancelled")).toBeTruthy();
    expect((input as HTMLTextAreaElement).value).toBe(draft);
    expect(savedBodies).toEqual([]);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

});
