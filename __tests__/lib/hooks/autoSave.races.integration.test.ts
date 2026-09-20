import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { useEntityAutoSave } from "@/lib/hooks/useEntityAutoSave";
import { draftKey, useDraftStore, type DraftEntry, type AnyDraftEntry } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { extractPropertyDetail, extractIndividualDetail } from "@/lib/ontology/entityDetailExtractors";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { updatePropertyInTurtle } from "@/lib/ontology/turtlePropertyUpdater";
import { updateIndividualInTurtle } from "@/lib/ontology/turtleIndividualUpdater";
import { TURTLE_FIXTURE } from "../ontology/fixtures";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useDraftStore.setState({ drafts: {} });
  useEditorModeStore.setState({ hasSeenAutoSaveToast: false });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe.each(["class", "property", "individual"] as const)("%s save ownership", kind => {
  const iri = "http://example.org/ont#" + ({ class: "Dog", property: "hasPart", individual: "fido" }[kind]);
  const key = draftKey("project", "main", iri);
  function setup() {
    let entry: AnyDraftEntry = kind === "property"
      ? { ...extractPropertyDetail(TURTLE_FIXTURE, iri)!, entityType: "property", relationships: [], updatedAt: 1 }
      : kind === "individual"
        ? { ...extractIndividualDetail(TURTLE_FIXTURE, iri)!, entityType: "individual", relationships: [], updatedAt: 1 }
        : { labels: [], comments: [], parentIris: [], parentLabels: {}, annotations: [], relationships: [], updatedAt: 1 };
    let source = TURTLE_FIXTURE;
    const pending = deferred();
    const onError = vi.fn();
    const onFirstAutoSave = vi.fn();
    const view = renderHook(({ branch, entityIri }) => {
      const common = { projectId: "project", branch, canEdit: true, onError, onFirstAutoSave };
      const save = kind === "class"
        // Each parameterized instance uses the same hook for its whole lifetime.
        ? useAutoSave({ ...common, classIri: entityIri, classDetail: null, onUpdateClass: async (target, data) => {
          await pending.promise;
          source = updateClassInTurtle(source, target, { ...data, labels: data.labels ?? [], comments: data.comments ?? [], parent_iris: data.parent_iris ?? [] });
        } })
        : useEntityAutoSave({ ...common, entityIri, buildDraftEntry: () => entry, onFlush: async target => {
          const submitted = useDraftStore.getState().getDraft(draftKey("project", branch, target))!;
          await pending.promise;
          source = submitted.entityType === "property" ? updatePropertyInTurtle(source, target, submitted)
            : updateIndividualInTurtle(source, target, submitted as Parameters<typeof updateIndividualInTurtle>[2]);
        } });
      return save;
    }, { initialProps: { branch: "main", entityIri: iri } });
    const edit = (value: string) => act(() => {
      entry = { ...entry, labels: [{ value, lang: "en" }] };
      if (kind === "class") (view.result.current as ReturnType<typeof useAutoSave>).editStateRef.current = entry as DraftEntry;
      view.result.current.triggerSave();
    });
    return { ...view, edit, pending, onError, onFirstAutoSave, get source() { return source; } };
  }

  it("retains a newer same-tick draft and saves it on the next flush", async () => {
    const view = setup();
    view.edit("First edit");
    const submitted = useDraftStore.getState().getDraft(key)!;
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit("manual"); });
    view.edit("Newer edit");
    const newer = useDraftStore.getState().getDraft(key)!;
    expect(newer.updatedAt).toBe(submitted.updatedAt);
    await act(async () => { view.pending.resolve(); expect(await saving).toBe(true); });
    expect(useDraftStore.getState().getDraft(key)).toBe(newer);
    expect(view.result.current.saveStatus).toBe("draft");
    expect(view.source).toContain('rdfs:label "First edit"@en');
    await act(async () => { expect(await view.result.current.flushToGit("manual")).toBe(true); });
    expect(view.source).toContain('rdfs:label "Newer edit"@en');
    expect(useDraftStore.getState().getDraft(key)).toBeUndefined();
  });

  it.each(["branch", "entity"] as const)("ignores old completion after a %s switch", async change => {
    const view = setup();
    view.edit("Original");
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit(); });
    view.rerender({ branch: change === "branch" ? "review" : "main", entityIri: change === "entity" ? iri + "Other" : iri });
    view.edit("Current");
    await act(async () => { view.pending.resolve(); expect(await saving).toBe(true); });
    expect(view.result.current.saveStatus).toBe("draft");
    expect(view.onFirstAutoSave).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the submitted draft and exposes a current save failure", async () => {
    const view = setup();
    view.edit("Original");
    const submitted = useDraftStore.getState().getDraft(key);
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit("manual"); });
    await act(async () => { view.pending.reject(new Error("Write failed")); expect(await saving).toBe(false); });
    expect(useDraftStore.getState().getDraft(key)).toBe(submitted);
    expect(view.result.current.saveStatus).toBe("error");
    expect(view.result.current.saveError).toBe("Write failed");
    expect(view.onError).toHaveBeenCalledWith("Write failed");
    expect(view.source).toBe(TURTLE_FIXTURE);
  });

  it("ignores an old branch failure and allows the current branch to flush", async () => {
    const view = setup();
    view.edit("Original");
    let original!: Promise<boolean>;
    act(() => { original = view.result.current.flushToGit("manual"); });
    view.rerender({ branch: "review", entityIri: iri });
    view.edit("Current");
    let current!: Promise<boolean>;
    act(() => { current = view.result.current.flushToGit("manual"); });
    expect(view.result.current.saveStatus).toBe("saving");
    await act(async () => { view.pending.reject(new Error("Write failed")); expect(await original).toBe(false); expect(await current).toBe(false); });
    expect(view.onError).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Original");
    expect(useDraftStore.getState().getDraft(draftKey("project", "review", iri))?.labels[0].value).toBe("Current");
  });

  it("cancels saved feedback when the selection becomes empty", async () => {
    const view = setup();
    view.edit("Original");
    view.pending.resolve();
    await act(async () => { await view.result.current.flushToGit("manual"); });
    expect(vi.getTimerCount()).toBe(1);
    view.rerender({ branch: "", entityIri: iri });
    expect(view.result.current.saveStatus).toBe("idle");
    expect(view.result.current.restoredDraft).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not report an old save error against newer edits", async () => {
    const view = setup();
    view.edit("Original");
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit(); });
    view.edit("Current");
    await act(async () => { view.pending.reject(new Error("Old request failed")); expect(await saving).toBe(false); });
    expect(view.result.current.saveStatus).toBe("draft");
    expect(view.result.current.saveError).toBeNull();
    expect(view.onError).not.toHaveBeenCalled();
    expect(useDraftStore.getState().getDraft(key)?.labels[0].value).toBe("Current");
  });

  it("does not schedule feedback after unmount during a save", async () => {
    const view = setup();
    view.edit("Original");
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit(); });
    view.unmount();
    await act(async () => { view.pending.resolve(); expect(await saving).toBe(true); });
    expect(view.onFirstAutoSave).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not announce or schedule stale feedback after the teaching claim awaits", async () => {
    const claim = deferred();
    vi.spyOn(useEditorModeStore.getState(), "claimAutoSaveTeachingToast").mockImplementation(async () => { await claim.promise; return true; });
    const view = setup();
    view.edit("Original");
    let saving!: Promise<boolean>;
    act(() => { saving = view.result.current.flushToGit(); });
    await act(async () => { view.pending.resolve(); await Promise.resolve(); });
    view.edit("Current");
    await act(async () => { claim.resolve(); await saving; });
    expect(view.onFirstAutoSave).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(view.result.current.saveStatus).toBe("draft");
  });
});
