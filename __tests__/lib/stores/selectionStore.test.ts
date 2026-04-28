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

  it("clear resets back to null/null", () => {
    useSelectionStore.getState().setSelection("ex:Person", "class");
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().iri).toBeNull();
    expect(useSelectionStore.getState().type).toBeNull();
  });

  it("supports null iri with null type for an empty active tab", () => {
    useSelectionStore.getState().setSelection(null, null);
    expect(useSelectionStore.getState().iri).toBeNull();
    expect(useSelectionStore.getState().type).toBeNull();
  });
});
