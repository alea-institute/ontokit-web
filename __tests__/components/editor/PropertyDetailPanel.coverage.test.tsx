import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PropertyDetailPanel } from "@/components/editor/PropertyDetailPanel";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useDraftStore, draftKey } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { projectOntologyApi } from "@/lib/api/client";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { updatePropertyInTurtle, type TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";

const ns = "http://example.org/panel#";
const iri = ns + "relation";
const source = `@prefix : <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
:relation a owl:ObjectProperty ; rdfs:label "Relation"@en ;
 rdfs:comment "Original comment"@en ; skos:definition "Original definition"@en ;
 skos:example "Original example"@en ; rdfs:domain :Person ; rdfs:range :Place ;
 rdfs:subPropertyOf :parent ; owl:inverseOf :inverse ;
 rdfs:seeAlso :reference ; rdfs:isDefinedBy :ontology .
`;
const hints = Object.fromEntries(["Person", "Place", "parent", "inverse", "reference", "ontology"].map(s => [ns + s, s]));
const key = draftKey("coverage-property", "main", iri);
const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
function mount(onUpdateProperty = vi.fn<(iri: string, data: TurtlePropertyUpdateData) => Promise<void>>().mockResolvedValue(undefined), sourceContent = source) {
  return { ...render(<TooltipProvider><ToastProvider><PropertyDetailPanel projectId="coverage-property" propertyIri={iri} sourceContent={sourceContent} canEdit onUpdateProperty={onUpdateProperty} labelHints={hints} /></ToastProvider></TooltipProvider>), onUpdateProperty };
}
function editLabel(value: string) {
  const input = screen.getByPlaceholderText("Label text");
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}
beforeEach(() => {
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ showManualSaveButton: true });
  vi.spyOn(projectOntologyApi, "searchEntities").mockResolvedValue({ results: [], total: 0 });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); useDraftStore.setState({ drafts: {} });
  if (scrollDescriptor) Object.defineProperty(Element.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe("property panel real editing chain", () => {
  it.each(["remove", "unchanged", "change predicate"])("persists relationship %s exactly once through the real writer", async action => {
    let output = source;
    mount(vi.fn(async (entity, data) => { output = updatePropertyInTurtle(output, entity, data); }));
    if (action === "remove") {
      fireEvent.click(within(screen.getByTitle(ns + "reference").parentElement!).getByTitle("Remove"));
    } else if (action === "change predicate") {
      vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({ results: [{ iri: ns + "custom", label: "Custom relation", entity_type: "property", deprecated: false }], total: 1 });
      fireEvent.click(screen.getByRole("button", { name: "See Also" }));
      fireEvent.change(screen.getByPlaceholderText("Search properties..."), { target: { value: "custom" } });
      fireEvent.click(await screen.findByRole("button", { name: "Custom relation" }));
    } else editLabel("Changed label");
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const parsed = extractPropertyDetail(output, iri)!;
    expect(parsed.seeAlsoIris).toEqual(action === "unchanged" ? [ns + "reference"] : []);
    expect(parsed.isDefinedByIris).toEqual([ns + "ontology"]);
    expect(parsed.annotations.find(a => a.property_iri.endsWith("#example"))?.values).toEqual([{ value: "Original example", lang: "en" }]);
    const triples = parseBlockTriples(output, iri)!;
    expect(triples.filter(t => t.predicate === ns + "custom").map(t => t.object)).toEqual(action === "change predicate" ? [{ type: "iri", value: ns + "reference" }] : []);
  });

  it.each(["edit", "remove"])("can %s one annotation value without losing sibling values or other predicates", async action => {
    const inputSource = source.replace('skos:example "Original example"@en', 'skos:example "Original example"@en, "Sibling example"@en ; skos:note "Retained note"@en');
    let output = inputSource;
    mount(vi.fn(async (target, data) => { output = updatePropertyInTurtle(output, target, data); }), inputSource);
    const input = screen.getByDisplayValue("Original example");
    if (action === "edit") {
      fireEvent.change(input, { target: { value: "Edited example" } });
      fireEvent.blur(input);
    } else {
      fireEvent.click(within(input.parentElement!).getByRole("button", { name: /Remove .* annotation/ }));
    }
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const detail = extractPropertyDetail(output, iri)!;
    const examples = detail.annotations.find(annotation => annotation.property_iri.endsWith("#example"))!.values;
    expect(examples).toEqual(action === "edit" ? [{ value: "Edited example", lang: "en" }, { value: "Sibling example", lang: "en" }] : [{ value: "Sibling example", lang: "en" }]);
    expect(detail.annotations.find(annotation => annotation.property_iri.endsWith("#note"))?.values).toEqual([{ value: "Retained note", lang: "en" }]);
    expect(detail.labels).toEqual([{ value: "Relation", lang: "en" }]);
    expect(detail.domainIris).toEqual([ns + "Person"]);
  });

  it.each([
    ["labels", "rdfs:label", "Relation"],
    ["comments", "rdfs:comment", "Original comment"],
    ["definitions", "skos:definition", "Original definition"],
  ] as const)("edits one of several %s while preserving the other language and property constraints", async (field, predicate, original) => {
    const inputSource = source.replace(`${predicate} "${original}"@en`, `${predicate} "${original}"@en, "Valeur française"@fr`);
    let output = inputSource;
    mount(vi.fn(async (target, data) => { output = updatePropertyInTurtle(output, target, data); }), inputSource);
    const input = screen.getByDisplayValue("Valeur française");
    fireEvent.change(input, { target: { value: "Valeur modifiée" } });
    fireEvent.blur(input);
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const detail = extractPropertyDetail(output, iri)!;
    expect(detail[field]).toEqual(expect.arrayContaining([{ value: original, lang: "en" }, { value: "Valeur modifiée", lang: "fr" }]));
    expect(detail[field]).toHaveLength(2);
    expect(detail.domainIris).toEqual([ns + "Person"]);
    expect(detail.rangeIris).toEqual([ns + "Place"]);
    expect(detail.parentIris).toEqual([ns + "parent"]);
  });

  it.each(["Person", "Place", "parent", "inverse"])("navigates the parsed %s reference from edit mode without creating a draft", (target) => {
    const navigate = vi.fn();
    render(<TooltipProvider><ToastProvider><PropertyDetailPanel projectId="coverage-property" propertyIri={iri} sourceContent={source} canEdit onUpdateProperty={vi.fn()} labelHints={hints} onNavigateToEntity={navigate} /></ToastProvider></TooltipProvider>);
    fireEvent.click(screen.getByTitle(ns + target));
    expect(navigate).toHaveBeenCalledExactlyOnceWith(ns + target);
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it("persists a definition language selected in the real picker and a blurred annotation value", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    let output = source;
    mount(vi.fn(async (entity, data) => { output = updatePropertyInTurtle(output, entity, data); }));
    const definition = screen.getByDisplayValue("Original definition");
    fireEvent.click(within(definition.parentElement!).getByRole("button", { name: "Language tag" }));
    fireEvent.click(screen.getByRole("option", { name: /French\s*Français\s*fr$/ }));
    fireEvent.blur(definition);
    const example = screen.getByDisplayValue("Original example");
    fireEvent.change(example, { target: { value: "An edited example" } }); fireEvent.blur(example);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)).toMatchObject({ definitions: [{ value: "Original definition", lang: "fr" }, { value: "", lang: "en" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const detail = extractPropertyDetail(output, iri)!;
    expect(detail.definitions).toEqual([{ value: "Original definition", lang: "fr" }]);
    expect(detail.annotations.find(item => item.property_iri.endsWith("#example"))?.values).toEqual([{ value: "An edited example", lang: "en" }]);
  });

  it("saves parsed edits through the actual draft store and Turtle updater without blank placeholders", async () => {
    let output = source;
    const save = vi.fn(async (entity: string, data: TurtlePropertyUpdateData) => { output = updatePropertyInTurtle(output, entity, data); });
    mount(save);
    editLabel("Revised relation");
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Revised relation");
    fireEvent.change(screen.getByDisplayValue("Original example"), { target: { value: "Revised example" } });
    fireEvent.click(screen.getByLabelText("Functional"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const detail = extractPropertyDetail(output, iri)!;
    expect(detail.labels).toEqual([{ value: "Revised relation", lang: "en" }]);
    expect(detail.characteristics).toContain("http://www.w3.org/2002/07/owl#FunctionalProperty");
    expect(detail.annotations.find(a => a.property_iri.endsWith("#example"))?.values).toEqual([{ value: "Revised example", lang: "en" }]);
    expect(save.mock.calls[0][1].annotations?.every(a => a.values.every(v => v.value.trim()))).toBe(true);
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it("validates blank labels then cancels back to parsed source and clears the draft", () => {
    const { onUpdateProperty } = mount();
    editLabel("Changed");
    editLabel("  ");
    expect(screen.getByText("At least one label is required")).toBeDefined();
    expect(onUpdateProperty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((screen.getByPlaceholderText("Label text") as HTMLInputElement).value).toBe("Relation");
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
    expect(screen.queryByText("At least one label is required")).toBeNull();
  });

  it("retains a failed save for retry and flushes the latest draft successfully", async () => {
    const save = vi.fn<(iri: string, data: TurtlePropertyUpdateData) => Promise<void>>().mockRejectedValueOnce(new Error("Commit unavailable")).mockResolvedValue(undefined);
    mount(save); editLabel("Retry relation");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Commit unavailable");
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Retry relation");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Saved");
    expect(save).toHaveBeenCalledTimes(2);
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it.each([
    ["Search classes for domain...", "Person", "domainIris", "class"],
    ["Search classes for range...", "Place", "rangeIris", "class"],
    ["Search parent properties...", "parent", "parentIris", "property"],
    ["Search inverse property...", "inverse", "inverseOf", "property"],
  ])("searches, removes, and adds through %s", async (placeholder, existing, field, filter) => {
    const { onUpdateProperty } = mount();
    const existingButton = screen.getByTitle(ns + existing);
    fireEvent.click(within(existingButton.parentElement!).getByTitle("Remove"));
    const input = screen.getByPlaceholderText(placeholder);
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({ results: [{ iri: ns + "newTarget", label: "New target", entity_type: "class", deprecated: false }], total: 1 });
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "  new  " } });
    fireEvent.click(await screen.findByText("New target"));
    expect(projectOntologyApi.searchEntities).toHaveBeenCalledWith("coverage-property", "new", undefined, undefined, filter);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    expect(onUpdateProperty.mock.calls[0][1][field as keyof TurtlePropertyUpdateData]).toEqual(field === "inverseOf" ? ns + "newTarget" : [ns + "newTarget"]);
    if (field === "inverseOf") expect(screen.queryByPlaceholderText(placeholder)).toBeNull();
    else expect((screen.getByPlaceholderText(placeholder) as HTMLInputElement).value).toBe("");
  });

  it("handles search rejection, hides results outside the field, and filters existing targets", async () => {
    mount();
    vi.mocked(projectOntologyApi.searchEntities).mockRejectedValueOnce(new Error("Offline"));
    const input = screen.getByPlaceholderText("Search classes for domain...");
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "offline" } });
    await screen.findByText("No results found");
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("No results found")).toBeNull();
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({ results: [{ iri: ns + "Person", label: "Duplicate result", entity_type: "class", deprecated: false }], total: 1 });
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "person" } });
    await screen.findByText("No results found");
    expect(screen.queryByText("Duplicate result")).toBeNull();
  });
});
