import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IndividualDetailPanel } from "@/components/editor/IndividualDetailPanel";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useDraftStore, draftKey } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { projectOntologyApi } from "@/lib/api/client";
import { extractIndividualDetail } from "@/lib/ontology/entityDetailExtractors";
import { updateIndividualInTurtle, type TurtleIndividualUpdateData } from "@/lib/ontology/turtleIndividualUpdater";

const ns = "http://example.org/panel#";
const iri = ns + "relation";
const source = `@prefix : <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
:age a owl:DatatypeProperty .
:knows a owl:ObjectProperty .
:relation a owl:NamedIndividual, :Person ; rdfs:label "Relation"@en ;
 rdfs:comment "Original comment"@en ; skos:definition "Original definition"@en ;
 skos:example "Original example"@en ; owl:sameAs :alias ; owl:differentFrom :other ;
 :knows :friend ; :age "42" ;
 rdfs:seeAlso :reference ; rdfs:isDefinedBy :ontology .
`;
const hints = Object.fromEntries(["Person", "Place", "parent", "inverse", "reference", "ontology", "alias", "other", "knows", "friend", "age"].map(s => [ns + s, s]));
const key = draftKey("coverage-individual", "main", iri);
function mount(onUpdateIndividual = vi.fn<(iri: string, data: TurtleIndividualUpdateData) => Promise<void>>().mockResolvedValue(undefined)) {
  return { ...render(<TooltipProvider><ToastProvider><IndividualDetailPanel projectId="coverage-individual" individualIri={iri} sourceContent={source} canEdit onUpdateIndividual={onUpdateIndividual} labelHints={hints} /></ToastProvider></TooltipProvider>), onUpdateIndividual };
}
function editLabel(value: string) {
  const input = screen.getAllByPlaceholderText("Label text")[0];
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}
beforeEach(() => {
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ showManualSaveButton: true });
  vi.spyOn(projectOntologyApi, "searchEntities").mockResolvedValue({ results: [], total: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); useDraftStore.setState({ drafts: {} }); });

describe("individual panel real editing chain", () => {
  it("saves parsed edits through the actual draft store and Turtle updater without blank placeholders", async () => {
    let output = source;
    const save = vi.fn(async (entity: string, data: TurtleIndividualUpdateData) => { output = updateIndividualInTurtle(output, entity, data); });
    mount(save);
    editLabel("Revised relation");
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Revised relation");
    fireEvent.change(screen.getByDisplayValue("Original example"), { target: { value: "Revised example" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save", exact: true }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await screen.findByText("Saved");
    const detail = extractIndividualDetail(output, iri)!;
    expect(detail.labels).toEqual([{ value: "Revised relation", lang: "en" }]);
    expect(detail.typeIris).toEqual([ns + "Person"]);
    expect(detail.objectPropertyAssertions).toContainEqual({ propertyIri: ns + "knows", targetIri: ns + "friend" });
    expect(detail.seeAlsoIris).toContain(ns + "reference");
    expect(detail.isDefinedByIris).toContain(ns + "ontology");
    expect(detail.annotations.find(a => a.property_iri.endsWith("#example"))?.values).toEqual([{ value: "Revised example", lang: "en" }]);
    expect(save.mock.calls[0][1].annotations?.every(a => a.values.every(v => v.value.trim()))).toBe(true);
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it("validates blank labels then cancels back to parsed source and clears the draft", () => {
    const { onUpdateIndividual } = mount();
    editLabel("Changed");
    editLabel("  ");
    expect(screen.getByText("At least one label is required")).toBeDefined();
    expect(onUpdateIndividual).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((screen.getAllByPlaceholderText("Label text")[0] as HTMLInputElement).value).toBe("Relation");
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
    expect(screen.queryByText("At least one label is required")).toBeNull();
  });

  it("retains a failed save for retry and flushes the latest draft successfully", async () => {
    const save = vi.fn<(iri: string, data: TurtleIndividualUpdateData) => Promise<void>>().mockRejectedValueOnce(new Error("Commit unavailable")).mockResolvedValue(undefined);
    mount(save); editLabel("Retry relation");
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await screen.findByText("Commit unavailable");
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Retry relation");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Saved");
    expect(save).toHaveBeenCalledTimes(2);
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it.each([
    ["Search classes...", "Person", "typeIris", "class", 0],
    ["Search individuals...", "alias", "sameAsIris", "individual", 0],
    ["Search individuals...", "other", "differentFromIris", "individual", 1],
  ] as const)("edits %s target %s through the real search control", async (placeholder, existing, field, filter, index) => {
    const { onUpdateIndividual } = mount();
    fireEvent.click(within(screen.getByTitle(ns + existing).parentElement!).getByTitle("Remove"));
    const input = screen.getAllByPlaceholderText(placeholder)[index];
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({ results: [{ iri: ns + "newTarget", label: "New target", entity_type: "class" }], total: 1 });
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "  new  " } });
    fireEvent.click(await screen.findByText("New target"));
    expect(projectOntologyApi.searchEntities).toHaveBeenCalledWith("coverage-individual", "new", undefined, undefined, filter);
    await waitFor(() => expect(useDraftStore.getState().getDraft(key)).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await screen.findByText("Saved");
    expect(onUpdateIndividual.mock.calls[0][1][field]).toEqual([ns + "newTarget"]);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("recovers after rejected search and filters the already asserted class", async () => {
    mount();
    vi.mocked(projectOntologyApi.searchEntities).mockRejectedValueOnce(new Error("Offline"));
    const input = screen.getByPlaceholderText("Search classes...");
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "offline" } });
    await screen.findByText("No results");
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("No results")).toBeNull();
    vi.mocked(projectOntologyApi.searchEntities).mockResolvedValue({ results: [{ iri: ns + "Person", label: "Duplicate result", entity_type: "class" }], total: 1 });
    fireEvent.focus(input); fireEvent.change(input, { target: { value: "person" } });
    await screen.findByText("No results");
    expect(screen.queryByText("Duplicate result")).toBeNull();
  });

  it("flushes relationship and assertion removals into the real Turtle source on unmount", async () => {
    let output = source;
    const save = vi.fn(async (entity: string, data: TurtleIndividualUpdateData) => { output = updateIndividualInTurtle(output, entity, data); });
    const { unmount } = mount(save);
    for (const target of ["reference", "ontology", "friend"]) {
      fireEvent.click(within(screen.getByTitle(ns + target).parentElement!).getByTitle("Remove"));
    }
    fireEvent.click(within(screen.getByText("42").parentElement!).getByTitle("Remove"));
    // The panel schedules draft capture after child state changes.
    await waitFor(() => {
      const draft = useDraftStore.getState().getDraft(key);
      expect(draft?.entityType).toBe("individual");
      if (draft?.entityType === "individual") {
        expect(draft.objectPropertyAssertions).toEqual([]);
        expect(draft.dataPropertyAssertions).toEqual([]);
      }
    });
    unmount();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const detail = extractIndividualDetail(output, iri)!;
    expect(detail.seeAlsoIris).toEqual([]);
    expect(detail.isDefinedByIris).toEqual([]);
    expect(detail.objectPropertyAssertions).toEqual([]);
    expect(detail.dataPropertyAssertions).toEqual([]);
  });
});
