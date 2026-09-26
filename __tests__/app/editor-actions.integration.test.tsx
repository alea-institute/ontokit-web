import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useDraftStore } from "@/lib/stores/draftStore";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { useAnonymousTokenStore, useAnonymousCreditStore } from "@/lib/stores/anonymousCreditStore";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import { useSelectionStore } from "@/lib/stores/selectionStore";

const boundary = vi.hoisted(() => ({
  session: { data: null as null | { accessToken: string; user: { email: string } }, status: "unauthenticated" },
  replace: vi.fn(), push: vi.fn(), signIn: vi.fn(),
  search: new URLSearchParams(),
  monacoProps: {} as Record<string, unknown>,
  mountMonaco: null as null | ((props: { value: string; onMount: (editor: unknown, monaco: unknown) => void }) => void),
}));
vi.mock("next-auth/react", () => ({ useSession: () => boundary.session, signIn: boundary.signIn, signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "route-project" }),
  useSearchParams: () => boundary.search,
  usePathname: () => "/projects/route-project/editor",
  useRouter: () => ({ replace: boundary.replace, push: boundary.push }),
}));

// Match Next App Router's compiler alias; the default Node entry uses Pages
// Router loadable refs and does not expose the source editor imperative handle.
vi.mock("next/dynamic", async () => ({ default: (await import("next/dist/shared/lib/app-dynamic")).default }));

vi.mock("@monaco-editor/react", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    loader: { config: vi.fn() },
    default: function MonacoBoundary(props: { value: string; onChange: (value: string) => void; onMount: (editor: unknown, monaco: unknown) => void }) {
      boundary.monacoProps = props;
      const initialProps = useRef(props);
      useEffect(() => { boundary.mountMonaco?.(initialProps.current); }, []);
      return <textarea aria-label="Turtle source boundary" value={props.value} onChange={(event) => props.onChange(event.target.value)} />;
    },
  };
});
import EditorPage from "@/app/projects/[id]/editor/page";

// The page, its hooks, API client, stores, header and providers are real.
// HTTP, socket/worker/browser APIs, Monaco, and framework session/router are
// replaced at their boundaries; application orchestration stays real.
const iri = "https://example.test/Person";
const initialEditorMode = useEditorModeStore.getState();
const initialSendBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
let llmConfigured: boolean;
let generationBodies: unknown[];
let extraTreeNodes: object[];
let nestPerson: boolean;
let classParents: string[];
let ancestorStatus: number;
let revisionStatus: number;
let lintStatus: object | null;
let lintIssues: object[];
let extraBranches: object[];
let projectResponse: object;
let trustStatus: number;
let trustCapabilities: { tier: string; can_mint_entities: boolean; accepted_count: number; promotion_threshold: number };
let deleted: boolean;
let deleteFailure: boolean;
let referenceTotal: number;
let referenceStatus: number;
let projectStatus: number;
let client: QueryClient;
const originalSource = '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n@prefix ex: <https://example.test/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .';
let saveStatus: number;
let sourceStatus: number;
let sourceContent: string;
let sourceRevision: string;
let entityResults: object[];
let suggestionFailure: "create" | "save" | null;
let suggestionSubmitStatus: number;
let resumableSessions: object[];
let sessionListStatus: number;
let suggestionSubmissions: unknown[];
let suggestionBodies: { content: string; entity_iri: string; entity_label: string }[];
let anonymousFailure: "create" | "save" | "submit" | "discard" | null;
let anonymousSubmissions: unknown[];
let savedBodies: unknown[];
let unexpected: string[];
const requests: { path: string; method: string; search: string; authorization: string | null; anonymousToken: string | null }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<EditorPage />, { wrapper: ({ children }) => <QueryClientProvider client={client}><TooltipProvider><ToastProvider>{children}<ToastContainer /></ToastProvider></TooltipProvider></QueryClientProvider> });
}
function authenticate() {
  boundary.session = { data: { accessToken: "route-fixture-token", user: { email: "reader@example.test" } }, status: "authenticated" };
}

type EditableType = "property" | "individual";
const editableIri = "https://example.test/Editable";
async function openEntityForm(entityType: EditableType, propertyKind: "object" | "data" | "annotation" = "object") {
  const propertyTypes = { object: "ObjectProperty", data: "DatatypeProperty", annotation: "AnnotationProperty" };
  const owlType = entityType === "property" ? propertyTypes[propertyKind] : "NamedIndividual";
  sourceContent = originalSource + '\nex:Editable a owl:' + owlType + ' ;\n  rdfs:label "Original entity"@en ;\n  rdfs:comment "Preserved comment"@en .';
  entityResults = [{ iri: editableIri, label: "Original entity", entity_type: entityType, property_kind: propertyKind }];
  mount(); await screen.findByText("Person");
  await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
  fireEvent.click(screen.getByRole("button", { name: entityType === "property" ? "Properties" : "Individuals" }));
  fireEvent.click(await screen.findByText("Original entity"));
  const inputs = await screen.findAllByPlaceholderText("Label text");
  return inputs.find(input => (input as HTMLInputElement).value === "Original entity") as HTMLInputElement;
}
async function openSuggestionForm(entityType: "class" | "property") {
  if (entityType === "property") return openEntityForm("property");
  mount(); fireEvent.click(await screen.findByText("Person"));
  const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
  await waitFor(() => expect(label.value).toBe("Person"));
  return label;
}
async function editAndSave(label: HTMLInputElement, value: string) {
  fireEvent.change(label, { target: { value } }); fireEvent.blur(label);
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

async function saveAnonymousProposal() {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
  boundary.session = { data: null, status: "unauthenticated" };
  projectResponse = { ...projectResponse, user_role: "viewer", is_public: true };
  mount(); fireEvent.click(await screen.findByText("Person"));
  fireEvent.click(await screen.findByRole("button", { name: "Propose Edit" }));
  const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
  await waitFor(() => expect(label.value).toBe("Person"));
  await editAndSave(label, "Anonymous label");
  await screen.findByText('Proposed update to "Anonymous label"');
}

async function requestGeneratedChild() {
  llmConfigured = true; mount(); fireEvent.click(await screen.findByText("Person"));
  fireEvent.click(within(await screen.findByTitle("Suggest child classes")).getByRole("button", { name: "Get LLM suggestions for this section" }));
  const accept = await screen.findByRole("button", { name: "Accept suggestion" });
  return accept.closest('[role="listitem"]') as HTMLElement;
}

// jsdom has no layout; only element geometry is replaced. The drag sensor,
// tree hook, page callbacks and persistence chain remain real.
function installTreeGeometry(positions: Record<string, number>, rootY?: number) {
  const rect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const y = positions[this.getAttribute("data-iri") ?? ""];
    if (y !== undefined) return new DOMRect(0, y, 200, 24);
    if (rootY !== undefined && this.textContent === "Drop here to make root class") return new DOMRect(0, rootY, 200, 24);
    return rect.call(this);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.monacoProps = {};
  boundary.mountMonaco = null;
  boundary.search = new URLSearchParams(); ancestorStatus = 200; revisionStatus = 200; lintStatus = null; lintIssues = []; extraBranches = [];
  sessionStorage.removeItem("ontokit:branch:route-project");
  llmConfigured = false; generationBodies = []; extraTreeNodes = []; nestPerson = false; classParents = [];
  useSuggestionStore.getState().clearAllSuggestions();
  useAnonymousTokenStore.setState({ tokens: {} });
  useAnonymousCreditStore.getState().clearCredit();
  anonymousFailure = null; anonymousSubmissions = [];
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ showManualSaveButton: true });
  useSelectionStore.getState().clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "required");
  vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "false");
  authenticate();
  projectResponse = { id: "route-project", name: "Route ontology", source_file_path: "ontology.ttl", user_role: "owner", is_public: false };
  trustStatus = 200;
  trustCapabilities = { tier: "reviewer", can_mint_entities: true, accepted_count: 0, promotion_threshold: 3 };
  projectStatus = 200; deleted = false; deleteFailure = false; referenceTotal = 1; referenceStatus = 200;
  saveStatus = 200; sourceStatus = 200; sourceContent = originalSource; sourceRevision = "base-commit"; entityResults = [];
  savedBodies = []; suggestionBodies = []; suggestionFailure = null; suggestionSubmitStatus = 200; suggestionSubmissions = []; resumableSessions = []; sessionListStatus = 200;
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
    requests.push({ path, method: init?.method ?? "GET", search: new URL(String(input)).search, authorization: new Headers(init?.headers).get("Authorization"), anonymousToken: new Headers(init?.headers).get("X-Anonymous-Token") });
    if (path === "/api/v1/projects/route-project") return json(projectResponse, projectStatus);
    if (path.endsWith("/suggestions/anonymous/sessions")) return anonymousFailure === "create" ? json({ detail: "Anonymous start refused" }, 403) : json({ session_id: "anonymous-session", branch: "suggestion/anonymous", anonymous_token: "fixture-anonymous-token", created_at: new Date().toISOString() });
    if (path.includes("/suggestions/anonymous/sessions/anonymous-session/")) {
      const action = path.split("/").at(-1);
      if (action === "save") suggestionBodies.push(JSON.parse(String(init?.body)));
      if (action === "submit") anonymousSubmissions.push(JSON.parse(String(init?.body)));
      if (action === anonymousFailure) return json({ detail: "Anonymous " + action + " refused" }, 403);
      if (action === "submit") return json({ pr_number: 42, pr_url: "https://example.test/proposals/42" });
      if (action === "discard") return new Response(null, { status: 204 });
      return json({ changes_count: suggestionBodies.length, commit_hash: "anonymous-commit" });
    }
    if (path.endsWith("/suggestions/sessions") && (!init?.method || init.method === "GET")) return sessionListStatus === 200 ? json({ items: resumableSessions }) : json({ detail: "Session list refused" }, sessionListStatus);
    if (path.endsWith("/suggestions/sessions")) return suggestionFailure === "create" ? json({ detail: "Session refused" }, 403) : json({ session_id: "suggestion-session", branch: "suggestion/draft", created_at: "2026-09-19T12:00:00Z", beacon_token: "fixture-beacon" });
    if (path.endsWith("/suggestions/sessions/suggestion-session/submit") || path.endsWith("/suggestions/sessions/suggestion-session/resubmit")) {
      suggestionSubmissions.push(JSON.parse(String(init?.body)));
      return suggestionSubmitStatus === 200 ? json({ pr_number: 23, pr_url: "https://example.test/pull/23" }) : json({ detail: "Submission refused" }, suggestionSubmitStatus);
    }
    if (path.endsWith("/suggestions/sessions/suggestion-session/save")) {
      suggestionBodies.push(JSON.parse(String(init?.body)));
      return suggestionFailure === "save" ? json({ detail: "Suggestion refused" }, 403) : json({ commit_hash: "suggestion-commit", branch: "suggestion/draft", changes_count: suggestionBodies.length });
    }
    if (path.endsWith("/suggestions/capabilities")) return trustStatus === 200 ? json(trustCapabilities) : json({ detail: "Contributor status unavailable" }, trustStatus);
    if (path.endsWith("/ontology/search")) return json({ results: entityResults, total: entityResults.length });
    if (path.endsWith("/ancestors")) return ancestorStatus === 200 ? json({ nodes: [] }) : json({ detail: "Ancestors unavailable" }, ancestorStatus);
    if (path.endsWith("/ontology/tree/" + encodeURIComponent("https://example.test/OldParent") + "/children")) return json({ nodes: [{ iri, label: "Person", child_count: 0 }], total_classes: 1 });
    if (path.endsWith("/ontology/tree")) return json({ nodes: deleted ? [] : [nestPerson ? { iri: "https://example.test/OldParent", label: "Old parent", child_count: 1 } : { iri, label: "Person", child_count: 0 }, ...extraTreeNodes], total_classes: deleted ? 0 : 1 + extraTreeNodes.length });
    if (path.endsWith('/ontology/classes/' + encodeURIComponent(iri))) {
      if (init?.method === 'DELETE') { if (deleteFailure) return json({ detail: 'Delete refused' }, 403); deleted = true; return new Response(null, { status: 204 }); }
      return json({ iri, labels: [{ value: 'Person', lang: 'en' }], comments: [], parent_iris: classParents, parent_labels: {}, annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true });
    }
    if (path.endsWith("/ontology/classes/" + encodeURIComponent("https://example.test/Sibling"))) return json({ iri: "https://example.test/Sibling", labels: [{ value: "Sibling", lang: "en" }], comments: [], parent_iris: [], parent_labels: {}, annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true });
    if (path.endsWith("/ontology/classes/" + encodeURIComponent("https://example.test/Generated"))) return json({ iri: "https://example.test/Generated", labels: [{ value: "Generated child", lang: "en" }], comments: [], parent_iris: [iri], parent_labels: { [iri]: "Person" }, annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true });
    if (path.endsWith("/ontology/classes/" + encodeURIComponent("https://example.test/Child"))) return json({ detail: "Not persisted yet" }, 404);
    if (path.endsWith("/ontology/classes/" + encodeURIComponent("https://example.test/NewEntity"))) return json({ detail: "Not persisted yet" }, 404);
    if (path.endsWith("/history")) return json({ entity_iri: iri, events: [], total: 0 });
    if (path.endsWith("/similar")) return json([]);
    if (path.endsWith('/references')) return referenceStatus === 200 ? json({ groups: [], total: referenceTotal }) : json({ detail: 'References unavailable' }, referenceStatus);
    if (path.endsWith("/pull-requests")) return json({ items: [], total: 0 });
    if (path.endsWith("/revisions")) return revisionStatus === 200 ? json({ commits: [], refs: {} }) : json({ detail: "History unavailable" }, revisionStatus);
    if (path.endsWith("/lint/config")) return json({ effective_rules: [], enabled_rules: null, lint_level: null });
    if (path.endsWith("/lint/levels")) return json({ levels: [] });
    if (path.endsWith("/branch-preference") || path.endsWith("/suggestion-session/discard")) return new Response(null, { status: 204 });
    if (path.endsWith("/lint/status")) return json(lintStatus);
    if (path.endsWith("/llm/generate-suggestions")) {
      generationBodies.push(JSON.parse(String(init?.body)));
      return json({ suggestions: [{ iri: "https://example.test/Generated", label: "Generated child", suggestion_type: "children", provenance: "llm-proposed", model: "fixture-model", prompt_template: "children", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [] }], input_tokens: 10, output_tokens: 20 });
    }
    if (path.endsWith("/llm/status")) return json({ configured: llmConfigured });
    if (path === "/api/v1/pr-party/me") return json({ is_reviewer: false });
    if (path.endsWith("/suggestions/pending")) return json({ items: [] });
    if (path.endsWith("/branches")) return json({ items: [{ name: "main", is_current: true }, ...extraBranches], current_branch: "main", default_branch: "main" });
    if (path.endsWith("/normalization/status")) return json({ needs_normalization: false });
    if (path.endsWith("/revisions/file")) return sourceStatus === 200 ? json({ content: sourceContent, revision: sourceRevision, filename: "ontology.ttl" }) : json({ detail: "Source unavailable" }, sourceStatus);
    if (path.endsWith("/source")) {
      savedBodies.push(JSON.parse(String(init?.body)));
      if (saveStatus === 403) return json({ detail: "Save refused" }, 403);
      if (saveStatus === 200) { sourceContent = (savedBodies.at(-1) as { content: string }).content; sourceRevision = "saved-commit"; }
      return saveStatus === 409
        ? json({ detail: { code: "SOURCE_REVISION_CONFLICT", message: "Source changed", base_revision: "base-commit", current_revision: "other-commit", branch: "main" } }, 409)
        : json({ commit_hash: "saved-commit" });
    }
    if (path.endsWith("/remote-sync")) return json({ enabled: false });
    if (path.endsWith("/translation/config")) return json({ enabled: false, source_language: "en", language_tags: [] });
    if (path.endsWith("/translation/entity-state")) return json({ items: [] });
    if (path.endsWith("/translation/palette")) return json({ languages: [] });
    if (path.endsWith("/lint/issues")) return json({ items: lintIssues, total: lintIssues.length });
    unexpected.push(path);
    return json({ detail: "Unexpected test request" }, 404);
  }));
});
afterEach(() => {
  cleanup();
  if (initialSendBeacon) Object.defineProperty(navigator, "sendBeacon", initialSendBeacon);
  else Reflect.deleteProperty(navigator, "sendBeacon");
  sessionStorage.removeItem("ontokit:branch:route-project");
  useSuggestionStore.getState().clearAllSuggestions();
  useAnonymousTokenStore.setState({ tokens: {} });
  useAnonymousCreditStore.getState().clearCredit();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState(initialEditorMode);
  useSelectionStore.getState().clear();
  client?.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unexpected, JSON.stringify(unexpected)).toEqual([]);
});

// Auth-mode matrix plan U4 (provisional): disabled mode is a single-user
// workspace. The API returns the anonymous identity's role and accepts writes
// without a bearer, so the editor's write paths proceed tokenless there.
describe("disabled-mode editor writes without a bearer", () => {
  function workspaceOwner() {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "disabled");
    boundary.session = { data: null, status: "unauthenticated" };
    projectResponse = { ...projectResponse, user_role: "owner", is_public: false };
  }

  it("persists a class form edit through PUT /source without an Authorization header", async () => {
    workspaceOwner();
    mount(); fireEvent.click(await screen.findByText("Person"));
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    await editAndSave(label, "Human");
    await screen.findByText('Updated "Human"');
    // URL selection sync may replace the query string; the viewer redirect must not fire.
    expect(boundary.replace).not.toHaveBeenCalledWith("/projects/route-project");
    expect(savedBodies).toHaveLength(1);
    expect(savedBodies[0]).toMatchObject({ base_revision: "base-commit", commit_message: "Update class Human" });
    expect(requests.find(r => r.path.endsWith("/source"))).toMatchObject({ method: "PUT", search: "?branch=main", authorization: null });
    expect(requests.every(r => r.authorization === null)).toBe(true);

    // Reload: a fresh editor reads the committed source back without a bearer.
    cleanup(); client.clear(); requests.length = 0;
    mount(); await screen.findByText("Person");
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((source as HTMLTextAreaElement).value).toContain('"Human"'));
    expect(requests.find(r => r.path.endsWith("/revisions/file"))).toMatchObject({ authorization: null });
  });

  it.each(["property", "individual"] as const)("persists a %s form edit without an Authorization header", async entityType => {
    workspaceOwner();
    const label = await openEntityForm(entityType);
    await editAndSave(label, "Workspace change");
    await screen.findByText('Updated "Workspace change"');
    expect(savedBodies).toHaveLength(1);
    expect(requests.find(r => r.path.endsWith("/source"))).toMatchObject({ method: "PUT", authorization: null });
  });

  it("fetches the source without a bearer before adding the first entity", async () => {
    workspaceOwner();
    mount(); await screen.findByText("Person");
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "New entity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    fireEvent.change(within(dialog).getByLabelText("IRI"), { target: { value: "https://example.test/NewEntity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await screen.findByText("New entity");
    expect(requests.filter(r => r.path.endsWith("/revisions/file"))).not.toHaveLength(0);
    expect(requests.every(r => r.authorization === null)).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" });
    await waitFor(() => expect((source as HTMLTextAreaElement).value).toContain('"New entity"'));
    expect((source as HTMLTextAreaElement).value).toContain(originalSource);
  });

  it("sends a class delete without an Authorization header", async () => {
    workspaceOwner(); referenceTotal = 0;
    mount(); fireEvent.contextMenu(await screen.findByText("Person"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Class" });
    const button = within(dialog).getByRole("button", { name: "Delete" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button);
    await screen.findByText('Deleted "Person"');
    expect(requests.find(r => r.method === "DELETE")).toMatchObject({ authorization: null });
  });

  it("reparents a class through PUT /source without an Authorization header", async () => {
    workspaceOwner();
    const destination = "https://example.test/Destination";
    extraTreeNodes = [{ iri: destination, label: "Destination", child_count: 0 }];
    installTreeGeometry({ [iri]: 100, [destination]: 125 });
    mount();
    const row = await screen.findByRole("treeitem", { name: /Person/ });
    row.focus();
    fireEvent.keyDown(row, { key: " ", code: "Space" });
    await screen.findByText("Drop here to make root class");
    await act(async () => { fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" }); });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(parseBlockTriples((savedBodies[0] as { content: string }).content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: destination } });
    await screen.findByText('Moved "Person"');
    expect(requests.every(r => r.authorization === null)).toBe(true);
  });

  // The LLM gate needs a signed-in user, so the generated-entity controls stay
  // hidden in disabled mode rather than offering an action without a path.
  it("hides generated-entity suggestion controls in disabled mode", async () => {
    workspaceOwner(); llmConfigured = true;
    mount(); fireEvent.click(await screen.findByText("Person"));
    await screen.findByPlaceholderText("Label text");
    expect(screen.queryByTitle("Suggest child classes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Get LLM suggestions for this section" })).toBeNull();
  });

  // A visitor proposing on a public project it cannot edit must never reach a
  // direct commit: the API refuses a base-branch PUT for that identity.
  it.each([
    ["disabled", "property"], ["disabled", "individual"],
    ["optional", "property"], ["optional", "individual"],
  ] as const)("routes a %s-mode anonymous %s proposal to the proposal session, never PUT /source", async (mode, entityType) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", mode);
    boundary.session = { data: null, status: "unauthenticated" };
    projectResponse = { ...projectResponse, user_role: null, is_public: true };
    sourceContent = originalSource + '\nex:Editable a owl:' + (entityType === "property" ? "ObjectProperty" : "NamedIndividual") + ' ;\n  rdfs:label "Original entity"@en .';
    entityResults = [{ iri: editableIri, label: "Original entity", entity_type: entityType, property_kind: "object" }];
    // The proposal starts from the class panel; once active, every entity
    // form becomes editable, so property and individual saves must follow it.
    mount(); fireEvent.click(await screen.findByText("Person"));
    fireEvent.click(await screen.findByRole("button", { name: "Propose Edit" }));
    await screen.findByText("Proposing");
    // Hovering the Source tab preloads the source the entity forms parse.
    await act(async () => { for (const tab of screen.getAllByRole("button", { name: "Source" })) fireEvent.mouseEnter(tab); });
    fireEvent.click(screen.getByRole("button", { name: entityType === "property" ? "Properties" : "Individuals" }));
    fireEvent.click(await screen.findByText("Original entity"));
    const inputs = await screen.findAllByPlaceholderText("Label text");
    const editable = inputs.find(input => (input as HTMLInputElement).value === "Original entity") as HTMLInputElement;
    await editAndSave(editable, "Proposed entity");
    await screen.findByText('Proposed update to "Proposed entity"');
    expect(savedBodies).toEqual([]);
    expect(requests.some(r => r.path.endsWith("/source"))).toBe(false);
    expect(suggestionBodies).toHaveLength(1);
    expect(suggestionBodies[0]).toMatchObject({ entity_iri: editableIri, entity_label: "Proposed entity" });
  });
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

  it("keeps deletion blocked until a failed impact lookup is retried successfully", async () => {
    referenceTotal = 0; referenceStatus = 403;
    mount(); fireEvent.contextMenu(await screen.findByText("Person"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Class" });
    await within(dialog).findByRole("button", { name: "Retry" });
    const button = within(dialog).getByRole("button", { name: "Delete" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(requests.some(request => request.method === "DELETE")).toBe(false);
    referenceStatus = 200;
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button);
    await screen.findByText('Deleted "Person"');
  });

  it("restores a cold editor class URL only after branch initialization", async () => {
    boundary.search = new URLSearchParams({ classIri: iri });
    mount();
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    expect(requests.find(request => request.path.endsWith("/ancestors"))?.search).toBe("?branch=main");
  });

  it("allows deletion after a successful zero-reference lookup", async () => {
    referenceTotal = 0; mount(); fireEvent.contextMenu(await screen.findByText("Person"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Class" });
    const button = within(dialog).getByRole("button", { name: "Delete" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button);
    await screen.findByText('Deleted "Person"');
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

  it.each([
    ["property", 200], ["individual", 200],
    ["property", 403], ["individual", 403],
    ["property", 409], ["individual", 409],
  ] as const)("saves the real %s form through the source writer with HTTP status %i", async (entityType, status) => {
    saveStatus = status;
    const label = await openEntityForm(entityType);
    expect(label).toBeDefined();
    await editAndSave(label, "Changed entity");
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    const payload = savedBodies[0] as { content: string; base_revision: string; commit_message: string };
    expect(payload).toMatchObject({ base_revision: "base-commit", commit_message: "Update " + entityType + " Changed entity" });
    const triples = parseBlockTriples(payload.content, editableIri);
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Changed entity", lang: "en" } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#comment", object: { type: "literal", value: "Preserved comment", lang: "en" } });
    expect(parseBlockTriples(payload.content, iri)).toEqual(parseBlockTriples(originalSource, iri));
    expect(requests.find(r => r.path.endsWith("/source"))).toMatchObject({ method: "PUT", search: "?branch=main", authorization: "Bearer route-fixture-token" });
    if (status === 200) {
      await screen.findByText('Updated "Changed entity"');
      expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(0);
    } else {
      if (status === 409) await screen.findByText("A newer source revision is available.");
      else await screen.findAllByText(/Save refused/);
      expect(label.value).toBe("Changed entity");
      expect(Object.values(useDraftStore.getState().drafts).some(draft => draft.labels.some(value => value.value === "Changed entity"))).toBe(true);
      expect(screen.queryByText('Updated "Changed entity"')).toBeNull();
    }
  });

  it.each(["property", "individual"] as const)("discards a %s edit without changing its saved source", async entityType => {
    const label = await openEntityForm(entityType);
    fireEvent.change(label, { target: { value: "Discarded label" } }); fireEvent.blur(label);
    await waitFor(() => expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(1));
    fireEvent.click(screen.getByTitle("Discard changes"));
    await waitFor(() => expect(label.value).toBe("Original entity"));
    expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(0);
    expect(savedBodies).toEqual([]);
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });

  it.each(["property", "individual"] as const)("uses the newly committed revision for a second %s edit", async entityType => {
    const label = await openEntityForm(entityType);
    await editAndSave(label, "First change");
    await screen.findByText('Updated "First change"');
    await editAndSave(label, "Second change");
    await screen.findByText('Updated "Second change"');
    expect(savedBodies).toHaveLength(2);
    expect(savedBodies[0]).toMatchObject({ base_revision: "base-commit" });
    expect(savedBodies[1]).toMatchObject({ base_revision: "saved-commit" });
    const second = savedBodies[1] as { content: string };
    const labels = parseBlockTriples(second.content, editableIri)?.filter(triple => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#label");
    expect(labels).toEqual([{ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Second change", lang: "en" } }]);
    expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(0);
  });

  it.each([
    ["class", null], ["property", null],
    ["class", "create"], ["property", "create"],
    ["class", "save"], ["property", "save"],
  ] as const)("persists a %s suggestion through the real session workflow (failure: %s)", async (entityType, failure) => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    suggestionFailure = failure;
    const label = await openSuggestionForm(entityType);
    await editAndSave(label, "Suggested entity");
    if (failure) {
      await screen.findAllByText(failure === "create" ? "The suggestion session could not start. Please retry." : "The suggested update was not saved. Please retry.");
      expect(Object.values(useDraftStore.getState().drafts).some(draft => draft.labels.some(value => value.value === "Suggested entity"))).toBe(true);
      expect(screen.queryByText('Suggested update to "Suggested entity"')).toBeNull();
    } else {
      await screen.findByText('Suggested update to "Suggested entity"');
      expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(0);
      expect(screen.getByRole("button", { name: /Submit Suggestions/ })).toBeDefined();
    }
    expect(savedBodies).toEqual([]);
    const creates = requests.filter(r => r.path.endsWith("/suggestions/sessions"));
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ method: "POST", authorization: "Bearer route-fixture-token" });
    expect(suggestionBodies).toHaveLength(failure === "create" ? 0 : 1);
    if (failure !== "create") {
      const target = entityType === "class" ? iri : editableIri;
      expect(suggestionBodies[0]).toMatchObject({ entity_iri: target, entity_label: "Suggested entity" });
      expect(parseBlockTriples(suggestionBodies[0].content, target)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Suggested entity", lang: "en" } });
    }
    if (failure) {
      suggestionFailure = null;
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await screen.findByText('Suggested update to "Suggested entity"');
      expect(suggestionBodies).toHaveLength(failure === "create" ? 1 : 2);
      expect(requests.filter(r => r.path.endsWith("/suggestions/sessions"))).toHaveLength(failure === "create" ? 2 : 1);
      expect(Object.values(useDraftStore.getState().drafts)).toHaveLength(0);
      expect(savedBodies).toEqual([]);
    }
  });

  it.each(["class", "property"] as const)("reuses an active suggestion session for a second %s save", async entityType => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const label = await openSuggestionForm(entityType);
    await editAndSave(label, "First suggestion");
    await screen.findByText('Suggested update to "First suggestion"');
    await editAndSave(label, "Second suggestion");
    await screen.findByText('Suggested update to "Second suggestion"');
    expect(requests.filter(r => r.path.endsWith("/suggestions/sessions"))).toHaveLength(1);
    expect(suggestionBodies).toHaveLength(2);
    const target = entityType === "class" ? iri : editableIri;
    expect(parseBlockTriples(suggestionBodies[1].content, target)?.filter(triple => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#label")).toEqual([{ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Second suggestion", lang: "en" } }]);
    expect(savedBodies).toEqual([]);
  });

  it.each(["property", "individual"] as const)("rejects a blank %s label and saves after correction", async entityType => {
    const label = await openEntityForm(entityType);
    fireEvent.change(label, { target: { value: "   " } }); fireEvent.blur(label);
    await screen.findByText("At least one label is required");
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
    expect(savedBodies).toEqual([]);
    await editAndSave(label, "Corrected entity");
    await screen.findByText('Updated "Corrected entity"');
    expect(screen.queryByText("At least one label is required")).toBeNull();
    expect(savedBodies).toHaveLength(1);
  });

  it.each([null, "create", "save"] as const)("runs an anonymous proposal through real session and class editing (failure: %s)", async failure => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    boundary.session = { data: null, status: "unauthenticated" };
    projectResponse = { ...projectResponse, user_role: "viewer", is_public: true };
    anonymousFailure = failure;
    mount(); fireEvent.click(await screen.findByText("Person"));
    fireEvent.click(await screen.findByRole("button", { name: "Propose Edit" }));
    if (failure === "create") {
      await screen.findByText(/Anonymous start refused/);
      expect(useAnonymousTokenStore.getState().getToken("route-project")).toBeNull();
      anonymousFailure = null;
      fireEvent.click(screen.getByRole("button", { name: "Propose Edit" }));
    }
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    await editAndSave(label, "Anonymous label");
    if (failure === "save") {
      await screen.findByText("Change not saved");
      expect(screen.queryByText('Proposed update to "Anonymous label"')).toBeNull();
    } else {
      await screen.findByText('Proposed update to "Anonymous label"');
      expect(screen.getByRole("button", { name: /Submit Proposal/ })).toBeDefined();
    }
    expect(savedBodies).toEqual([]);
    expect(suggestionBodies).toHaveLength(1);
    expect(parseBlockTriples(suggestionBodies[0].content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Anonymous label", lang: "en" } });
    expect(requests.find(r => r.path.endsWith("/anonymous-session/save"))).toMatchObject({ method: "PUT", authorization: null, anonymousToken: "fixture-anonymous-token" });
  });

  it.each(["credit", "skip", "dismiss"] as const)("submits an anonymous proposal through the credit dialog (%s)", async exit => {
    await saveAnonymousProposal();
    fireEvent.click(screen.getByRole("button", { name: /Submit Proposal/ }));
    const dialog = await screen.findByRole("dialog", { name: "Want credit for your suggestions?" });
    if (exit === "credit") {
      fireEvent.change(within(dialog).getByPlaceholderText("Your name"), { target: { value: "  Test Contributor  " } });
      fireEvent.change(within(dialog).getByPlaceholderText("your@email.com"), { target: { value: "test@example.test" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    } else if (exit === "dismiss") fireEvent.keyDown(dialog, { key: "Escape" });
    else fireEvent.click(within(dialog).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(anonymousSubmissions).toHaveLength(1));
    expect(anonymousSubmissions[0]).toEqual(exit === "credit"
      ? { submitter_name: "Test Contributor", submitter_email: "test@example.test", website: "" }
      : { website: "" });
    expect(requests.find(r => r.path.endsWith("/anonymous-session/submit"))).toMatchObject({ method: "POST", authorization: null, anonymousToken: "fixture-anonymous-token" });
    const success = await screen.findByRole("dialog", { name: "Thank you — your proposal is in" });
    expect(within(success).getByText(/proposal #42/)).toBeDefined();
    expect(within(success).getByRole("link", { name: "View proposal" }).getAttribute("href")).toBe("https://example.test/proposals/42");
    expect(useAnonymousTokenStore.getState().getToken("route-project")).toBeNull();
    expect(savedBodies).toEqual([]);
    fireEvent.click(within(success).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(anonymousSubmissions).toHaveLength(1);
  });

  it.each([false, true])("cancels then confirms anonymous discard, clearing its token (HTTP failure: %s)", async failure => {
    await saveAnonymousProposal();
    anonymousFailure = failure ? "discard" : null;
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    let dialog = await screen.findByRole("dialog", { name: "Discard proposal?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(requests.some(r => r.path.endsWith("/discard"))).toBe(false);
    expect(useAnonymousTokenStore.getState().getToken("route-project")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    dialog = await screen.findByRole("dialog", { name: "Discard proposal?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(useAnonymousTokenStore.getState().getToken("route-project")).toBeNull());
    expect(requests.filter(r => r.path.endsWith("/discard"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Submit Proposal/ })).toBeNull();
    expect(savedBodies).toEqual([]);
  });

  it.each(["standard", "developer"] as const)("automatically suggests for the latest navigated class in %s", async mode => {
    useEditorModeStore.getState().setEditorMode(mode);
    llmConfigured = true;
    extraTreeNodes = [{ iri: "https://example.test/Sibling", label: "Sibling", child_count: 0 }];
    mount(); fireEvent.click(await screen.findByText("Person"));
    await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getByRole("button", { name: "Next class in branch" }));
    await waitFor(() => expect(generationBodies).toHaveLength(1), { timeout: 2500 });
    expect(generationBodies[0]).toMatchObject({ class_iri: "https://example.test/Sibling", suggestion_type: "annotations" });
  });

  it.each([200, 403, 409])("persists a generated child through generation, acceptance and revision-guarded source (HTTP %i)", async status => {
    llmConfigured = true; saveStatus = status;
    mount(); fireEvent.click(await screen.findByText("Person"));
    const section = await screen.findByTitle("Suggest child classes");
    fireEvent.click(within(section).getByRole("button", { name: "Get LLM suggestions for this section" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept suggestion" }));
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    expect(generationBodies).toEqual([{ class_iri: iri, branch: "main", suggestion_type: "children", batch_size: 5 }]);
    const payload = savedBodies[0] as { content: string };
    expect(savedBodies[0]).toMatchObject({ base_revision: "base-commit", commit_message: 'Add generated class "Generated child"' });
    const triples = parseBlockTriples(payload.content, "https://example.test/Generated");
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: iri } });
    expect(triples?.some(t => t.predicate === "http://www.w3.org/ns/prov#wasGeneratedBy")).toBe(true);
    expect(parseBlockTriples(payload.content, iri)).toEqual(parseBlockTriples(originalSource, iri));
    const key = storeKey({ projectId: "route-project", branch: "main" }, iri, "children");
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0].status).toBe(status === 200 ? "accepted" : "pending"));
    if (status === 200) await screen.findByRole("treeitem", { name: /Generated child/ });
    else {
      if (status === 409) await screen.findByText("A newer source revision is available.");
      else await screen.findByText(/Save refused/);
      expect(screen.queryByRole("treeitem", { name: /Generated child/ })).toBeNull();
    }
  });

  it.each([
    ["direct", false, "object"], ["direct", true, "object"],
    ["suggestion", false, "object"], ["suggestion", true, "object"],
    ["direct", false, "data"], ["direct", false, "annotation"],
    ["suggestion", false, "data"], ["suggestion", false, "annotation"],
  ] as const)("persists a generated sub-property in %s mode (save failure: %s, kind: %s)", async (mode, failure, kind) => {
    llmConfigured = true;
    if (mode === "suggestion") {
      projectResponse = { ...projectResponse, user_role: "suggester" };
      suggestionFailure = failure ? "save" : null;
    } else saveStatus = failure ? 403 : 200;
    await openEntityForm("property", kind);
    const section = screen.getByText("Sub-Properties").parentElement!;
    fireEvent.click(within(section).getByRole("button", { name: "Get LLM suggestions for this section" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept suggestion" }));
    const key = storeKey({ projectId: "route-project", branch: "main" }, editableIri, "children");
    const payloads = mode === "direct" ? savedBodies : suggestionBodies;
    await waitFor(() => expect(payloads).toHaveLength(1));
    if (failure) await screen.findByText(mode === "direct" ? /Save refused/ : /The generated entity was not saved/);
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0].status).toBe(failure ? "pending" : "accepted"));
    const payload = payloads[0] as { content: string };
    const triples = parseBlockTriples(payload.content, "https://example.test/Generated");
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: { type: "iri", value: "http://www.w3.org/2002/07/owl#" + ({ object: "ObjectProperty", data: "DatatypeProperty", annotation: "AnnotationProperty" }[kind]) } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subPropertyOf", object: { type: "iri", value: editableIri } });
    expect(generationBodies).toEqual([{ class_iri: editableIri, branch: "main", suggestion_type: "children", batch_size: 5 }]);
    if (mode === "suggestion") {
      expect(savedBodies).toEqual([]);
      expect(suggestionBodies[0]).toMatchObject({ entity_iri: "https://example.test/Generated", entity_label: "Generated child" });
      expect(requests.some(r => r.path.endsWith("/revisions/file") && new URLSearchParams(r.search).get("version") === "suggestion/draft")).toBe(true);
    } else expect(savedBodies[0]).toMatchObject({ base_revision: "base-commit", commit_message: 'Add generated property "Generated child"' });
    expect(screen.queryByRole("treeitem", { name: /Generated child/ })).toBeNull();
    if (failure) {
      saveStatus = 200; suggestionFailure = null;
      fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
      await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0].status).toBe("accepted"));
      expect(payloads).toHaveLength(2);
      if (mode === "suggestion") expect(requests.filter(r => r.path.endsWith("/suggestions/sessions"))).toHaveLength(1);
    }
  });

  it.each(["empty", "unavailable"] as const)("retains a generated class when authoritative source is %s", async outcome => {
    llmConfigured = true;
    if (outcome === "empty") sourceContent = "   ";
    else sourceStatus = 403;
    mount(); fireEvent.click(await screen.findByText("Person"));
    fireEvent.click(within(await screen.findByTitle("Suggest child classes")).getByRole("button", { name: "Get LLM suggestions for this section" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept suggestion" }));
    await screen.findByText(outcome === "empty" ? /ontology source is empty/ : /Could not accept this suggestion.*Source unavailable/);
    expect(savedBodies).toEqual([]);
    const key = storeKey({ projectId: "route-project", branch: "main" }, iri, "children");
    expect(useSuggestionStore.getState().suggestions[key][0].status).toBe("pending");
    expect(screen.queryByRole("treeitem", { name: /Generated child/ })).toBeNull();
    sourceStatus = 200; sourceContent = originalSource;
    fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0].status).toBe("accepted"));
    expect(savedBodies).toHaveLength(1);
  });

  it.each(["standard", "developer"] as const)("reparents through a suggestion session and undoes it in the %s editor", async mode => {
    useEditorModeStore.getState().setEditorMode(mode);
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const destination = "https://example.test/Destination";
    extraTreeNodes = [{ iri: destination, label: "Destination", child_count: 0 }];
    installTreeGeometry({ [iri]: 100, [destination]: 125 });
    mount();
    const row = await screen.findByRole("treeitem", { name: /Person/ });
    row.focus();
    fireEvent.keyDown(row, { key: " ", code: "Space" });
    await screen.findByText("Drop here to make root class");
    await act(async () => { fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" }); });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(suggestionBodies).toHaveLength(1));
    expect(parseBlockTriples(suggestionBodies[0].content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: destination } });
    await screen.findByText('Moved "Person"');
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(suggestionBodies).toHaveLength(2));
    expect(parseBlockTriples(suggestionBodies[1].content, iri)?.filter(triple => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf")).toEqual([]);
    expect(savedBodies).toEqual([]);
    expect(screen.getByRole("button", { name: /Submit Suggestions/ })).toBeDefined();
  });

  it.each(["standard", "developer"] as const)("reparents through an anonymous proposal and undoes it in the %s editor", async mode => {
    useEditorModeStore.getState().setEditorMode(mode);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    boundary.session = { data: null, status: "unauthenticated" };
    projectResponse = { ...projectResponse, user_role: "viewer", is_public: true };
    const destination = "https://example.test/Destination";
    extraTreeNodes = [{ iri: destination, label: "Destination", child_count: 0 }];
    installTreeGeometry({ [iri]: 100, [destination]: 125 });
    mount();
    const row = await screen.findByRole("treeitem", { name: /Person/ });
    fireEvent.click(row);
    fireEvent.click(await screen.findByRole("button", { name: "Propose Edit" }));
    await screen.findByPlaceholderText("Label text");
    row.focus();
    fireEvent.keyDown(row, { key: " ", code: "Space" });
    await screen.findByText("Drop here to make root class");
    await act(async () => { fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" }); });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(suggestionBodies).toHaveLength(1));
    expect(parseBlockTriples(suggestionBodies[0].content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: destination } });
    await screen.findByText('Moved "Person"');
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(suggestionBodies).toHaveLength(2));
    expect(parseBlockTriples(suggestionBodies[1].content, iri)?.filter(triple => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf")).toEqual([]);
    expect(savedBodies).toEqual([]);
    expect(screen.getByRole("button", { name: /Submit Proposal/ })).toBeDefined();
  });

  it.each([200, 403, 409])("reparents or rolls back through the real keyboard drag sensor (HTTP %i)", async status => {
    saveStatus = status;
    const destination = "https://example.test/Destination";
    extraTreeNodes = [{ iri: destination, label: "Destination", child_count: 0 }];
    installTreeGeometry({ [iri]: 100, [destination]: 125 });
    mount();
    const row = await screen.findByRole("treeitem", { name: /Person/ });
    row.focus();
    fireEvent.keyDown(row, { key: " ", code: "Space" });
    await screen.findByText("Drop here to make root class");
    await act(async () => { fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" }); });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    const payload = savedBodies[0] as { content: string };
    expect(parseBlockTriples(payload.content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: destination } });
    if (status === 200) {
      await screen.findByText('Moved "Person"');
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(savedBodies).toHaveLength(2));
      expect(savedBodies[1]).toMatchObject({ base_revision: "saved-commit" });
      expect(parseBlockTriples((savedBodies[1] as { content: string }).content, iri)?.filter(t => t.predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf")).toEqual([]);
      expect(screen.getByRole("treeitem", { name: /Person/ }).classList.contains("tree-item-root")).toBe(true);
    } else {
      await screen.findByText("Failed to reparent class");
      expect(screen.queryByText('Moved "Person"')).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.getByRole("treeitem", { name: /Person/ }).classList.contains("tree-item-root")).toBe(true);
      expect(sourceContent).toBe(originalSource);
    }
  });

  it.each(["move", "add", "add-existing", "root", "changed-parent"] as const)("reconciles authoritative parents through a real nested keyboard drag (%s)", async mode => {
    const destination = "https://example.test/Destination";
    const oldParent = "https://example.test/OldParent";
    const otherParent = "https://example.test/Other";
    nestPerson = true;
    extraTreeNodes = [{ iri: destination, label: "Destination", child_count: 0 }];
    classParents = mode === "changed-parent" ? [otherParent] : mode === "add-existing" ? [oldParent, otherParent, destination] : [oldParent, otherParent];
    sourceContent = originalSource.slice(0, -1) + ' ; rdfs:subClassOf ' + classParents.map(parent => '<' + parent + '>').join(', ') + ' .';
    installTreeGeometry({ [iri]: 100, [destination]: 125, [oldParent]: 50 }, 75);
    mount(); fireEvent.doubleClick(await screen.findByRole("treeitem", { name: /Old parent/ }));
    const row = await screen.findByRole("treeitem", { name: /Person/ }); row.focus();
    fireEvent.keyDown(row, { key: " ", code: "Space" });
    await screen.findByText("Drop here to make root class");
    if (mode.startsWith("add")) fireEvent.keyDown(window, { key: "Alt", altKey: true });
    const arrow = mode === "root" ? "ArrowUp" : "ArrowDown";
    await act(async () => { fireEvent.keyDown(document, { key: arrow, code: arrow, altKey: mode.startsWith("add") }); });
    fireEvent.keyDown(document, { key: " ", code: "Space", altKey: mode.startsWith("add") });
    fireEvent.keyUp(window, { key: "Alt", altKey: false });
    await waitFor(() => expect(savedBodies).toHaveLength(1));
    const triples = parseBlockTriples((savedBodies[0] as { content: string }).content, iri);
    const parents = triples?.filter(t => t.predicate === "http://www.w3.org/2000/01/rdf-schema#subClassOf").map(t => t.object.value);
    expect(parents?.sort()).toEqual((mode === "root" ? [] : mode.startsWith("add") ? [oldParent, otherParent, destination] : [otherParent, destination]).sort());
    await screen.findByText('Moved "Person"');
    expect(savedBodies[0]).toMatchObject({ base_revision: "base-commit", commit_message: "Update class Person" });
  });

  it.each([200, 403])("restores a changed class URL after branch initialization (ancestor HTTP %i)", async status => {
    ancestorStatus = status;
    const view = mount();
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/ontology/tree") && r.search === "?branch=main")).toBe(true));
    await screen.findByText("Person");
    boundary.search = new URLSearchParams({ classIri: iri }); view.rerender(<EditorPage />);
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    expect(useSelectionStore.getState()).toMatchObject({ iri, type: "class", mode: "editor" });
    expect(requests.filter(r => r.path.endsWith("/ancestors"))).toHaveLength(1);
    view.rerender(<EditorPage />);
    await waitFor(() => expect(label.value).toBe("Person"));
    expect(requests.filter(r => r.path.endsWith("/ancestors"))).toHaveLength(1);
    expect(savedBodies).toEqual([]);
  });

  it("keeps an already selected class when its URL is synchronized", async () => {
    const view = mount(); fireEvent.click(await screen.findByText("Person"));
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    boundary.search = new URLSearchParams({ classIri: iri }); view.rerender(<EditorPage />);
    expect(label.value).toBe("Person");
    expect(requests.some(r => r.path.endsWith("/ancestors"))).toBe(false);
    expect(savedBodies).toEqual([]);
  });

  it("waits for tree data before restoring a class URL into an empty ontology", async () => {
    deleted = true; boundary.search = new URLSearchParams({ classIri: iri }); mount();
    await screen.findByText("No classes found in this ontology");
    expect(requests.some(r => r.path.endsWith("/ancestors") || r.path.includes("/ontology/classes/"))).toBe(false);
    expect(savedBodies).toEqual([]);
  });

  it.each([["property", "ObjectProperty", "propertyIri"], ["individual", "NamedIndividual", "individualIri"]] as const)("restores a changed %s URL into its real editable detail", async (type, owlType, param) => {
    sourceContent = originalSource + '\nex:Editable a owl:' + owlType + ' ; rdfs:label "Linked entity"@en .';
    entityResults = [{ iri: editableIri, label: "Linked entity", entity_type: type, property_kind: "object" }];
    const view = mount();
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/ontology/tree") && r.search === "?branch=main")).toBe(true));
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    boundary.search = new URLSearchParams({ [param]: editableIri }); view.rerender(<EditorPage />);
    await screen.findByDisplayValue("Linked entity");
    expect(useSelectionStore.getState()).toMatchObject({ iri: editableIri, type, mode: "editor" });
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
    expect(requests.some(r => r.path.endsWith("/ontology/search") && new URLSearchParams(r.search).get("entity_types") === type)).toBe(true);
    expect(savedBodies).toEqual([]);
  });

  it.each(["Enter", "Delete", "e"])("curates a focused generated suggestion with the %s shortcut", async key => {
    const card = await requestGeneratedChild(); card.focus();
    fireEvent.keyDown(card, { key });
    if (key === "e") {
      const input = await screen.findByDisplayValue("Generated child"); input.focus();
      fireEvent.change(input, { target: { value: "Keyboard child" } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
    const storeId = storeKey({ projectId: "route-project", branch: "main" }, iri, "children");
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[storeId][0].status).toBe(key === "Delete" ? "rejected" : "accepted"));
    if (key === "Delete") {
      expect(savedBodies).toEqual([]); expect(screen.queryByRole("button", { name: "Accept suggestion" })).toBeNull();
    } else {
      expect(savedBodies).toHaveLength(1);
      expect(parseBlockTriples((savedBodies[0] as { content: string }).content, "https://example.test/Generated")).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: key === "e" ? "Keyboard child" : "Generated child", lang: "en" } });
    }
  });

  it.each([
    ["button", "Enter"], ["button", "Delete"], ["button", "e"],
    ["input", "Enter"], ["input", "Delete"], ["input", "e"],
  ] as const)("leaves %s keyboard input %s unconsumed outside a suggestion card", async (target, key) => {
    await requestGeneratedChild();
    const focused = target === "button" ? screen.getByRole("button", { name: "Properties" }) : screen.getByPlaceholderText("Label text");
    focused.focus();
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    fireEvent(focused, event);
    expect(event.defaultPrevented).toBe(false);
    expect(savedBodies).toEqual([]);
    const storeId = storeKey({ projectId: "route-project", branch: "main" }, iri, "children");
    expect(useSuggestionStore.getState().suggestions[storeId][0].status).toBe("pending");
    expect(screen.queryByDisplayValue("Generated child")).toBeNull();
  });

  it.each([[false, ""], [false, "  Clarify terms  "], [true, "  Clarify terms  "]] as const)("submits the real suggestion session (retry: %s, summary: %s)", async (retry, summary) => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const label = await openSuggestionForm("class"); await editAndSave(label, "Suggested label");
    await screen.findByText('Suggested update to "Suggested label"');
    fireEvent.click(screen.getByRole("button", { name: /Submit Suggestions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
    expect(within(dialog).getByText("Suggested label")).toBeDefined();
    expect(within(dialog).getByText("Modified items (1 change)")).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText("Describe your changes (optional)"), { target: { value: summary } });
    if (retry) suggestionSubmitStatus = 403;
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for Review" }));
    if (retry) {
      await screen.findByText(/Submission refused/);
      expect(screen.queryByText("Suggestions submitted as PR #23")).toBeNull();
      suggestionSubmitStatus = 200;
      fireEvent.click(screen.getByRole("button", { name: /Submit Suggestions/ }));
      const retryDialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
      fireEvent.change(within(retryDialog).getByLabelText("Describe your changes (optional)"), { target: { value: summary } });
      fireEvent.click(within(retryDialog).getByRole("button", { name: "Submit for Review" }));
    }
    await screen.findByText("Suggestions submitted as PR #23");
    expect(suggestionSubmissions).toEqual(Array.from({ length: retry ? 2 : 1 }, () => summary.trim() ? { summary: summary.trim() } : {}));
    expect(requests.find(r => r.path.endsWith("/suggestion-session/submit"))).toMatchObject({ method: "POST", authorization: "Bearer route-fixture-token" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: /Submit Suggestions/ })).toBeNull();
    expect(savedBodies).toEqual([]);
  });

  it("cancels suggestion submission without losing its saved changes", async () => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const label = await openSuggestionForm("class"); await editAndSave(label, "Suggested label");
    await screen.findByText('Suggested update to "Suggested label"');
    fireEvent.click(screen.getByRole("button", { name: /Submit Suggestions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(suggestionSubmissions).toEqual([]);
    expect(screen.getByRole("button", { name: /Submit Suggestions/ })).toBeDefined();
    expect(suggestionBodies).toHaveLength(1); expect(savedBodies).toEqual([]);
  });

  it.each(["button", "Escape"])("loads revision history and closes it with %s", async close => {
    mount(); await screen.findByText("Person");
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("No revision history yet");
    expect(requests.find(r => r.path.endsWith("/revisions"))).toMatchObject({ method: "GET", authorization: "Bearer route-fixture-token" });
    if (close === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else fireEvent.click(within(screen.getByRole("heading", { name: "Revision History" }).parentElement!.parentElement!).getByRole("button"));
    expect(screen.queryByRole("heading", { name: "Revision History" })).toBeNull();
    expect(savedBodies).toEqual([]);
  });

  it("recovers revision-history loading after closing and reopening its panel", async () => {
    revisionStatus = 403; mount(); await screen.findByText("Person");
    fireEvent.click(screen.getByRole("button", { name: "History" })); await screen.findByText(/History unavailable/);
    fireEvent.click(screen.getByRole("button", { name: "History" })); revisionStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "History" })); await screen.findByText("No revision history yet");
    expect(requests.filter(r => r.path.endsWith("/revisions"))).toHaveLength(2);
    expect(screen.queryByText(/History unavailable/)).toBeNull();
  });

  it("opens the real health panel and returns to the editor after closing it", async () => {
    lintStatus = { total_issues: 0, error_count: 0, warning_count: 0, info_count: 0, last_run: null };
    mount(); await screen.findByText("Person");
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    await screen.findByText("No lint run yet"); await screen.findByText("All rules (0)");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: "Health Check" })).toBeNull();
    expect(screen.getByText("Person")).toBeDefined(); expect(savedBodies).toEqual([]);
  });

  it("discards an active suggestion session when switching the editor branch", async () => {
    extraBranches = [{ name: "feature", is_current: false }];
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const label = await openSuggestionForm("class"); await editAndSave(label, "Suggested label");
    await screen.findByText('Suggested update to "Suggested label"');
    fireEvent.click(screen.getByRole("button", { name: "main" }));
    fireEvent.click(await screen.findByRole("option", { name: "feature" }));
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/suggestion-session/discard"))).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Submit Suggestions/ })).toBeNull());
    expect(requests.find(r => r.path.endsWith("/branch-preference"))).toMatchObject({ method: "PUT", search: "?branch=feature", authorization: "Bearer route-fixture-token" });
    expect(boundary.replace).toHaveBeenLastCalledWith("/projects/route-project/editor?branch=feature");
    expect(sessionStorage.getItem("ontokit:branch:route-project")).toBe("feature");
    expect(savedBodies).toEqual([]);
  });

  it.each([false, true])("creates a subclass under its selected tree parent (nested: %s)", async nested => {
    nestPerson = nested;
    mount();
    if (nested) fireEvent.doubleClick(await screen.findByRole("treeitem", { name: /Old parent/ }));
    const parent = await screen.findByRole("treeitem", { name: /^Person/ });
    fireEvent.click(within(parent).getByRole("button", { name: "Add subclass" }));
    const dialog = await screen.findByRole("dialog", { name: "Add Entity" });
    expect(within(dialog).getByText("Person")).toBeDefined();
    expect(within(dialog).getByLabelText("Type").hasAttribute("disabled")).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Child person" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    fireEvent.change(within(dialog).getByLabelText("IRI"), { target: { value: "https://example.test/Child" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await screen.findByText("Child person");
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement;
    await waitFor(() => expect(source.value).toContain('"Child person"'));
    const triples = parseBlockTriples(source.value, "https://example.test/Child");
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: iri } });
    expect(parseBlockTriples(source.value, iri)).toEqual(parseBlockTriples(originalSource, iri));
    expect(savedBodies).toEqual([]);
  });

  it.each([['error', 'bg-red-100'], ['info', 'bg-blue-100']] as const)("summarizes %s findings and opens their real health details", async (severity, color) => {
    lintStatus = { total_issues: 1, error_count: severity === "error" ? 1 : 0, warning_count: 0, info_count: severity === "info" ? 1 : 0, last_run: null };
    lintIssues = [{ id: "severity-fixture", rule_id: "label-required", issue_type: severity, message: "Review severity finding", subject_iri: iri, subject_type: "class", details: {} }];
    mount(); await screen.findByText("Person");
    const health = await screen.findByRole("button", { name: /^Health/ });
    expect((await within(health).findByText("1")).classList.contains(color)).toBe(true);
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    fireEvent.click(health);
    expect(await screen.findByText("Review severity finding")).toBeDefined();
    fireEvent.click(screen.getByTitle(iri));
    await screen.findByDisplayValue("Person");
    expect(useSelectionStore.getState()).toMatchObject({ iri, type: "class", mode: "editor" });
    expect(savedBodies).toEqual([]);
  });

  it.each(["standard", "developer"] as const)("navigates class siblings through the real %s layout and detail client", async mode => {
    useEditorModeStore.getState().setEditorMode(mode);
    const siblingIri = "https://example.test/Sibling";
    extraTreeNodes = [{ iri: siblingIri, label: "Sibling", child_count: 0 }];
    sourceContent = originalSource + '\nex:Sibling a owl:Class ; rdfs:label "Sibling"@en .';
    mount();
    fireEvent.click(await screen.findByText("Person"));
    await screen.findByDisplayValue("Person");
    expect(screen.getByRole("button", { name: "Previous class in branch" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Next class in branch" }));
    await screen.findByDisplayValue("Sibling");
    expect(screen.getByText("2 / 2")).toBeDefined();
    expect(screen.getByRole("button", { name: "Next class in branch" })).toHaveProperty("disabled", true);
    expect(useSelectionStore.getState()).toMatchObject({ iri: siblingIri, type: "class", mode: "editor" });
    const detailRequests = requests.filter(request => request.path.endsWith('/ontology/classes/' + encodeURIComponent(siblingIri)));
    expect(detailRequests.length).toBeGreaterThan(0);
    expect(detailRequests.every(request => request.method === 'GET' && request.authorization === 'Bearer route-fixture-token')).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous class in branch" }));
    await screen.findByDisplayValue("Person");
    expect(screen.getByText("1 / 2")).toBeDefined();
    expect(useSelectionStore.getState()).toMatchObject({ iri, type: "class", mode: "editor" });
    expect(savedBodies).toEqual([]);
  });

  it("navigates an unclassified health finding into the real source editor", async () => {
    lintStatus = { total_issues: 1, error_count: 0, warning_count: 1, info_count: 0, last_run: null };
    lintIssues = [{ id: "health-other", rule_id: "label-required", issue_type: "warning", message: "Inspect source subject", subject_iri: iri, subject_type: "other", details: {} }];
    mount(); await screen.findByText("Person");
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    fireEvent.click(screen.getByRole("button", { name: /^Health/ }));
    await screen.findByText("Inspect source subject");
    fireEvent.click(screen.getByTitle(iri));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement;
    expect(source.value).toBe(originalSource);
    expect(savedBodies).toEqual([]);
  });

  it.each(["class", "property", "individual"] as const)("navigates a health finding into the real %s detail panel", async type => {
    const target = type === "class" ? iri : editableIri;
    const label = type === "class" ? "Person" : "Health entity";
    const owlType = type === "property" ? "ObjectProperty" : "NamedIndividual";
    if (type !== "class") {
      sourceContent = originalSource + '\nex:Editable a owl:' + owlType + ' ; rdfs:label "Health entity"@en .';
      entityResults = [{ iri: target, label, entity_type: type, property_kind: "object" }];
    }
    lintStatus = { total_issues: 1, error_count: 0, warning_count: 1, info_count: 0, last_run: null };
    lintIssues = [{ id: "health-fixture", rule_id: "label-required", issue_type: "warning", message: "Review entity label", subject_iri: target, subject_type: type, details: {} }];
    mount(); await screen.findByText("Person");
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    fireEvent.click(screen.getByRole("button", { name: /^Health/ }));
    await screen.findByText("Review entity label");
    fireEvent.click(screen.getByTitle(target));
    await screen.findByDisplayValue(label);
    expect(useSelectionStore.getState()).toMatchObject({ iri: target, type, mode: "editor" });
    expect(savedBodies).toEqual([]);
  });

  it.each([false, true])("offers the editor sign-in action only with an identity provider (configured: %s)", async configured => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "optional");
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", String(configured));
    boundary.session = { data: null, status: "unauthenticated" };
    projectResponse = { ...projectResponse, user_role: "viewer", is_public: true };
    mount(); await screen.findByText("Person");
    if (configured) {
      fireEvent.click(screen.getByRole("button", { name: "Sign in to edit" }));
      expect(boundary.signIn).toHaveBeenCalledExactlyOnceWith("zitadel", { callbackUrl: window.location.href });
    } else {
      expect(screen.queryByRole("button", { name: "Sign in to edit" })).toBeNull();
      expect(boundary.signIn).not.toHaveBeenCalled();
    }
    expect(savedBodies).toEqual([]);
  });

  it("keeps entry creation locked after a capability error and unlocks after an authenticated retry", async () => {
    trustStatus = 403;
    mount(); await screen.findByText("Person");
    fireEvent.click(await screen.findByRole("button", { name: "Why can't I add entries?" }));
    const explainer = await screen.findByRole("dialog", { name: "How trust is earned" });
    expect(within(explainer).getByText(/couldn't check your contributor status/)).toBeDefined();
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const addDialog = await screen.findByRole("dialog", { name: "Add Entity" });
    expect((within(addDialog).getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(true);
    trustStatus = 200;
    fireEvent.click(within(addDialog).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(addDialog).queryByText(/couldn't check your contributor status/)).toBeNull());
    fireEvent.change(within(addDialog).getByLabelText("Label"), { target: { value: "Recovered class" } });
    expect((within(addDialog).getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(false);
    expect(requests.filter(request => request.path.endsWith("/suggestions/capabilities"))).toEqual([
      expect.objectContaining({ method: "GET", authorization: "Bearer route-fixture-token" }),
      expect.objectContaining({ method: "GET", authorization: "Bearer route-fixture-token" }),
    ]);
    expect(savedBodies).toEqual([]);
  });

  it.each(["standard", "developer"] as const)("explains anonymous minting restrictions and signs in from the %s proposal editor", async mode => {
    useEditorModeStore.getState().setEditorMode(mode);
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
    trustCapabilities = { tier: "anonymous", can_mint_entities: false, accepted_count: 0, promotion_threshold: 3 };
    await saveAnonymousProposal();
    fireEvent.click(await screen.findByRole("button", { name: "Why can't I add entries?" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "How trust is earned" })).getByRole("button", { name: "Sign in" }));
    expect(boundary.signIn).toHaveBeenCalledExactlyOnceWith("zitadel", { callbackUrl: window.location.href });
    expect(anonymousSubmissions).toEqual([]);
    expect(savedBodies).toEqual([]);
    expect(requests.filter(request => request.path.endsWith("/suggestions/capabilities"))).toEqual([
      expect.objectContaining({ method: "GET", authorization: null }),
    ]);
    expect(useAnonymousTokenStore.getState().getToken("route-project")).toBeTruthy();
  });

  it("offers account sign-in after a successful anonymous proposal without submitting twice", async () => {
    vi.stubEnv("NEXT_PUBLIC_ZITADEL_CONFIGURED", "true");
    await saveAnonymousProposal();
    fireEvent.click(screen.getByRole("button", { name: /Submit Proposal/ }));
    const credit = await screen.findByRole("dialog", { name: "Want credit for your suggestions?" });
    fireEvent.click(within(credit).getByRole("button", { name: "Skip" }));
    const success = await screen.findByRole("dialog", { name: "Thank you — your proposal is in" });
    fireEvent.click(within(success).getByRole("button", { name: "Create an account or sign in" }));
    expect(boundary.signIn).toHaveBeenCalledExactlyOnceWith("zitadel", { callbackUrl: window.location.href });
    expect(anonymousSubmissions).toHaveLength(1);
    expect(useAnonymousTokenStore.getState().getToken("route-project")).toBeNull();
  });

  it.each([200, 403])("resumes a cold session URL and resubmits (HTTP %i)", async status => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    boundary.search = new URLSearchParams({ resumeSession: "suggestion-session", branch: "suggestion/draft" });
    extraBranches = [{ name: "suggestion/draft", is_current: false }];
    resumableSessions = [{ session_id: "suggestion-session", status: "changes-requested" }];
    mount();
    await screen.findByRole("button", { name: "suggestion/draft" });
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/ontology/tree") && new URLSearchParams(r.search).get("branch") === "suggestion/draft")).toBe(true));
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/suggestions/sessions"))).toBe(true));
    fireEvent.click(await screen.findByText("Person"));
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    await editAndSave(label, "Revised label");
    await screen.findByText('Suggested update to "Revised label"');
    fireEvent.click(screen.getByRole("button", { name: /Resubmit Suggestions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
    fireEvent.change(within(dialog).getByLabelText("Describe your changes (optional)"), { target: { value: "Address feedback" } });
    suggestionSubmitStatus = status;
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for Review" }));
    if (status === 403) {
      await screen.findByText(/Submission refused/);
      expect(screen.queryByText("Suggestions submitted as PR #23")).toBeNull();
      suggestionSubmitStatus = 200;
      fireEvent.click(screen.getByRole("button", { name: /Resubmit Suggestions/ }));
      const retryDialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
      fireEvent.change(within(retryDialog).getByLabelText("Describe your changes (optional)"), { target: { value: "Address feedback" } });
      fireEvent.click(within(retryDialog).getByRole("button", { name: "Submit for Review" }));
    }
    await screen.findByText("Suggestions submitted as PR #23");
    expect(screen.queryByRole("button", { name: /Resubmit Suggestions/ })).toBeNull();
    expect(requests.filter(r => r.path.endsWith("/suggestions/sessions") && r.method === "POST")).toEqual([]);
    expect(requests.find(r => r.path.endsWith("/suggestion-session/resubmit"))).toMatchObject({ method: "POST", authorization: "Bearer route-fixture-token" });
    expect(suggestionSubmissions).toEqual(Array.from({ length: status === 403 ? 2 : 1 }, () => ({ summary: "Address feedback" })));
    expect(savedBodies).toEqual([]);
  });

  it.each([200, 403])("resumes a changed session URL after branch initialization and resubmits (HTTP %i)", async status => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    boundary.search = new URLSearchParams({ branch: "suggestion/draft" });
    extraBranches = [{ name: "suggestion/draft", is_current: false }];
    resumableSessions = [{ session_id: "suggestion-session", status: "changes-requested" }];
    const view = mount();
    await screen.findByRole("button", { name: "suggestion/draft" });
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/ontology/tree") && new URLSearchParams(r.search).get("branch") === "suggestion/draft")).toBe(true));
    boundary.search = new URLSearchParams({ resumeSession: "suggestion-session", branch: "suggestion/draft" });
    view.rerender(<EditorPage />);
    await waitFor(() => expect(requests.some(r => r.path.endsWith("/suggestions/sessions"))).toBe(true));
    fireEvent.click(await screen.findByText("Person"));
    const label = await screen.findByPlaceholderText("Label text") as HTMLInputElement;
    await waitFor(() => expect(label.value).toBe("Person"));
    await editAndSave(label, "Revised label");
    await screen.findByText('Suggested update to "Revised label"');
    fireEvent.click(screen.getByRole("button", { name: /Resubmit Suggestions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
    fireEvent.change(within(dialog).getByLabelText("Describe your changes (optional)"), { target: { value: "Address feedback" } });
    suggestionSubmitStatus = status;
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for Review" }));
    if (status === 403) {
      await screen.findByText(/Submission refused/);
      expect(screen.queryByText("Suggestions submitted as PR #23")).toBeNull();
      suggestionSubmitStatus = 200;
      fireEvent.click(screen.getByRole("button", { name: /Resubmit Suggestions/ }));
      const retryDialog = await screen.findByRole("dialog", { name: "Submit Suggestions" });
      fireEvent.change(within(retryDialog).getByLabelText("Describe your changes (optional)"), { target: { value: "Address feedback" } });
      fireEvent.click(within(retryDialog).getByRole("button", { name: "Submit for Review" }));
    }
    await screen.findByText("Suggestions submitted as PR #23");
    expect(screen.queryByRole("button", { name: /Resubmit Suggestions/ })).toBeNull();
    expect(requests.filter(r => r.path.endsWith("/suggestions/sessions") && r.method === "POST")).toEqual([]);
    expect(requests.find(r => r.path.endsWith("/suggestion-session/resubmit"))).toMatchObject({ method: "POST", authorization: "Bearer route-fixture-token" });
    expect(suggestionSubmissions).toEqual(Array.from({ length: status === 403 ? 2 : 1 }, () => ({ summary: "Address feedback" })));
    expect(savedBodies).toEqual([]);
  });

  it.each(["submitted", "missing", "forbidden"])("reports an unavailable resumed session (%s) without changing source", async state => {
    projectResponse = { ...projectResponse, user_role: "suggester" };
    boundary.search = new URLSearchParams({ resumeSession: "suggestion-session", branch: "suggestion/draft" });
    extraBranches = [{ name: "suggestion/draft", is_current: false }];
    resumableSessions = state === "submitted" ? [{ session_id: "suggestion-session", status: "submitted" }] : [];
    sessionListStatus = state === "forbidden" ? 403 : 200;
    mount();
    await screen.findByText(state === "forbidden" ? "Failed to verify suggestion session status." : "This suggestion session is no longer available for editing.");
    expect(requests.filter(r => r.path.endsWith("/suggestions/sessions"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Resubmit Suggestions/ })).toBeNull();
    expect(savedBodies).toEqual([]); expect(suggestionBodies).toEqual([]);
  });

  it.each(["beforeunload", "visibilitychange"])("flushes the latest suggestion source through the real beacon API on %s", async event => {
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    projectResponse = { ...projectResponse, user_role: "suggester" };
    const label = await openSuggestionForm("class");
    await editAndSave(label, "Beacon label");
    await screen.findByText('Suggested update to "Beacon label"');
    if (event === "visibilitychange") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      fireEvent(document, new Event(event));
    } else fireEvent(window, new Event(event));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/v1/projects/route-project/suggestions/beacon");
    expect(new URL(url).searchParams.get("token")).toBe("fixture-beacon");
    expect(blob.type).toBe("application/json");
    const payload = JSON.parse(await blob.text());
    expect(payload).toEqual({ session_id: "suggestion-session", content: suggestionBodies[0].content });
    expect(parseBlockTriples(payload.content, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Beacon label", lang: "en" } });
    cleanup();
    fireEvent(window, new Event("beforeunload"));
    fireEvent(document, new Event("visibilitychange"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(savedBodies).toEqual([]);
  });

  it("does not beacon an editor draft before an authenticated suggestion session exists", async () => {
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    projectResponse = { ...projectResponse, user_role: "suggester" };
    await openSuggestionForm("class");
    fireEvent(window, new Event("beforeunload"));
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(suggestionBodies).toEqual([]); expect(savedBodies).toEqual([]);
  });

  it.each([
    ["class", false], ["objectProperty", false], ["individual", false],
  ] as const)("inserts a %s into a mounted source editor through its real imperative chain (empty: %s)", async (entityType, empty) => {
    if (empty) sourceContent = "";
    let text = sourceContent;
    const model = {
      getValue: () => text,
      getLineCount: () => text.split("\n").length,
      getLineMaxColumn: (line: number) => text.split("\n")[line - 1].length + 1,
      isDisposed: () => false,
    };
    const editor = {
      getModel: () => model, onMouseDown: vi.fn(), revealLineInCenter: vi.fn(), setPosition: vi.fn(), focus: vi.fn(),
      executeEdits: vi.fn((_origin: string, edits: { text: string; range: { startLineNumber: number; startColumn: number } }[]) => {
        for (const edit of edits) {
          expect(edit.range).toMatchObject({ startLineNumber: model.getLineCount(), startColumn: model.getLineMaxColumn(model.getLineCount()) });
          text += edit.text;
        }
        return true;
      }),
    };
    const monaco = { editor: { setModelMarkers: vi.fn() } };
    // A source reload can remount Monaco. Initialize every mounted boundary,
    // just as the real renderer invokes onMount for each editor instance.
    boundary.mountMonaco = (props) => {
      text = props.value;
      props.onMount(editor, monaco);
    };
    mount(); await screen.findByText("Person");
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    // The first textarea can precede the branch source response. Wait for the
    // loaded document and its mounted editor before exercising the imperative path.
    await waitFor(() => {
      expect((screen.getByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement).value).toBe(sourceContent);
      expect(editor.onMouseDown).toHaveBeenCalled();
    });
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Add Entity" });
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Inserted entity" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: entityType } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    fireEvent.change(within(dialog).getByLabelText("IRI"), { target: { value: "https://example.test/NewEntity" } });
    const create = within(dialog).getByRole("button", { name: "Create" });
    await waitFor(() => expect(create.hasAttribute("disabled")).toBe(false));
    fireEvent.click(create);
    expect(editor.executeEdits).toHaveBeenCalledTimes(1);
    const source = screen.getByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement;
    await waitFor(() => expect(source.value).toContain('"Inserted entity"'));
    expect(editor.executeEdits.mock.calls[0][0]).toBe("add-entity");
    expect(source.value).toBe(model.getValue());
    if (!empty) expect(parseBlockTriples(source.value, iri)).toEqual(parseBlockTriples(originalSource, iri));
    expect(editor.revealLineInCenter).toHaveBeenCalledWith(model.getLineCount());
    expect(editor.focus).toHaveBeenCalled();
    expect(savedBodies).toEqual([]);
  });

  it.each([
    { pattern: "named", subjects: ["Existing"], hint: "Derived from label", expected: "NewConcept" },
    { pattern: "base declaration", base: true, subjects: ["Existing"], hint: "Derived from label", expected: "NewConcept" },
    { pattern: "numeric", subjects: ["9", "42"], hint: "Sequential numeric IRI (next: 43)", expected: "43" },
  ])("derives a $pattern IRI from loaded ontology source and preserves its namespace", async ({ subjects, hint, expected, base = false }) => {
    const namespace = "https://vocabulary.test/custom#";
    sourceContent = '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n' + (base ? '@base <' : '@prefix custom: <') + namespace + '> .\n' + subjects.map(name => '<' + namespace + name + '> a owl:Class .').join("\n");
    const original = sourceContent;
    mount(); await screen.findByText("Person");
    await act(async () => { fireEvent.mouseEnter(screen.getByRole("button", { name: "Source" })); });
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    const dialog = await screen.findByRole("dialog", { name: "Add Entity" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Advanced" }));
    await within(dialog).findByText(hint);
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "New concept" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "objectProperty" } });
    expect((within(dialog).getByLabelText("IRI") as HTMLInputElement).value).toBe(namespace + expected);
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const source = await screen.findByRole("textbox", { name: "Turtle source boundary" }) as HTMLTextAreaElement;
    await waitFor(() => expect(source.value).toContain('"New concept"'));
    expect(source.value).toContain(original);
    expect(parseBlockTriples(source.value, namespace + expected)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "New concept", lang: "en" } });
    expect(savedBodies).toEqual([]);
  });

});

it("retains anonymous proposal source and retry/discard controls after submission is denied", async () => {
  await saveAnonymousProposal();
  const sourceBeforeSubmit = suggestionBodies[0].content;
  anonymousFailure = "submit";
  fireEvent.click(screen.getByRole("button", { name: /Submit Proposal/ }));
  fireEvent.click(within(await screen.findByRole("dialog", { name: "Want credit for your suggestions?" })).getByRole("button", { name: "Skip" }));
  await screen.findByText("Proposal error");
  expect(screen.getByRole("button", { name: /Submit Proposal/ })).toBeDefined();
  expect(screen.getByRole("button", { name: "Discard" })).toBeDefined();
  expect(useAnonymousTokenStore.getState().getToken("route-project")?.sessionId).toBe("anonymous-session");
  expect(screen.queryByRole("dialog", { name: "Thank you — your proposal is in" })).toBeNull();
  anonymousFailure = null;
  fireEvent.click(screen.getByRole("button", { name: /Submit Proposal/ }));
  fireEvent.click(within(await screen.findByRole("dialog", { name: "Want credit for your suggestions?" })).getByRole("button", { name: "Skip" }));
  await screen.findByRole("dialog", { name: "Thank you — your proposal is in" });
  expect(anonymousSubmissions).toHaveLength(2);
  expect(requests.filter(r => r.path.endsWith("/anonymous/sessions"))).toHaveLength(1);
  expect(requests.filter(r => r.path.endsWith("/anonymous-session/submit"))).toHaveLength(2);
  expect(suggestionBodies).toHaveLength(1);
  expect(suggestionBodies[0].content).toBe(sourceBeforeSubmit);
  expect(savedBodies).toEqual([]);
});
