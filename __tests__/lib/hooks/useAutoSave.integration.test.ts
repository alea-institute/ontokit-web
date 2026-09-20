import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { draftKey, useDraftStore, type DraftEntry } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import type { ClassUpdatePayload, OWLClassDetail } from "@/lib/api/client";
import { TURTLE_FIXTURE } from "../ontology/fixtures";

const iri = "http://example.org/ont#Dog";
const key = draftKey("project", "main", iri);
const detail: OWLClassDetail = {
  iri, labels: [{ value: "Dog", lang: "en" }], comments: [], parent_iris: [], annotations: [],
  deprecated: false, equivalent_iris: [], disjoint_iris: [], parent_labels: {},
  child_count: 0, instance_count: 0, is_defined: true,
};
function draft(value = "Edited dog"): DraftEntry {
  return { labels: [{ value, lang: "en" }], comments: [], parentIris: [], parentLabels: {}, annotations: [], relationships: [], updatedAt: 1 };
}
function sourceWriter() {
  let source = TURTLE_FIXTURE;
  const save = async (target: string, payload: ClassUpdatePayload) => {
    source = updateClassInTurtle(source, target, { ...payload, labels: payload.labels ?? [], comments: payload.comments ?? [], parent_iris: payload.parent_iris ?? [] });
  };
  return { save, get source() { return source; } };
}
const options = { projectId: "project", branch: "main", classIri: iri, classDetail: detail, canEdit: true };
beforeEach(() => {
  localStorage.clear();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ theme: "light", hasSeenAutoSaveToast: false });
});
afterEach(() => { cleanup(); useDraftStore.setState({ drafts: {} }); localStorage.clear(); vi.useRealTimers(); });

describe("class auto-save with real persistent drafts and Turtle writes", () => {
  it.each(["commit", "suggest"] as const)("removes cleared relationship predicates through %s and preserves omitted annotations after retry", async saveMode => {
    const seeAlso = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
    const definedBy = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
    let source = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<${iri}> a owl:Class ; rdfs:label "Dog"@en ; rdfs:seeAlso <https://example.test/reference> ; rdfs:isDefinedBy <https://example.test/ontology> ; <https://example.test/note> "Untouched" .`;
    const initial = source;
    let reject = true;
    const save = async (target: string, payload: ClassUpdatePayload) => {
      if (reject) throw new Error("Write rejected");
      source = updateClassInTurtle(source, target, { ...payload, labels: payload.labels ?? [], comments: payload.comments ?? [], parent_iris: payload.parent_iris ?? [] });
    };
    const { result } = renderHook(() => useAutoSave({ ...options, canEdit: saveMode === "commit", saveMode,
      classDetail: { ...detail, annotations: [
        { property_iri: seeAlso, property_label: "See Also", values: [{ value: "https://example.test/reference", lang: "" }] },
        { property_iri: definedBy, property_label: "Defined By", values: [{ value: "https://example.test/ontology", lang: "" }] },
      ] }, onUpdateClass: save, onSuggestSave: save,
    }));
    act(() => {
      result.current.editStateRef.current = { ...draft(), relationships: [
        { property_iri: seeAlso, property_label: "See Also", targets: [] },
        { property_iri: definedBy, property_label: "Defined By", targets: [{ iri: "https://example.test/ontology", label: "Ontology" }] },
      ] };
      result.current.triggerSave();
    });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(false); });
    expect(source).toBe(initial);
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    reject = false;
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    const triples = parseBlockTriples(source, iri)!;
    expect(triples.filter(t => t.predicate === seeAlso)).toEqual([]);
    expect(triples.filter(t => t.predicate === definedBy).map(t => t.object)).toEqual([{ type: "iri", value: "https://example.test/ontology" }]);
    expect(triples).toContainEqual({ predicate: "https://example.test/note", object: { type: "literal", value: "Untouched" } });
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it("clears the saved indicator after two seconds without changing the persisted ontology", async () => {
    vi.useFakeTimers();
    const writer = sourceWriter();
    const { result } = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save }));
    act(() => { result.current.editStateRef.current = draft("Timer dog"); result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(result.current.saveStatus).toBe("saved");
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(result.current.saveStatus).toBe("saved");
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.saveStatus).toBe("idle");
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
    expect(parseBlockTriples(writer.source, iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Timer dog", lang: "en" } });
  });

  it("cancels saved feedback on unmount while preserving the completed Turtle write", async () => {
    vi.useFakeTimers();
    const writer = sourceWriter();
    const view = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save }));
    act(() => { view.result.current.editStateRef.current = draft("Unmounted dog"); view.result.current.triggerSave(); });
    await act(async () => { expect(await view.result.current.flushToGit("manual")).toBe(true); });
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(writer.source).toContain('rdfs:label "Unmounted dog"@en');
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it("rejects a second flush while the first write is pending and permits the next edit afterward", async () => {
    const writer = sourceWriter();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let writes = 0;
    const { result } = renderHook(() => useAutoSave({
      ...options,
      onUpdateClass: async (target, payload) => {
        writes++;
        await pending;
        await writer.save(target, payload);
      },
    }));
    act(() => { result.current.editStateRef.current = draft("First write"); result.current.triggerSave(); });
    let first!: Promise<boolean>;
    act(() => { first = result.current.flushToGit("manual"); });
    expect(result.current.saveStatus).toBe("saving");
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(false); });
    expect(writes).toBe(1);
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    await act(async () => { release(); expect(await first).toBe(true); });
    expect(writer.source).toContain('rdfs:label "First write"@en');
    act(() => { result.current.editStateRef.current = draft("Second write"); result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(writes).toBe(2);
    expect(writer.source).toContain('rdfs:label "Second write"@en');
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it("ignores an individual draft sharing the selected IRI without deleting its persisted data", async () => {
    const writer = sourceWriter();
    const individualDraft = {
      ...draft(), entityType: "individual" as const, definitions: [], typeIris: [],
      sameAsIris: [], differentFromIris: [], objectPropertyAssertions: [],
      dataPropertyAssertions: [], deprecated: false,
    };
    useDraftStore.getState().setDraft(key, individualDraft);
    const { result } = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save }));
    expect(result.current.restoredDraft).toBeNull();
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(false); });
    expect(writer.source).toBe(TURTLE_FIXTURE);
    expect(useDraftStore.getState().getDraft(key)).toEqual(individualDraft);
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts[key].entityType).toBe("individual");
  });

  it("keeps a persisted draft until its save handler becomes available", async () => {
    const writer = sourceWriter();
    useDraftStore.getState().setDraft(key, { ...draft("Recovered edit"), entityType: "class" });
    const { result, rerender } = renderHook(({ ready }) => useAutoSave({
      ...options, onUpdateClass: ready ? writer.save : undefined,
    }), { initialProps: { ready: false } });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(false); });
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    rerender({ ready: true });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(writer.source).toContain('rdfs:label "Recovered edit"@en');
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it.each([
    { name: "details have not loaded", classDetail: null },
    { name: "relationship lists are null", classDetail: { ...detail, equivalent_iris: null, disjoint_iris: null } },
  ])("flushes a restored label draft when $name", async ({ classDetail }) => {
    const writer = sourceWriter();
    const payloads: ClassUpdatePayload[] = [];
    useDraftStore.getState().setDraft(key, draft("Restored dog"));
    const { result } = renderHook(() => useAutoSave({ ...options, classDetail,
      onUpdateClass: async (target, payload) => { payloads.push(payload); await writer.save(target, payload); },
    }));
    expect(result.current.restoredDraft?.labels).toEqual([{ value: "Restored dog", lang: "en" }]);
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(payloads).toHaveLength(1);
    expect(payloads[0].equivalent_iris).toBeUndefined();
    expect(payloads[0].disjoint_iris).toBeUndefined();
    const labels = parseBlockTriples(writer.source, iri)!.filter(triple => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#label");
    expect(labels.map(triple => triple.object)).toEqual([{ type: "literal", value: "Restored dog", lang: "en" }]);
    expect(parseBlockTriples(writer.source, "http://example.org/ont#Animal")).toEqual(parseBlockTriples(TURTLE_FIXTURE, "http://example.org/ont#Animal"));
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
    expect(result.current.saveStatus).toBe("saved");
  });

  it("persists edits locally, writes clean source, then removes only the saved draft", async () => {
    const writer = sourceWriter();
    const otherKey = draftKey("project", "review", iri);
    useDraftStore.getState().setDraft(otherKey, draft("Other branch"));
    const { result } = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save }));
    act(() => {
      result.current.editStateRef.current = {
        ...draft(), labels: [{ value: "Edited dog", lang: "en" }, { value: " ", lang: "en" }],
        comments: [{ value: "", lang: "en" }, { value: "A changed comment", lang: "en" }],
        annotations: [{ property_iri: "http://example.org/ont#note", values: [{ value: " ", lang: "" }, { value: "Keep", lang: "en" }] }],
        relationships: [{ property_iri: "http://www.w3.org/2000/01/rdf-schema#seeAlso", property_label: "See also", targets: [{ iri: "https://example.test/reference", label: "Reference" }] }],
      };
      result.current.triggerSave();
    });
    expect(result.current.saveStatus).toBe("draft");
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts[key].labels[0].value).toBe("Edited dog");
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(result.current.saveStatus).toBe("saved");
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
    expect(useDraftStore.getState().getDraft(otherKey)?.labels[0].value).toBe("Other branch");
    const triples = parseBlockTriples(writer.source, iri)!;
    expect(triples).toContainEqual({ predicate: "http://example.org/ont#note", object: { type: "literal", value: "Keep", lang: "en" } });
    expect(triples).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#seeAlso", object: { type: "iri", value: "https://example.test/reference" } });
    expect(triples.filter((triple) => triple.predicate === "http://www.w3.org/2000/01/rdf-schema#label")).toHaveLength(1);
  });

  it("restores a draft after unmount and removes it from storage on discard", () => {
    const first = renderHook(() => useAutoSave(options));
    act(() => { first.result.current.editStateRef.current = draft(); first.result.current.triggerSave(); });
    first.unmount();
    const second = renderHook(() => useAutoSave(options));
    expect(second.result.current.restoredDraft?.labels).toEqual(draft().labels);
    act(() => second.result.current.discardDraft());
    expect(second.result.current.restoredDraft).toBeNull();
    expect(JSON.parse(localStorage.getItem("ontokit-drafts")!).state.drafts).toEqual({});
  });

  it("retains a draft when the real writer rejects an unsafe IRI and saves a corrected retry", async () => {
    const writer = sourceWriter();
    const errors: string[] = [];
    const { result } = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save, onError: (message) => errors.push(message) }));
    act(() => { result.current.editStateRef.current = { ...draft(), parentIris: ["http://example.org/bad parent"] }; result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    expect(result.current.saveStatus).toBe("error");
    expect(errors).toEqual(["Invalid IRI: unsafe characters are not allowed"]);
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    expect(writer.source).toBe(TURTLE_FIXTURE);
    act(() => { result.current.editStateRef.current = draft(); result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit()).toBe(true); });
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
  });

  it("does not flush an old valid draft after the visible label becomes empty", async () => {
    const writer = sourceWriter();
    const { result } = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save }));
    act(() => { result.current.editStateRef.current = draft(); result.current.triggerSave(); });
    act(() => { result.current.editStateRef.current = draft("  "); result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit()).toBe(false); });
    expect(result.current.validationError).toBe("At least one label is required");
    expect(useDraftStore.getState().hasDraft(key)).toBe(true);
    expect(writer.source).toBe(TURTLE_FIXTURE);
  });

  it("claims the teaching announcement only once across real hook instances", async () => {
    const writer = sourceWriter();
    let announcements = 0;
    for (let index = 0; index < 2; index++) {
      const view = renderHook(() => useAutoSave({ ...options, onUpdateClass: writer.save, onFirstAutoSave: () => { announcements++; } }));
      act(() => { view.result.current.editStateRef.current = draft(`Edit ${index}`); view.result.current.triggerSave(); });
      await act(async () => { expect(await view.result.current.flushToGit()).toBe(true); });
      view.unmount();
    }
    expect(announcements).toBe(1);
    expect(localStorage.getItem("ontokit-auto-save-toast-seen")).toBe("true");
  });

  it("keeps branch drafts separate when navigating between branches", () => {
    useDraftStore.getState().setDraft(key, draft("Main"));
    useDraftStore.getState().setDraft(draftKey("project", "review", iri), draft("Review"));
    const { result, rerender } = renderHook(({ branch }) => useAutoSave({ ...options, branch }), { initialProps: { branch: "main" } });
    expect(result.current.restoredDraft?.labels[0].value).toBe("Main");
    rerender({ branch: "review" });
    expect(result.current.restoredDraft?.labels[0].value).toBe("Review");
    act(() => result.current.discardDraft());
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Main");
  });

  it("allows suggestion drafts without direct edit permission and flushes through the suggestion writer", async () => {
    const writer = sourceWriter();
    const labels: string[] = [];
    const { result } = renderHook(() => useAutoSave({ ...options, canEdit: false, saveMode: "suggest", onSuggestSave: async (target, payload, label) => { labels.push(label); await writer.save(target, payload); } }));
    act(() => { result.current.editStateRef.current = draft("Suggested dog"); result.current.triggerSave(); });
    await act(async () => { expect(await result.current.flushToGit("manual")).toBe(true); });
    expect(labels).toEqual(["Suggested dog"]);
    expect(writer.source).toContain('rdfs:label "Suggested dog"@en');
    expect(useDraftStore.getState().hasDraft(key)).toBe(false);
    expect(localStorage.getItem("ontokit-auto-save-toast-seen")).toBeNull();
  });
});
