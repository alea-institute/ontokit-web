import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StandardEditorLayout } from "@/components/editor/standard/StandardEditorLayout";
import { layoutFetch, layoutNs, layoutProps, LayoutProviders } from "../../../fixtures/editor-layout-harness";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
vi.mock("next/dynamic", () => ({ default: () => (props: { onNavigateToClass: (iri: string) => void }) => <button onClick={() => props.onNavigateToClass("https://example.org/layout#Target")}>Graph target</button> }));
beforeEach(() => { useSelectionStore.getState().clear(); useSuggestionStore.getState().clearAllSuggestions(); vi.stubGlobal("fetch", layoutFetch()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const mount = (props = layoutProps()) => render(<LayoutProviders><StandardEditorLayout {...props} /></LayoutProviders>);

describe("standard layout integrated entity navigation", () => {
  it("returns from graph navigation to the selected class panel", async () => {
    const p = layoutProps({ selectedIri: layoutNs + "Root" });
    const normal = layoutFetch();
    vi.mocked(fetch).mockImplementation(async input => {
      if (String(input).includes("/ontology/classes/")) return new Response(JSON.stringify({ iri: p.selectedIri, labels: [{ value: "Root class", lang: "en" }], comments: [], annotations: [], parent_iris: [], parent_labels: {}, equivalent_iris: [], disjoint_iris: [], child_count: 0, instance_count: 0, deprecated: false, is_defined: true }), { status: 200 });
      if (String(input).includes("/lint/")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return normal(input);
    });
    mount(p);
    await screen.findByRole("heading", { name: "Root class" });
    fireEvent.click(screen.getByRole("button", { name: "Show relationship graph" }));
    fireEvent.click(screen.getByRole("button", { name: "Graph target" }));
    expect(p.navigateToNode).toHaveBeenCalledExactlyOnceWith(layoutNs + "Target");
    expect(screen.queryByRole("button", { name: "Graph target" })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Root class" })).toBeDefined();
  });

  it("loads properties through the API and navigates parsed details and shared selection with the real branch navigator", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    fireEvent.click(await screen.findByText("First relation"));
    await screen.findByRole("heading", { name: "First relation" });
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "first", type: "property" });
    fireEvent.click(screen.getByRole("button", { name: "Next class in branch" }));
    await screen.findByRole("heading", { name: "Second relation" });
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "second", type: "property" });
    const searchCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/ontology/search"))!;
    expect(String(searchCall[0])).toContain("branch=work");
    expect(new Headers(searchCall[1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("navigates a loaded individual and clears only active selection when switching to an empty class tab", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Individuals" }));
    fireEvent.click(await screen.findByText("Alice"));
    await screen.findByRole("heading", { name: "Alice" });
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "alice", type: "individual" });
    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    expect(screen.getByText("No classes found in this ontology")).toBeDefined();
    expect(useSelectionStore.getState().iri).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Individuals" }));
    await screen.findByRole("heading", { name: "Alice" });
  });

  it("surfaces a real API failure and recovers after remounting the property tab", async () => {
    const normalFetch = layoutFetch();
    let failed = false;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("/ontology/search") && !failed) {
        failed = true;
        return new Response(JSON.stringify({ detail: "Property service unavailable" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      return normalFetch(input);
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    await screen.findByText(/Property service unavailable/);
    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    await screen.findByText("First relation");
    expect(screen.queryByText(/Property service unavailable/)).toBeNull();
  });

  it("routes the real toolbar add action to the orchestrator", () => {
    const props = layoutProps({ canEdit: true }); mount(props);
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(props.onAddEntity).toHaveBeenCalledWith();
  });

  it("updates the pending badge from branch-scoped suggestions and focuses its target", () => {
    const scope = { projectId: "layout-project", branch: "work" };
    useSuggestionStore.getState().setSuggestions(scope, layoutNs + "first", "children", [{ iri: layoutNs + "new", label: "New", suggestion_type: "children", provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [] }]);
    const scroll = vi.fn();
    render(<LayoutProviders><StandardEditorLayout {...layoutProps()} /><ul><li role="listitem" tabIndex={-1} ref={(node) => { if (node) node.scrollIntoView = scroll; }}>Pending card target</li></ul></LayoutProviders>);
    fireEvent.click(screen.getByTitle("1 pending suggestion — click to scroll to first"));
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(document.activeElement).toBe(screen.getByRole("listitem"));
    act(() => useSuggestionStore.getState().acceptSuggestion(scope, layoutNs + "first", "children", 0));
    expect(screen.queryByTitle(/pending suggestion/)).toBeNull();
  });

  it("external entity navigation selects parsed details and leaves the selection available after unmount", async () => {
    const ref: React.RefObject<((iri: string, type?: string) => void) | null> = { current: null };
    const { unmount } = mount(layoutProps({ entityNavigationRef: ref }));
    act(() => ref.current!(layoutNs + "first", "property"));
    await screen.findByRole("heading", { name: "First relation" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next class in branch" })).toBeDefined());
    unmount();
    expect(ref.current).toBeNull();
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "first", type: "property" });
  });
});
