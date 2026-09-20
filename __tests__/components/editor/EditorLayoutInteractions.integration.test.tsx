import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StandardEditorLayout } from "@/components/editor/standard/StandardEditorLayout";
import { DeveloperEditorLayout } from "@/components/editor/developer/DeveloperEditorLayout";
import { layoutProps, layoutNs, layoutFetch, LayoutProviders } from "../../fixtures/editor-layout-harness";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
// Keep tree, search hooks, API client and menus real; browser-only renderers stop here.
vi.mock("next/dynamic", () => ({ default: () => () => <div>Browser renderer boundary</div> }));
const node = { iri: layoutNs + "Root", label: "Root class", children: [], isExpanded: false, isLoading: false, hasChildren: false };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { useSelectionStore.getState().clear(); useSuggestionStore.getState().clearAllSuggestions(); vi.stubGlobal("fetch", layoutFetch()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount(mode: "standard" | "developer") {
  const props = layoutProps({ nodes: [node], canEdit: true });
  const developerProps = { ...props, sourceContent: props.sourceContent!, setSourceContent: vi.fn(), isLoadingSource: false,
    sourceError: null, isPreloading: false, loadSourceContent: vi.fn().mockResolvedValue(undefined), sourceIriIndex: new Map(),
    pendingScrollIri: null, setPendingScrollIri: vi.fn(), sourceEditorRef: { current: null }, onSaveSource: vi.fn().mockResolvedValue(undefined) };
  render(<LayoutProviders>{mode === "standard" ? <StandardEditorLayout {...props} /> : <DeveloperEditorLayout {...developerProps} />}</LayoutProviders>);
  return props;
}

for (const mode of ["standard", "developer"] as const) {
  describe(`${mode} layout tree interactions`, () => {
    it("searches the API, builds ancestor context and navigates a real matched tree node", async () => {
      const transport = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname.includes("/translation/")) return layoutFetch()(input);
        if (url.pathname.endsWith("/search")) return response({ results: [{ iri: layoutNs + "Target", label: "Target class", entity_type: "class" }], total: 1 });
        if (url.pathname.endsWith("/ancestors")) return response({ nodes: [{ iri: node.iri, label: node.label, child_count: 1 }] });
        throw new Error(`Unexpected request: ${url.pathname}`);
      });
      vi.stubGlobal("fetch", transport);
      const props = mount(mode);
      fireEvent.click(screen.getByRole("button", { name: "Search entities" }));
      fireEvent.change(screen.getByPlaceholderText("Search classes, properties, individuals..."), { target: { value: "Target" } });
      const target = await screen.findByRole("treeitem", { name: /Target class/ });
      expect(screen.getByRole("treeitem", { name: /Root class/ })).toBeDefined();
      fireEvent.click(target);
      expect(props.navigateToNode).toHaveBeenCalledWith(layoutNs + "Target");
      expect(screen.queryByPlaceholderText("Search classes, properties, individuals...")).toBeNull();
      expect(screen.queryByRole("treeitem", { name: /Target class/ })).toBeNull();
      const searchCalls = transport.mock.calls.filter(([url]) => !String(url).includes("/translation/"));
      expect(searchCalls).toHaveLength(2);
      for (const [url] of searchCalls) expect(new URL(String(url), "http://localhost").searchParams.get("branch")).toBe("work");
    });

    it("shows an empty result after a search failure, then recovers on the next query", async () => {
      const transport = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname.includes("/translation/")) return layoutFetch()(input);
        return url.searchParams.get("q") === "broken"
          ? response({ detail: "Search offline" }, 403)
          : response({ results: [{ iri: layoutNs + "first", label: "Recovered relation", entity_type: "property" }], total: 1 });
      });
      vi.stubGlobal("fetch", transport);
      const props = mount(mode);
      fireEvent.click(screen.getByRole("button", { name: "Search entities" }));
      const input = screen.getByPlaceholderText("Search classes, properties, individuals...");
      fireEvent.change(input, { target: { value: "broken" } });
      await screen.findByText("No results found");
      fireEvent.change(input, { target: { value: "relation" } });
      fireEvent.click(await screen.findByText("Recovered relation"));
      expect(props.navigateToNode).toHaveBeenCalledWith(layoutNs + "first");
      await waitFor(() => expect(screen.queryByText("No results found")).toBeNull());
    });

    it("passes the parent IRI from the real context menu to entity creation", async () => {
      const props = mount(mode);
      fireEvent.contextMenu(screen.getByText("Root class"));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Add Subclass" }));
      expect(props.onAddEntity).toHaveBeenCalledExactlyOnceWith(node.iri);
      expect(props.selectNode).not.toHaveBeenCalled();
    });
  });
}


it("developer tree context navigation scrolls an already indexed editor to the selected class", async () => {
  const scrollToIri = vi.fn().mockReturnValue(true);
  const setPendingScrollIri = vi.fn();
  const props = layoutProps({ nodes: [node] });
  render(<LayoutProviders><DeveloperEditorLayout {...props}
    sourceContent={props.sourceContent!} setSourceContent={vi.fn()} isLoadingSource={false}
    sourceError={null} isPreloading={false} loadSourceContent={vi.fn().mockResolvedValue(undefined)}
    sourceIriIndex={new Map([[node.iri, { line: 1, col: 1, len: 4 }]])}
    pendingScrollIri={null} setPendingScrollIri={setPendingScrollIri}
    sourceEditorRef={{ current: { getValue: () => props.sourceContent!, scrollToIri, insertAtEnd: vi.fn(), replaceValue: vi.fn() } }}
    onSaveSource={vi.fn().mockResolvedValue(undefined)}
  /></LayoutProviders>);
  fireEvent.contextMenu(screen.getByText("Root class"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "View in Source" }));
  expect(scrollToIri).toHaveBeenCalledExactlyOnceWith(node.iri);
  expect(setPendingScrollIri).toHaveBeenCalledExactlyOnceWith(node.iri);
  expect(screen.getByText("Browser renderer boundary")).toBeDefined();
});

it.each(["Graph", "Source"])("developer navigation from %s reveals the selected class", async view => {
  const entityNavigationRef = { current: null as ((iri: string, type?: string) => void) | null };
  const props = layoutProps({ nodes: [node], entityNavigationRef });
  render(<LayoutProviders><DeveloperEditorLayout {...props}
    sourceContent={props.sourceContent!} setSourceContent={vi.fn()} isLoadingSource={false}
    sourceError={null} isPreloading={false} loadSourceContent={vi.fn().mockResolvedValue(undefined)}
    sourceIriIndex={new Map()} pendingScrollIri={null} setPendingScrollIri={vi.fn()}
    sourceEditorRef={{ current: null }} onSaveSource={vi.fn().mockResolvedValue(undefined)}
  /></LayoutProviders>);
  fireEvent.click(screen.getByRole("button", { name: view }));
  expect(screen.queryByRole("treeitem", { name: /Root class/ })).toBeNull();
  await act(async () => entityNavigationRef.current?.(node.iri, "class"));
  expect(screen.getByRole("treeitem", { name: /Root class/ })).toBeDefined();
  expect(props.navigateToNode).toHaveBeenCalledWith(node.iri);
});
