import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { PropertyDetailPanel } from "@/components/editor/PropertyDetailPanel";
import { ToastProvider, useToast } from "@/lib/context/ToastContext";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import { useDraftStore } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import type { GeneratedSuggestion, SuggestionType } from "@/lib/api/generation";
import { extractPropertyDetail } from "@/lib/ontology/entityDetailExtractors";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";
import { updatePropertyInTurtle, type TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";
import { jsonResponse } from "../../fixtures/llm-hook-harness";

const ns = "https://example.test/property#";
const iri = ns + "relation";
const scope = { projectId: "property-suggestions", branch: "review" };
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const example = "http://www.w3.org/2004/02/skos/core#example";
const source = `@prefix : <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <${rdfs}> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
:relation a owl:ObjectProperty ; rdfs:label "Relation"@en ; skos:example "Existing example"@en ; rdfs:domain :Person ; rdfs:range :Place .`;
function suggestion(type: SuggestionType, overrides: Partial<GeneratedSuggestion> = {}): GeneratedSuggestion {
  return { iri: ns + "proposed", label: "Proposed relation", suggestion_type: type, provenance: "llm-proposed", model: "local/model", prompt_template: "properties-v1", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [], ...overrides };
}
function seed(item: GeneratedSuggestion) { useSuggestionStore.getState().setSuggestions(scope, iri, item.suggestion_type, [item]); }
function state(type: SuggestionType) { return useSuggestionStore.getState().suggestions[storeKey(scope, iri, type)][0]; }
function ToastMessages() { return <div>{useToast().toasts.map(toast => <p key={toast.id}>{toast.title}</p>)}</div>; }
function mount(overrides: Partial<ComponentProps<typeof PropertyDetailPanel>> = {}) {
  let output = source;
  const save = vi.fn(async (entity: string, data: TurtlePropertyUpdateData) => { output = updatePropertyInTurtle(output, entity, data); });
  render(<TooltipProvider><ToastProvider><PropertyDetailPanel {...scope} propertyIri={iri} sourceContent={source} canEdit canUseLLM accessToken="test-access" labelHints={{ [ns + "Person"]: "Person", [ns + "Place"]: "Place", [example]: "Example" }} onUpdateProperty={save} {...overrides} /><ToastMessages /></ToastProvider></TooltipProvider>);
  return { save, output: () => output };
}
async function saveDraft() {
  await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved");
}
beforeEach(() => {
  useSuggestionStore.getState().clearAllSuggestions();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ showManualSaveButton: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ results: [], labels: {} })));
});
afterEach(() => { cleanup(); useSuggestionStore.getState().clearAllSuggestions(); useDraftStore.setState({ drafts: {} }); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("property suggestion persistence", () => {
  it("accepts the remaining annotation after rejecting an earlier suggestion without shifting its identity", async () => {
    useSuggestionStore.getState().setSuggestions(scope, iri, "annotations", [
      suggestion("annotations", { iri: ns + "rejected", property_iri: rdfs + "comment", value: "Rejected comment", lang: "en" }),
      suggestion("annotations", { iri: ns + "retained", property_iri: example, value: "Retained example", lang: "fr" }),
    ]);
    const panel = mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Reject suggestion" })[0]);
    expect(screen.queryByText("Rejected comment")).toBeNull();
    expect(state("annotations").status).toBe("rejected");
    expect(panel.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, "annotations")].map(item => item.status)).toEqual(["rejected", "accepted"]));
    await saveDraft();
    const detail = extractPropertyDetail(panel.output(), iri)!;
    expect(detail.comments).toEqual([]);
    expect(detail.annotations.find(annotation => annotation.property_iri === example)?.values).toEqual([
      { value: "Existing example", lang: "en" }, { value: "Retained example", lang: "fr" },
    ]);
    expect(detail.domainIris).toEqual([ns + "Person"]);
    expect(panel.save).toHaveBeenCalledTimes(1);
  });

  it("removes one characteristic while preserving another through Turtle persistence", async () => {
    const panel = mount();
    const functional = await screen.findByRole("checkbox", { name: "Functional" });
    const symmetric = screen.getByRole("checkbox", { name: "Symmetric" });
    fireEvent.click(functional);
    fireEvent.click(symmetric);
    fireEvent.click(functional);
    expect((functional as HTMLInputElement).checked).toBe(false);
    expect((symmetric as HTMLInputElement).checked).toBe(true);
    await saveDraft();
    const detail = extractPropertyDetail(panel.output(), iri)!;
    expect(detail.characteristics).toEqual(["http://www.w3.org/2002/07/owl#SymmetricProperty"]);
    expect(detail.propertyType).toBe("object");
    expect(detail.domainIris).toEqual([ns + "Person"]);
    expect(detail.rangeIris).toEqual([ns + "Place"]);
  });

  it.each([
    ["label", rdfs + "label", "Suggested label"],
    ["comment", rdfs + "comment", "Suggested comment"],
    ["existing annotation", example, "Second example"],
    ["new annotation", "http://www.w3.org/2004/02/skos/core#note", "New note"],
  ])("accepts a %s through card, store, draft, writer and parser", async (_kind, predicate, value) => {
    seed(suggestion("annotations", { property_iri: predicate, value, lang: "fr" }));
    const panel = mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(state("annotations").status).toBe("accepted"));
    await saveDraft();
    const detail = extractPropertyDetail(panel.output(), iri)!;
    const values = predicate === rdfs + "label" ? detail.labels : predicate === rdfs + "comment" ? detail.comments : detail.annotations.find(a => a.property_iri === predicate)!.values;
    expect(values).toContainEqual({ value, lang: "fr" });
    expect(panel.output()).not.toContain("wasGeneratedBy");
    if (predicate === example) expect(values).toContainEqual({ value: "Existing example", lang: "en" });
  });

  it.each([
    ["domain", "Person"], ["domain", "NewDomain"],
    ["range", "Place"], ["range", "NewRange"],
  ])("adds and deduplicates suggested %s target %s", async (kind, localName) => {
    const target = ns + localName;
    seed(suggestion("edges", { iri: target, relationship_type: rdfs + kind }));
    const panel = mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(state("edges").status).toBe("accepted"));
    await saveDraft();
    const detail = extractPropertyDetail(panel.output(), iri)!;
    const existing = ns + (kind === "domain" ? "Person" : "Place");
    expect(kind === "domain" ? detail.domainIris : detail.rangeIris).toEqual(target === existing ? [existing] : [existing, target]);
    expect(kind === "domain" ? detail.rangeIris : detail.domainIris).toEqual([ns + (kind === "domain" ? "Place" : "Person")]);
  });

  it("uses the annotation label and default language when optional generated fields are absent", async () => {
    seed(suggestion("annotations", { property_iri: example, label: "Fallback example" }));
    const panel = mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await waitFor(() => expect(state("annotations").status).toBe("accepted"));
    await saveDraft();
    const detail = extractPropertyDetail(panel.output(), iri)!;
    expect(detail.annotations.find(a => a.property_iri === example)?.values).toEqual([
      { value: "Existing example", lang: "en" },
      { value: "Fallback example", lang: "en" },
    ]);
    expect(detail.labels).toEqual([{ value: "Relation", lang: "en" }]);
  });

  it.each(["object", "data", "annotation"] as const)("persists an edited child as the parent's %s property kind with provenance", async (kind) => {
    seed(suggestion("children"));
    let persisted = "";
    const add: NonNullable<ComponentProps<typeof PropertyDetailPanel>["onAddSuggestedProperty"]> = async (child, label, parent, propertyType, provenance) => {
      const types = { object: "objectProperty", data: "dataProperty", annotation: "annotationProperty" } as const;
      persisted = source + generateTurtleSnippet({ iri: child, label, parentIri: parent, entityType: types[propertyType], provenance });
    };
    mount({ sourceContent: source.replace("owl:ObjectProperty", { object: "owl:ObjectProperty", data: "owl:DatatypeProperty", annotation: "owl:AnnotationProperty" }[kind]), onAddSuggestedProperty: add });
    fireEvent.click(screen.getByRole("button", { name: "Edit suggestion before accepting" }));
    fireEvent.change(screen.getByDisplayValue("Proposed relation"), { target: { value: "Edited child" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(state("children").status).toBe("accepted"));
    const child = extractPropertyDetail(persisted, ns + "proposed")!;
    expect(child.propertyType).toBe(kind);
    expect(child.labels).toEqual([{ value: "Edited child", lang: "en" }]);
    expect(child.parentIris).toEqual([iri]);
    expect(persisted).toContain("prov:wasGeneratedBy");
    expect(persisted).toContain('"local/model"');
    expect(state("children").suggestion.provenance).toBe("user-edited-from-llm");
  });

  it("keeps a child pending when persistence is unavailable and allows rejection", async () => {
    seed(suggestion("children")); mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept suggestion" })[0]);
    await screen.findByText(/Could not accept this suggestion. Generated entity persistence is unavailable/);
    expect(state("children").status).toBe("pending");
    fireEvent.click(screen.getByRole("button", { name: "Reject suggestion" }));
    expect(state("children").status).toBe("rejected");
    expect(screen.queryByText("Proposed relation")).toBeNull();
  });

  it("records a distinct child decision through the real authenticated API before unblocking acceptance", async () => {
    seed(suggestion("children", { duplicate_verdict: "block", duplicate_candidates: [{ iri: ns + "existing", label: "Existing relation", score: 0.99, branch: "main" }] }));
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "decision" }));
    mount();
    expect((screen.getByRole("button", { name: "Accept suggestion" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mark Existing relation as a distinct entity" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Why are these different?"), { target: { value: " Different direction " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as distinct" }));
    await waitFor(() => expect(state("children").suggestion.duplicate_verdict).toBe("pass"));
    const [url, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("distinct-decisions"))!;
    expect(String(url)).toContain(`/projects/${scope.projectId}/duplicate-check/distinct-decisions`);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-access");
    expect(JSON.parse(String(options?.body))).toEqual({ proposed_iri: ns + "proposed", label: "Proposed relation", candidate_iri: ns + "existing", candidate_branch: "main", entity_type: "property", parent_iri: iri, reason: "Different direction" });
    expect(await screen.findByText("Distinct entities recorded")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Accept suggestion" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([{ canEdit: false }, { accessToken: undefined }])("omits distinct decision controls without permission or authentication: %j", (overrides) => {
    seed(suggestion("children", { duplicate_verdict: "block", duplicate_candidates: [{ iri: ns + "existing", label: "Existing relation", score: 0.99 }] }));
    mount(overrides);
    expect(screen.queryByRole("button", { name: /Mark Existing relation/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Accept suggestion" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows generation failure, retries through the real API, and returns to the empty child prompt", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Budget exhausted" }, 402)).mockResolvedValueOnce(jsonResponse({ suggestions: [], input_tokens: 0, output_tokens: 0 }));
    mount({ byoKey: "test-byo" });
    const section = screen.getByText("Sub-Properties").parentElement!.parentElement!;
    fireEvent.click(within(section).getByRole("button", { name: "Get LLM suggestions for this section" }));
    await screen.findByText(/AI budget has been exhausted/);
    fireEvent.click(within(section).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(section).queryByText(/AI budget has been exhausted/)).toBeNull());
    expect(within(section).getByText(/Click.*Suggest improvements/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/llm/generate-suggestions");
    expect(JSON.parse(String(options?.body))).toEqual({ class_iri: iri, branch: "review", suggestion_type: "children", batch_size: 5 });
    expect(new Headers(options?.headers).get("X-BYO-API-Key")).toBe("test-byo");
  });

  it("preserves the duplicate warning on failed distinct submission then retries an annotation decision without a parent", async () => {
    seed(suggestion("annotations", { property_iri: rdfs + "label", duplicate_verdict: "block", duplicate_candidates: [{ iri: ns + "existing", label: "Existing relation", score: 0.99 }] }));
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Not permitted" }, 403)).mockResolvedValueOnce(jsonResponse({ id: "decision" }));
    mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Mark Existing relation as a distinct entity" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Why are these different?"), { target: { value: "Different scope" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as distinct" }));
    await within(dialog).findByText("Not permitted");
    expect(state("annotations").suggestion.duplicate_verdict).toBe("block");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as distinct" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state("annotations").suggestion.duplicate_candidates).toEqual([]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).parent_iri).toBeNull();
  });

});
