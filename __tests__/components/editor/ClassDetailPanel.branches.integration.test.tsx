import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ClassDetailPanel } from "@/components/editor/ClassDetailPanel";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useDraftStore, draftKey } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import type { OWLClassDetail, ClassUpdatePayload } from "@/lib/api/client";
import { persistGeneratedEntity } from "@/lib/editor/generatedEntityPersistence";
import type { GeneratedSuggestion } from "@/lib/api/generation";
import { llmHookHarness, jsonResponse } from "@/__tests__/fixtures/llm-hook-harness";

const iri = "https://example.test/Person";
const scope = { projectId: "class-panel-branches", branch: "main" };
const key = draftKey(scope.projectId, scope.branch, iri);
const definition = "http://www.w3.org/2004/02/skos/core#definition";
const source = `@prefix : <https://example.test/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
:Person a owl:Class ; rdfs:label "Person"@en ; skos:definition "Existing definition"@en .`;
function detail(): OWLClassDetail {
  return { iri, labels: [{ value: "Person", lang: "en" }], comments: [], parent_iris: [], parent_labels: {}, annotations: [{ property_iri: definition, property_label: "Definition", values: [{ value: "Existing definition", lang: "en" }] }], deprecated: false, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, is_defined: true };
}
let currentDetail: OWLClassDetail;
let output: string;
let fetcher: ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;
const clients: ReturnType<typeof llmHookHarness>["client"][] = [];
function seed(type: GeneratedSuggestion["suggestion_type"], extras: Partial<GeneratedSuggestion> = {}) {
  useSuggestionStore.getState().setSuggestions(scope, iri, type, [{ iri: "https://example.test/Suggested", label: "Suggested content", suggestion_type: type, provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [], ...extras }]);
}
function mount(props: Partial<Parameters<typeof ClassDetailPanel>[0]> = {}) {
  const { client } = llmHookHarness(); clients.push(client);
  const save = vi.fn(async (target: string, payload: ClassUpdatePayload) => {
    output = updateClassInTurtle(output, target, { ...payload, labels: payload.labels ?? [], comments: payload.comments ?? [], parent_iris: payload.parent_iris ?? [] });
  });
  return { save, ...render(<QueryClientProvider client={client}><TooltipProvider><ToastProvider><ClassDetailPanel {...scope} classIri={iri} canEdit canUseLLM onUpdateClass={save} {...props} /></ToastProvider></TooltipProvider></QueryClientProvider>) };
}
beforeEach(() => {
  currentDetail = detail(); output = source;
  useDraftStore.setState({ drafts: {} }); useSuggestionStore.getState().clearAllSuggestions();
  useEditorModeStore.setState({ showManualSaveButton: true, hasSeenAutoSaveToast: false });
  fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/ontology/classes/")) return jsonResponse(currentDetail);
    if (url.includes("/lint/")) return jsonResponse({ items: [] });
    if (url.includes("/translation/config")) return jsonResponse({ language_tags: ["fr"] });
    if (url.includes("/translation/palette")) return jsonResponse([]);
    if (url.includes("/translation/entity-state")) return jsonResponse({ items: [] });
    return jsonResponse({ items: [], results: [], total: 0 });
  }); vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.restoreAllMocks(); useDraftStore.setState({ drafts: {} }); useSuggestionStore.getState().clearAllSuggestions(); });
async function savePanel() {
  await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved");
}
describe("class panel remaining real acceptance and request boundaries", () => {
  it.each(["remove", "change predicate"])("persists relationship %s while preserving another relationship and annotation", async action => {
    const seeAlso = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
    const definedBy = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
    output = source.replace('skos:definition "Existing definition"@en .', 'skos:definition "Existing definition"@en ; rdfs:seeAlso :Reference ; rdfs:isDefinedBy :Ontology ; skos:note "Preserved unseen annotation" .');
    currentDetail.annotations!.push(
      { property_iri: seeAlso, property_label: "See Also", values: [{ value: "https://example.test/Reference", lang: "" }] },
      { property_iri: definedBy, property_label: "Defined By", values: [{ value: "https://example.test/Ontology", lang: "" }] },
    );
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((input, init) => String(input).includes("/search") ? Promise.resolve(jsonResponse({ results: [{ iri: "https://example.test/custom", label: "Custom relation", entity_type: "property", deprecated: false }], total: 1 })) : original(input, init));
    mount();
    await screen.findByDisplayValue("Person");
    if (action === "remove") fireEvent.click(within(screen.getByTitle("https://example.test/Reference").parentElement!).getByTitle("Remove"));
    else {
      fireEvent.click(screen.getByRole("button", { name: "See Also" }));
      fireEvent.change(screen.getByPlaceholderText("Search properties..."), { target: { value: "custom" } });
      fireEvent.click(await screen.findByRole("button", { name: "Custom relation" }));
    }
    await savePanel();
    const triples = parseBlockTriples(output, iri)!;
    expect(triples.filter(t => t.predicate === seeAlso)).toEqual([]);
    expect(triples.filter(t => t.predicate === definedBy).map(t => t.object)).toEqual([{ type: "iri", value: "https://example.test/Ontology" }]);
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2004/02/skos/core#note", object: { type: "literal", value: "Preserved unseen annotation" } });
    expect(triples.filter(t => t.predicate === "https://example.test/custom").map(t => t.object)).toEqual(action === "change predicate" ? [{ type: "iri", value: "https://example.test/Reference" }] : []);
  });

  it.each(["success", "failure"] as const)("keeps the newly selected class visible after a late previous-class %s", async outcome => {
    const nextIri = "https://example.test/Next";
    let complete!: (response: Response) => void;
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith(encodeURIComponent(iri))) return new Promise(resolve => { complete = resolve; });
      if (path.endsWith(encodeURIComponent(nextIri))) return Promise.resolve(jsonResponse({ ...detail(), iri: nextIri, labels: [{ value: "Next class", lang: "en" }] }));
      return original(input, init);
    });
    const { client, wrapper } = llmHookHarness(); clients.push(client);
    const panel = (classIri: string) => <TooltipProvider><ToastProvider><ClassDetailPanel {...scope} classIri={classIri} canEdit={false} canUseLLM={false} /></ToastProvider></TooltipProvider>;
    const view = render(panel(iri), { wrapper });
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    view.rerender(panel(nextIri));
    await screen.findByRole("heading", { name: "Next class" });
    await act(async () => complete(outcome === "success" ? jsonResponse(detail()) : jsonResponse({ detail: "Late error" }, 403)));
    expect(screen.getByRole("heading", { name: "Next class" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Person" })).toBeNull();
    expect(screen.queryByText("Late error")).toBeNull();
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it.each(["children", "siblings"] as const)("persists an edited %s suggestion through authoritative source and the API", async type => {
    const parent = "https://example.test/Ancestor";
    currentDetail.parent_iris = [parent]; currentDetail.parent_labels = { [parent]: "Ancestor" };
    seed(type, { model: "test-model", prompt_template: "class-template" });
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        expect(body.base_revision).toBe("before");
        output = body.content;
        return jsonResponse({ success: true, commit_hash: "after", branch: "main" });
      }
      if (String(input).includes("/revisions/")) return jsonResponse({ content: output, revision: "before" });
      return original(input, init);
    });
    mount({ accessToken: "synthetic-token", onAddSuggestedChild: async (childIri, label, parentIri, provenance) => {
      await persistGeneratedEntity({ mode: "direct", ...scope, accessToken: "synthetic-token", entity: { iri: childIri, label, parentIri, provenance, entityType: "class" } });
    } });
    await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getByRole("button", { name: "Edit suggestion before accepting" }));
    const input = screen.getAllByRole("textbox").find(input => (input as HTMLInputElement).value === "Suggested content")!;
    fireEvent.change(input, { target: { value: "Edited suggestion" } }); fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, type)][0].status).toBe("accepted"));
    const triples = parseBlockTriples(output, "https://example.test/Suggested");
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: type === "children" ? iri : parent } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Edited suggestion", lang: "en" } });
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: definition, object: { type: "literal", value: "Existing definition", lang: "en" } });
  });

  it.each(["children", "siblings"] as const)("retains a %s suggestion when its persistence callback is unavailable", async type => {
    currentDetail.parent_iris = ["https://example.test/Ancestor"];
    seed(type); mount(); await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
    await screen.findByText(/Generated entity persistence is unavailable/);
    expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, type)][0].status).toBe("pending");
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it.each(["success", "failure"] as const)("ignores a late class-detail %s after the panel unmounts", async outcome => {
    let complete!: (response: Response) => void;
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((input, init) => String(input).includes("/ontology/classes/") ? new Promise(resolve => { complete = resolve; }) : original(input, init));
    const { unmount, save } = mount();
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    unmount();
    await act(async () => complete(outcome === "success" ? jsonResponse(currentDetail) : jsonResponse({ detail: "Late error" }, 403)));
    expect(screen.queryByText("Late error")).toBeNull();
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects one suggestion while leaving another available for acceptance", async () => {
    const suggestion = { iri: "https://example.test/First", label: "First suggestion", suggestion_type: "parents" as const, provenance: "llm-proposed" as const, validation_errors: [], duplicate_verdict: "pass" as const, duplicate_candidates: [] };
    useSuggestionStore.getState().setSuggestions(scope, iri, "parents", [suggestion, { ...suggestion, iri: "https://example.test/Second", label: "Second suggestion" }]);
    mount(); await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getAllByRole("button", { name: "Reject suggestion" })[0]);
    expect(screen.queryByText("First suggestion")).toBeNull();
    expect(screen.getByText("Second suggestion")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
    await savePanel();
    const triples = parseBlockTriples(output, iri);
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: "https://example.test/Second" } });
    expect(triples).not.toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: "https://example.test/First" } });
  });

  it("uses an annotation suggestion label and default English when optional value and language are absent", async () => {
    seed("annotations", { property_iri: definition });
    mount(); await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await savePanel();
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: definition, object: { type: "literal", value: "Suggested content", lang: "en" } });
  });
  it.each([
    { type: "siblings" as const, parents: ["https://example.test/Ancestor"], expectedParent: "https://example.test/Ancestor" },
    { type: "siblings" as const, parents: [], expectedParent: iri },
    { type: "annotations" as const, parents: [], expectedParent: null },
  ])("records the correct duplicate scope for $type with parents $parents", async ({ type, parents, expectedParent }) => {
    currentDetail.parent_iris = parents;
    seed(type, { property_iri: type === "annotations" ? definition : undefined, duplicate_verdict: "block", duplicate_candidates: [{ iri: "https://example.test/Existing", label: "Existing", entity_type: "class", score: 0.99, branch: "feature" }] });
    mount({ accessToken: "synthetic-token" });
    await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getAllByRole("button", { name: "Mark Existing as a distinct entity" })[0]);
    fireEvent.change(screen.getByLabelText("Why are these different?"), { target: { value: "Separate meanings" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark as distinct" }));
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, type)][0].suggestion.duplicate_verdict).toBe("pass"));
    const request = fetcher.mock.calls.find(([url]) => String(url).includes("distinct-decisions"));
    expect(request).toBeDefined();
    expect(JSON.parse(String(request![1]?.body))).toMatchObject({ parent_iri: expectedParent, candidate_branch: "feature", entity_type: "class", reason: "Separate meanings" });
    expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, type)][0].suggestion.duplicate_verdict).toBe("pass");
  });

});
