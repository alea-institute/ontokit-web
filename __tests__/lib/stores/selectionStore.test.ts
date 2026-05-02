import { beforeEach, describe, expect, it } from "vitest";

import { useSelectionStore } from "@/lib/stores/selectionStore";

describe("useSelectionStore", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  it("starts with no selection", () => {
    const state = useSelectionStore.getState();
    expect(state.iri).toBeNull();
    expect(state.type).toBeNull();
  });

  it("setSelection records both iri and type", () => {
    useSelectionStore.getState().setSelection("ex:Person", "class");
    expect(useSelectionStore.getState()).toMatchObject({
      iri: "ex:Person",
      type: "class",
    });

    useSelectionStore.getState().setSelection("ex:hasName", "property");
    expect(useSelectionStore.getState()).toMatchObject({
      iri: "ex:hasName",
      type: "property",
    });

    useSelectionStore.getState().setSelection("ex:alice", "individual");
    expect(useSelectionStore.getState()).toMatchObject({
      iri: "ex:alice",
      type: "individual",
    });
  });

  it("clear resets selection and mode to null", () => {
    useSelectionStore.getState().setSelection("ex:Person", "class");
    useSelectionStore.getState().setMode("editor");
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().iri).toBeNull();
    expect(useSelectionStore.getState().type).toBeNull();
    expect(useSelectionStore.getState().mode).toBeNull();
  });

  it("supports null iri with null type for an empty active tab", () => {
    useSelectionStore.getState().setSelection(null, null);
    expect(useSelectionStore.getState().iri).toBeNull();
    expect(useSelectionStore.getState().type).toBeNull();
  });

  it("starts with mode null", () => {
    expect(useSelectionStore.getState().mode).toBeNull();
  });

  it("setMode records viewer / editor independently of selection", () => {
    useSelectionStore.getState().setMode("editor");
    expect(useSelectionStore.getState().mode).toBe("editor");
    // Selection untouched
    expect(useSelectionStore.getState().iri).toBeNull();

    useSelectionStore.getState().setMode("viewer");
    expect(useSelectionStore.getState().mode).toBe("viewer");
  });
});
