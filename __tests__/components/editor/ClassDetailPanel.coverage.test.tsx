import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import type { GeneratedSuggestion } from "@/lib/api/generation";
import { llmHookHarness, jsonResponse } from "@/__tests__/fixtures/llm-hook-harness";

const iri = "https://example.test/Person";
const scope = { projectId: "class-panel-coverage", branch: "main" };
const key = draftKey(scope.projectId, scope.branch, iri);
const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
const definition = "http://www.w3.org/2004/02/skos/core#definition";
const seeAlso = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
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
let fetcher: ReturnType<typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>>;
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
afterEach(() => { if (scrollDescriptor) Object.defineProperty(Element.prototype, "scrollIntoView", scrollDescriptor); else Reflect.deleteProperty(Element.prototype, "scrollIntoView"); cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.restoreAllMocks(); useDraftStore.setState({ drafts: {} }); useSuggestionStore.getState().clearAllSuggestions(); });
async function savePanel() {
  await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved");
}
describe("class detail real editing and suggestion chains", () => {
  it.each(["Definition", "Example"])("retries a failed %s status check and renders the provisional result", async (field) => {
    const predicate = field === "Definition" ? "skos:definition" : "skos:example";
    if (field === "Example") currentDetail.annotations.push({ property_iri: "http://www.w3.org/2004/02/skos/core#example", property_label: "Example", values: [{ value: "Existing example", lang: "en" }] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let requested = 0;
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("translate-field")) { requested++; return jsonResponse({ job_id: "job" }); }
      if (url.includes("entity-state") && requested === 1) return jsonResponse({ detail: "Status unavailable" }, 403);
      if (url.includes("entity-state") && requested === 2) return jsonResponse({ entity_iri: iri, branch: "main", items: [{ predicate, language: "fr", state: "provisional", value: "Texte traduit", record_id: "record" }] });
      return original(input);
    });
    mount({ accessToken: "token", canEdit: false });
    fireEvent.click(await screen.findByRole("button", { name: `Translate ${field}` }));
    await screen.findByText(/Translation status could not be checked/);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Texte traduit")).toBeDefined();
    expect(requested).toBe(2);
    expect(screen.queryByText(/Translation status could not be checked/)).toBeNull();
    expect(screen.getByText(field === "Definition" ? "Existing definition" : "Existing example")).toBeDefined();
  });

  it("saves a definition language and blurred comment through the draft and Turtle writer", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    mount();
    const field = await screen.findByDisplayValue("Existing definition");
    fireEvent.click(within(field.parentElement!).getByRole("button", { name: "Language tag" }));
    fireEvent.click(screen.getByRole("option", { name: /French\s*Français\s*fr$/ }));
    fireEvent.blur(field);
    const comment = screen.getByPlaceholderText("Add another Comment — or translation.");
    fireEvent.change(comment, { target: { value: "A useful comment" } });
    fireEvent.blur(comment);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)?.comments).toContainEqual({ value: "A useful comment", lang: "en" }));
    await savePanel();
    const triples = parseBlockTriples(output, iri);
    expect(triples).toContainEqual({ predicate: definition, object: { type: "literal", value: "Existing definition", lang: "fr" } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#comment", object: { type: "literal", value: "A useful comment", lang: "en" } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Person", lang: "en" } });
  });
  it("edits through the fetched panel, durable draft and Turtle writer then parses the result", async () => {
    const { save } = mount();
    const input = await screen.findByPlaceholderText("Label text");
    fireEvent.change(input, { target: { value: "Edited person" } }); fireEvent.blur(input);
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Edited person");
    await savePanel();
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Edited person", lang: "en" } });
    expect(save).toHaveBeenCalledTimes(1); expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
    expect(useEditorModeStore.getState().hasSeenAutoSaveToast).toBe(false);
  });
  it.each([definition, "http://www.w3.org/2004/02/skos/core#example"])("accepts an annotation into existing or new %s and writes the real source", async (property) => {
    seed("annotations", { property_iri: property, value: "Suggested text", lang: "fr" });
    mount(); await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)?.annotations.some(a => a.property_iri === property && a.values.some(v => v.value === "Suggested text"))).toBe(true));
    await savePanel();
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: property, object: { type: "literal", value: "Suggested text", lang: "fr" } });
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: definition, object: { type: "literal", value: "Existing definition", lang: "en" } });
  });
  it.each([seeAlso, "http://www.w3.org/2000/01/rdf-schema#isDefinedBy"])("accepts a relationship into existing or new %s group and writes its IRI", async (property) => {
    seed("edges", { relationship_type: property, target_iri: "https://example.test/Target" });
    mount(); await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)?.relationships.some(g => g.property_iri === property && g.targets.some(t => t.iri === "https://example.test/Target"))).toBe(true));
    await savePanel();
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: property, object: { type: "iri", value: "https://example.test/Target" } });
  });
  it("accepts an edited parent label and persists the parent IRI without minting a child", async () => {
    seed("parents"); const create = vi.fn(); mount({ onAddSuggestedChild: create });
    await screen.findByPlaceholderText("Label text");
    fireEvent.click(screen.getByRole("button", { name: "Edit suggestion before accepting" }));
    const input = screen.getAllByRole("textbox").find(input => (input as HTMLInputElement).value === "Suggested content")!;
    fireEvent.change(input, { target: { value: "Specific parent" } }); fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      const draft = useDraftStore.getState().getDraft(key);
      if (!draft || (draft.entityType && draft.entityType !== "class")) throw new Error("Expected a class draft");
      expect(draft.parentLabels["https://example.test/Suggested"]).toBe("Specific parent");
    });
    await savePanel();
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: "https://example.test/Suggested" } });
    expect(create).not.toHaveBeenCalled();
    expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, "parents")][0].status).toBe("accepted");
  });
  it("preserves a failed write as a draft and retries the current changes", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("Commit failed")).mockResolvedValue(undefined);
    mount({ onUpdateClass: save });
    const input = await screen.findByPlaceholderText("Label text");
    fireEvent.change(input, { target: { value: "Retry person" } }); fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Commit failed");
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Retry person");
    fireEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("Saved");
    expect(save).toHaveBeenCalledTimes(2); expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });
  it("validates blank labels and cancels without flushing the discarded edit on unmount", async () => {
    const { save, unmount } = mount(); const input = await screen.findByPlaceholderText("Label text");
    fireEvent.change(input, { target: { value: " " } }); fireEvent.blur(input);
    expect(screen.getByText("At least one label is required")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((screen.getByPlaceholderText("Label text") as HTMLInputElement).value).toBe("Person");
    unmount(); expect(save).not.toHaveBeenCalled(); expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });
  it("restores persisted edits and automatically flushes them through the writer on navigation", async () => {
    useDraftStore.getState().setDraft(key, { labels: [{ value: "Restored person", lang: "en" }], comments: [], parentIris: [], parentLabels: {}, annotations: [], relationships: [], updatedAt: Date.now() });
    const { unmount, save } = mount();
    await screen.findByDisplayValue("Restored person"); unmount();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(parseBlockTriples(output, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Restored person", lang: "en" } });
    expect(useEditorModeStore.getState().hasSeenAutoSaveToast).toBe(true);
  });
  it("leaves server data read-only when edit permission is absent", async () => {
    const { save, unmount } = mount({ canEdit: false, canUseLLM: false });
    await screen.findByText("Existing definition");
    expect(screen.queryByPlaceholderText("Label text")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    unmount(); expect(save).not.toHaveBeenCalled();
  });
  it("cancels field translation before issuing a mutation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mount({ accessToken: "token", canEdit: false });
    fireEvent.click(await screen.findByRole("button", { name: "Translate Definition" }));
    expect(window.confirm).toHaveBeenCalledWith("Translate this definition into the configured languages?");
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("translate-field"))).toBe(false);
  });
  it("retries a failed field translation and displays the newly fetched provisional value", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let requested = 0;
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("translate-field")) {
        requested++;
        return requested === 1 ? jsonResponse({ detail: "Translation unavailable" }, 503) : jsonResponse({ job_id: "job" });
      }
      if (url.includes("entity-state") && requested > 1) return jsonResponse({ entity_iri: iri, branch: "main", items: [{ predicate: "skos:definition", language: "fr", state: "provisional", value: "Une personne", record_id: "record" }] });
      return original(input);
    });
    mount({ accessToken: "token", canEdit: false });
    fireEvent.click(await screen.findByRole("button", { name: "Translate Definition" }));
    await screen.findByText("Translation unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Une personne");
    expect(requested).toBe(2);
    expect(screen.getByRole("button", { name: "Translate Definition" })).toBeDefined();
    expect(screen.queryByText("Translation unavailable")).toBeNull();
  });

});
