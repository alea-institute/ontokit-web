import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DeveloperEditorLayout, type DeveloperEditorLayoutProps } from "@/components/editor/developer/DeveloperEditorLayout";
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import { layoutFetch, layoutNs, layoutProps, LayoutProviders } from "../../fixtures/editor-layout-harness";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
// Browser-only source/graph surfaces terminate the chain; all tree/detail children stay real.
vi.mock("next/dynamic", () => ({ default: (loader: () => unknown) => {
  if (!String(loader).includes("OntologySourceEditor")) return function GraphBoundary() { return <div>Browser graph boundary</div>; };
  return function SourceBoundary(props: { initialValue: string; onScrollComplete: () => void }) {
    // Match OntologySourceEditor: initialValue seeds local state only at mount.
    const [value] = React.useState(props.initialValue);
    return <div><pre data-testid="source-value">{value}</pre><button onClick={props.onScrollComplete}>Finish source scroll</button></div>;
  };
} }));
beforeEach(() => { useSelectionStore.getState().clear(); useSuggestionStore.getState().clearAllSuggestions(); vi.stubGlobal("fetch", layoutFetch()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function props(overrides: Partial<DeveloperEditorLayoutProps> = {}): DeveloperEditorLayoutProps {
  return { ...layoutProps(), sourceContent: layoutProps().sourceContent!, setSourceContent: vi.fn(), isLoadingSource: false,
    sourceError: null, isPreloading: false, loadSourceContent: vi.fn().mockResolvedValue(undefined), sourceIriIndex: new Map(),
    pendingScrollIri: null, setPendingScrollIri: vi.fn(), sourceEditorRef: { current: null }, onSaveSource: vi.fn().mockResolvedValue(undefined), ...overrides };
}
const mount = (p = props()) => render(<LayoutProviders><DeveloperEditorLayout {...p} /></LayoutProviders>);

describe("developer layout real tree/detail integration", () => {
  it("scrolls to a pending card and updates the badge after acceptance", () => {
    const scope = { projectId: "layout-project", branch: "work" };
    useSuggestionStore.getState().setSuggestions(scope, layoutNs + "first", "children", [{ iri: layoutNs + "new", label: "New", suggestion_type: "children", provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [] }]);
    const scroll = vi.fn();
    render(<LayoutProviders><DeveloperEditorLayout {...props()} /><ul><li role="listitem" tabIndex={-1} ref={node => { if (node) node.scrollIntoView = scroll; }}>Pending target</li></ul></LayoutProviders>);
    fireEvent.click(screen.getByTitle("1 pending suggestion — click to scroll to first"));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth", block: "center" });
    expect(document.activeElement).toBe(screen.getByRole("listitem"));
    act(() => useSuggestionStore.getState().acceptSuggestion(scope, layoutNs + "first", "children", 0));
    expect(screen.queryByTitle(/pending suggestion/)).toBeNull();
  });

  it("navigates API properties through parsed panels, sibling controls and shared selection", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Properties" }));
    fireEvent.click(await screen.findByText("First relation"));
    await screen.findByRole("heading", { name: "First relation" });
    fireEvent.click(screen.getByRole("button", { name: "Next class in branch" }));
    await screen.findByRole("heading", { name: "Second relation" });
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "second", type: "property" });
    fireEvent.click(screen.getByRole("button", { name: "Individuals" }));
    fireEvent.click(await screen.findByText("Alice"));
    await screen.findByRole("heading", { name: "Alice" });
    expect(useSelectionStore.getState()).toMatchObject({ iri: layoutNs + "alice", type: "individual" });
  });

  it("preloads empty source only once across repeated hover events", () => {
    const p = props({ sourceContent: "" }); mount(p);
    const sourceTab = screen.getByRole("button", { name: "Source" });
    fireEvent.mouseEnter(sourceTab); fireEvent.mouseLeave(sourceTab); fireEvent.mouseEnter(sourceTab);
    expect(p.loadSourceContent).toHaveBeenCalledTimes(1);
    expect(p.loadSourceContent).toHaveBeenCalledWith(true);
  });

  it("waits for a hovered source request before mounting the editor", async () => {
    let resolveSource!: (content: string) => void;
    const request = new Promise<string>(resolve => { resolveSource = resolve; });
    const load = vi.fn();
    function DeferredSource() {
      const [sourceContent, setSourceContent] = React.useState("");
      const [isPreloading, setIsPreloading] = React.useState(false);
      const loadSourceContent = React.useCallback(async (isPreload?: boolean) => {
        load(isPreload);
        setIsPreloading(true);
        setSourceContent(await request);
        setIsPreloading(false);
      }, []);
      return <DeveloperEditorLayout {...props({ sourceContent, setSourceContent, isPreloading, loadSourceContent })} />;
    }
    render(<LayoutProviders><DeferredSource /></LayoutProviders>);
    const sourceTab = screen.getByRole("button", { name: "Source" });
    fireEvent.mouseEnter(sourceTab);
    fireEvent.click(sourceTab);
    expect(screen.getByText("Loading source...")).toBeDefined();
    expect(screen.queryByTestId("source-value")).toBeNull();
    await act(async () => { resolveSource("Loaded branch source"); await request; });
    expect(screen.getByTestId("source-value").textContent).toBe("Loaded branch source");
    expect(load).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByText("Loading source...")).toBeNull();
  });

  it("lets an error be retried and completes source scrolling through the editor boundary", () => {
    const p = props({ sourceError: "Repository unavailable" });
    const { rerender } = mount(p);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByText("Repository unavailable")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(p.loadSourceContent).toHaveBeenCalledWith(false);
    rerender(<LayoutProviders><DeveloperEditorLayout {...p} sourceError={null} /></LayoutProviders>);
    fireEvent.click(screen.getByRole("button", { name: "Finish source scroll" }));
    expect(p.setPendingScrollIri).toHaveBeenCalledWith(null);
  });

  it("captures unsaved editor text before returning to the real tree", () => {
    const sourceEditorRef: React.RefObject<OntologySourceEditorRef | null> = { current: { getValue: () => "edited source", scrollToIri: vi.fn().mockReturnValue(false), insertAtEnd: vi.fn(), replaceValue: vi.fn() } };
    const p = props({ sourceEditorRef }); mount(p);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(p.setSourceContent).toHaveBeenCalledWith("edited source");
    expect(screen.getByText("No classes found in this ontology")).toBeDefined();
  });

  it("external untyped navigation requests source scrolling and cleans the navigation ref", () => {
    const entityNavigationRef: React.RefObject<((iri: string, type?: string) => void) | null> = { current: null };
    const p = props({ entityNavigationRef }); const { unmount } = mount(p);
    act(() => entityNavigationRef.current!(layoutNs + "untyped", "other"));
    expect(p.setPendingScrollIri).toHaveBeenCalledWith(layoutNs + "untyped");
    expect(screen.getByRole("button", { name: "Finish source scroll" })).toBeDefined();
    unmount(); expect(entityNavigationRef.current).toBeNull();
  });

  it("renders loading feedback while the source request is outstanding", () => {
    const p = props({ sourceContent: "", isLoadingSource: true }); mount(p);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByText("Loading source...")).toBeDefined();
    expect(p.loadSourceContent).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Finish source scroll" })).toBeNull();
  });
});
