import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useEntityAutoSave } from "@/lib/hooks/useEntityAutoSave";
import { useDraftStore, draftKey, type AnyDraftEntry, type PropertyDraftEntry, type IndividualDraftEntry } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { extractPropertyDetail, extractIndividualDetail } from "@/lib/ontology/entityDetailExtractors";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { updateIndividualInTurtle } from "@/lib/ontology/turtleIndividualUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { TURTLE_FIXTURE } from "../ontology/fixtures";

const ns = "http://example.org/ont#";
function propertyDraft(): PropertyDraftEntry {
  return { ...extractPropertyDetail(TURTLE_FIXTURE, ns + "hasPart")!, entityType: "property", labels: [{ value: "Changed property", lang: "en" }], relationships: [], updatedAt: 1 };
}
function individualDraft(): IndividualDraftEntry {
  return { ...extractIndividualDetail(TURTLE_FIXTURE, ns + "fido")!, entityType: "individual", labels: [{ value: "Changed individual", lang: "en" }], relationships: [], updatedAt: 1 };
}
beforeEach(() => {
  localStorage.clear(); useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ theme: "light", hasSeenAutoSaveToast: false });
});
afterEach(() => { cleanup(); useDraftStore.setState({ drafts: {} }); localStorage.clear(); });

describe("entity auto-save persistent draft integration", () => {
  it.each(["property", "individual"] as const)("saves %s edits through real draft storage and source serialization", async (kind) => {
    const entityIri = ns + (kind === "property" ? "hasPart" : "fido");
    const entry = kind === "property" ? propertyDraft() : individualDraft();
    const key = draftKey("project", "main", entityIri);
    let source = TURTLE_FIXTURE;
    const onFlush = async (iri: string) => {
      const draft = useDraftStore.getState().getDraft(key)!;
      source = draft.entityType === "property"
        ? updatePropertyInTurtle(source, iri, draft)
        : updateIndividualInTurtle(source, iri, draft as IndividualDraftEntry);
    };
    const { result } = renderHook(() => useEntityAutoSave({ projectId: "project", branch: "main", entityIri, canEdit: true, buildDraftEntry: () => entry, onFlush }));
    act(() => result.current.triggerSave());
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts[key].entityType).toBe(kind);
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(parseBlockTriples(source, entityIri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: `Changed ${kind}`, lang: "en" } });
    expect(result.current.saveStatus).toBe("saved");
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it.each(["property", "individual"] as const)("rejects duplicate pending %s flushes and permits a later completed edit", async kind => {
    const entityIri = ns + (kind === "property" ? "hasPart" : "fido");
    const key = draftKey("project", "main", entityIri);
    let entry = kind === "property" ? propertyDraft() : individualDraft();
    let source = TURTLE_FIXTURE;
    let writes = 0;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const { result } = renderHook(() => useEntityAutoSave({ projectId: "project", branch: "main", entityIri, canEdit: true, buildDraftEntry: () => entry,
      onFlush: async target => {
        writes++;
        const submitted = entry;
        await pending;
        source = submitted.entityType === "property" ? updatePropertyInTurtle(source, target, submitted) : updateIndividualInTurtle(source, target, submitted);
      },
    }));
    act(() => result.current.triggerSave());
    let first!: Promise<boolean>;
    act(() => { first = result.current.flushToGit("manual"); });
    expect(result.current.saveStatus).toBe("saving");
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(false); });
    expect(writes).toBe(1);
    expect(source).toBe(TURTLE_FIXTURE);
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    await act(async () => { release(); expect(await first).toBe(true); });
    expect(source).toContain(`rdfs:label "Changed ${kind}"@en`);
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
    entry = { ...entry, labels: [{ value: "Second edit", lang: "en" }] };
    act(() => result.current.triggerSave());
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(writes).toBe(2);
    expect(source).toContain('rdfs:label "Second edit"@en');
    expect(result.current.saveStatus).toBe("saved");
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it("keeps the serialized draft recoverable when the source writer fails", async () => {
    const entityIri = ns + "hasPart";
    const key = draftKey("project", "main", entityIri);
    const entry = { ...propertyDraft(), rangeIris: ["https://example.test/invalid range"] };
    let source = TURTLE_FIXTURE;
    const errors: string[] = [];
    const { result } = renderHook(() => useEntityAutoSave({ projectId: "project", branch: "main", entityIri, canEdit: true, buildDraftEntry: () => entry,
      onFlush: async (iri) => { source = updatePropertyInTurtle(source, iri, useDraftStore.getState().getDraft(key) as PropertyDraftEntry); },
      onError: (error) => errors.push(error),
    }));
    act(() => result.current.triggerSave());
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    expect(source).toBe(TURTLE_FIXTURE);
    expect(errors).toEqual(["Invalid IRI: unsafe characters are not allowed"]);
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts[key].rangeIris).toEqual(entry.rangeIris);
    expect(result.current.saveStatus).toBe("error");
  });

  it("restores a property draft from the persisted JSON after store memory is cleared", async () => {
    const entityIri = ns + "hasPart";
    const key = draftKey("project", "main", entityIri);
    const entry = propertyDraft();
    useDraftStore.getState().setDraft(key, entry);
    const serialized = localStorage.getItem("ontokit-drafts")!;
    useDraftStore.setState({ drafts: {} });
    localStorage.setItem("ontokit-drafts", serialized);
    await useDraftStore.persist.rehydrate();
    const { result } = renderHook(() => useEntityAutoSave({ projectId: "project", branch: "main", entityIri, canEdit: true, buildDraftEntry: () => null }));
    expect(result.current.restoredDraft).toEqual(entry);
    act(() => result.current.clearRestoredDraft());
    expect(result.current.restoredDraft).toBeNull();
    expect(useDraftStore.getState().getDraft(key)).toEqual(entry);
    act(() => result.current.discardDraft());
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts).toEqual({});
  });

  it("preserves drafts when permission or validation prevents flushing", async () => {
    const entityIri = ns + "hasPart";
    const key = draftKey("project", "main", entityIri);
    const entry = propertyDraft();
    useDraftStore.getState().setDraft(key, entry);
    let writes = 0;
    const { result, rerender } = renderHook(({ canEdit, error }: { canEdit: boolean; error: string | null }) => useEntityAutoSave({ projectId: "project", branch: "main", entityIri, canEdit, validate: () => error, buildDraftEntry: () => entry, onFlush: async () => { writes++; } }), { initialProps: { canEdit: false, error: null as string | null } });
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    rerender({ canEdit: true, error: "A range is required" });
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    expect(writes).toBe(0);
    expect(result.current.validationError).toBe("A range is required");
    expect(useDraftStore.getState().getDraft(key)).toEqual(entry);
  });

  it("does not create an empty draft or claim a save for an empty editor", async () => {
    const { result } = renderHook(() => useEntityAutoSave({ projectId: "project", branch: "main", entityIri: ns + "hasPart", canEdit: true, buildDraftEntry: (): AnyDraftEntry | null => null, onFlush: async () => {} }));
    act(() => result.current.triggerSave());
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    expect(result.current.saveStatus).toBe("idle");
    expect(useDraftStore.getState().drafts).toEqual({});
    expect(localStorage.getItem("ontokit-auto-save-toast-seen")).toBeNull();
  });
});
