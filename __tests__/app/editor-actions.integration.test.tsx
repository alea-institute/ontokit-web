import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useDraftStore } from "@/lib/stores/draftStore";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
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
const iri = "https://example.test/Person";
const initialEditorMode = useEditorModeStore.getState();
let projectResponse: object;
let deleted: boolean;
let deleteFailure: boolean;
let projectStatus: number;
let client: QueryClient;
const originalSource = '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n@prefix ex: <https://example.test/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .';
let saveStatus: number;
let sourceStatus: number;
let savedBodies: unknown[];
let unexpected: string[];
const requests: { path: string; method: string; search: string; authorization: string | null }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><TooltipProvider><ToastProvider><EditorPage /><ToastContainer /></ToastProvider></TooltipProvider></QueryClientProvider>);
}
function authenticate() {
  boundary.session = { data: { accessToken: "route-fixture-token", user: { email: "reader@example.test" } }, status: "authenticated" };
}

beforeEach(() => {
  vi.clearAllMocks();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ showManualSaveButton: true });
  useSelectionStore.getState().clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "required");
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  authenticate();
  projectResponse = { id: "route-project", name: "Route ontology", source_file_path: "ontology.ttl", user_role: "owner", is_public: false };
  projectStatus = 200; deleted = false; deleteFailure = false;
  saveStatus = 200; sourceStatus = 200;
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
    if (path.endsWith("/ontology/tree")) return json({ nodes: deleted ? [] : [{ iri, label: "Person", child_count: 0 }], total_classes: deleted ? 0 : 1 });
    if (path.endsWith('/ontology/classes/' + encodeURIComponent(iri))) {
      if (init?.method === 'DELETE') { if (deleteFailure) return json({ detail: 'Delete refused' }, 403); deleted = true; return new Response(null, { status: 204 }); }
      return json({ iri, labels: [{ value: 'Person', lang: 'en' }], comments: [], parent_iris: [], parent_labels: {}, annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true });
    }
    if (path.endsWith("/ontology/classes/" + encodeURIComponent("https://example.test/NewEntity"))) return json({ detail: "Not persisted yet" }, 404);
    if (path.endsWith("/history")) return json({ entity_iri: iri, events: [], total: 0 });
    if (path.endsWith("/similar")) return json([]);
    if (path.endsWith('/references')) return json({ groups: [], total: 1 });
    if (path.endsWith("/pull-requests")) return json({ items: [], total: 0 });
    if (path.endsWith("/lint/status")) return json(null);
    if (path.endsWith("/llm/status")) return json({ configured: false });
    if (path === "/api/v1/pr-party/me") return json({ is_reviewer: false });
    if (path.endsWith("/suggestions/pending")) return json({ items: [] });
    if (path.endsWith("/branches")) return json({ items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" });
    if (path.endsWith("/normalization/status")) return json({ needs_normalization: false });
    if (path.endsWith("/revisions/file")) return sourceStatus === 200 ? json({ content: originalSource, revision: "base-commit", filename: "ontology.ttl" }) : json({ detail: "Source unavailable" }, sourceStatus);
    if (path.endsWith("/source")) {
      savedBodies.push(JSON.parse(String(init?.body)));
      if (saveStatus === 403) return json({ detail: "Save refused" }, 403);
      return saveStatus === 409
        ? json({ detail: { code: "SOURCE_REVISION_CONFLICT", message: "Source changed", base_revision: "base-commit", current_revision: "other-commit", branch: "main" } }, 409)
        : json({ commit_hash: "saved-commit" });
    }
    if (path.endsWith("/remote-sync")) return json({ enabled: false });
    if (path.endsWith("/translation/config")) return json({ enabled: false, source_language: "en", language_tags: [] });
    if (path.endsWith("/translation/entity-state")) return json({ items: [] });
    if (path.endsWith("/translation/palette")) return json({ languages: [] });
    if (path.endsWith("/lint/issues")) return json({ items: [], total: 0 });
    unexpected.push(path);
    return json({ detail: "Unexpected test request" }, 404);
  }));
});
afterEach(() => {
  cleanup();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState(initialEditorMode);
  useSelectionStore.getState().clear();
  client?.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unexpected, JSON.stringify(unexpected)).toEqual([]);
});

describe('editor route real tree actions and keyboard orchestration', () => {
  it('opens keyboard help and closes the topmost overlay with Escape', async () => {
    mount(); await screen.findByText('Person');
    fireEvent.keyDown(document, { key: '?' }); await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' });
    fireEvent.keyDown(document, { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens the real entity dialog with the create shortcut and cancels without saving', async () => {
    mount(); await screen.findByText('Person'); fireEvent.keyDown(document, { key: 'n', ctrlKey: true });
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getByText(/Add.*Entity/i)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); expect(savedBodies).toEqual([]);
  });

  it.each([false, true])('copies the tree IRI through the clipboard boundary (failure: %s)', async failure => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = failure ? vi.fn().mockRejectedValue(new Error('Clipboard refused')) : vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      mount(); fireEvent.contextMenu(await screen.findByText('Person'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy IRI' }));
      await screen.findByText(failure ? 'Failed to copy IRI' : 'IRI copied to clipboard'); expect(writeText).toHaveBeenCalledWith(iri);
    } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
  });

  it('flushes focus with the save shortcut without sending a source mutation', async () => {
    mount(); await screen.findByText('Person'); fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    const input = await screen.findByRole('textbox', { name: 'Turtle source boundary' }); input.focus();
    fireEvent.keyDown(input, { key: 's', ctrlKey: true });
    expect(document.activeElement).not.toBe(input); expect(savedBodies).toEqual([]);
  });
  it.each([false, true])('requires reference acknowledgement and reconciles the tree after delete (failure: %s)', async failure => {
    deleteFailure = failure; mount(); fireEvent.contextMenu(await screen.findByText('Person'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Class' });
    const acknowledgement = await within(dialog).findByLabelText('I understand this will create dangling references');
    expect(within(dialog).getByRole('button', { name: 'Delete' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(acknowledgement); fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByText(failure ? 'Failed to delete class' : 'Deleted "Person"');
    const request = requests.find(r => r.method === 'DELETE')!;
    expect(request.authorization).toBe('Bearer route-fixture-token');
    expect(new URLSearchParams(request.search).get('branch')).toBe('main');
    expect(new URLSearchParams(request.search).get('commit_message')).toBe('Delete class Person');
    if (failure) expect(await screen.findByText('Person')).toBeDefined();
    else await waitFor(() => expect(screen.queryByText('Person')).toBeNull());
    expect(requests.filter(r => r.path.endsWith('/ontology/tree')).length).toBeGreaterThanOrEqual(2);
  });

  it('cancels deletion without removing the class or sending a request', async () => {
    mount(); fireEvent.contextMenu(await screen.findByText('Person')); fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Class' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Person')).toBeDefined(); expect(requests.some(r => r.method === 'DELETE')).toBe(false);
  });



  it('persists a class form edit through the real Turtle writer and revision-guarded source API', async () => {
    mount(); fireEvent.click(await screen.findByText('Person'));
    const label = await screen.findByPlaceholderText('Label text'); await waitFor(() => expect((label as HTMLInputElement).value).toBe('Person')); fireEvent.change(label, { target: { value: 'Human' } }); fireEvent.blur(label);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save' })); await screen.findByText('Updated "Human"');
    expect(savedBodies).toHaveLength(1);
    const payload = savedBodies[0] as { content: string; base_revision: string; commit_message: string };
    expect(payload).toMatchObject({ base_revision: 'base-commit', commit_message: 'Update class Human' });
    expect(parseBlockTriples(payload.content, iri), payload.content).toContainEqual({ predicate: 'http://www.w3.org/2000/01/rdf-schema#label', object: { type: 'literal', value: 'Human', lang: 'en' } });
    expect(requests.find(r => r.path.endsWith('/source'))).toMatchObject({ method: 'PUT', search: '?branch=main' });
  });

  it.each([403, 409])('preserves a class draft when its source write fails with %i', async status => {
    saveStatus = status; mount(); fireEvent.click(await screen.findByText('Person'));
    const label = await screen.findByPlaceholderText('Label text'); await waitFor(() => expect((label as HTMLInputElement).value).toBe('Person')); fireEvent.change(label, { target: { value: 'Unsaved human' } }); fireEvent.blur(label);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false)); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    if (status === 409) await screen.findByText('A newer source revision is available.');
    else await screen.findAllByText(/Save refused/);
    expect((label as HTMLInputElement).value).toBe('Unsaved human');
    expect(screen.queryByText('Updated "Unsaved human"')).toBeNull();
  });

  it.each(["class", "objectProperty", "individual"])("adds a %s snippet to the loaded source without losing existing entities", async entityType => {
    mount(); await screen.findByText("Person");
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/revisions/file"))).toBe(true));
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "New entity" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: entityType } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    fireEvent.change(within(dialog).getByLabelText("IRI"), { target: { value: "https://example.test/NewEntity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((source as HTMLTextAreaElement).value).toContain('"New entity"'));
    expect((source as HTMLTextAreaElement).value).toContain(originalSource);
    expect(parseBlockTriples((source as HTMLTextAreaElement).value, "https://example.test/NewEntity")).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "New entity", lang: "en" } });
    expect(savedBodies).toEqual([]);
  });

  it("loads existing source before adding the first class and exposes the optimistic tree node", async () => {
    mount(); await screen.findByText("Person");
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "New entity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    fireEvent.change(within(dialog).getByLabelText("IRI"), { target: { value: "https://example.test/NewEntity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await screen.findByText("New entity");
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((source as HTMLTextAreaElement).value).toContain('"New entity"'));
    expect((source as HTMLTextAreaElement).value).toContain(originalSource);
    expect(savedBodies).toEqual([]);
  });

  it("reports a source-load failure without adding an optimistic class or overwriting source", async () => {
    sourceStatus = 403; mount(); await screen.findByText("Person");
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Uncreated class" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await screen.findByText("Failed to load source before adding entity");
    expect(screen.queryByText("Uncreated class")).toBeNull();
    expect(savedBodies).toEqual([]);
  });

});
