import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OntologyGraph } from "@/components/graph/OntologyGraph";

const iri = (name: string) => `https://example.test/${name}`;
const fetchBoundary = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let missing = false;
beforeEach(() => {
  missing = false;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) { queueMicrotask(() => { if (target.isConnected) this.callback([{ target, contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }); }
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("DOMMatrixReadOnly", class { m22 = 1; });
  fetchBoundary.mockReset().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/ancestors")) return json({ nodes: [] });
    if (url.pathname.endsWith("/search")) return json({ results: [] });
    if (url.pathname.includes("/classes/")) {
      const target = decodeURIComponent(url.pathname.split("/classes/")[1]);
      if (missing && target === iri("Parent")) return json({ detail: "Unavailable" }, 404);
      const name = target === iri("Focus") ? "Focus" : "Parent";
      return json({ iri: target, labels: [{ value: name, lang: "en" }], comments: [], parent_iris: name === "Focus" ? [iri("Parent")] : [], annotations: [], deprecated: false, equivalent_iris: [], disjoint_iris: [] });
    }
    throw new Error(`Unexpected graph request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchBoundary);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const props = { focusIri: iri("Focus"), projectId: "graph", branch: "review", accessToken: "fixture-token" };

describe("graph with real React Flow, ELK layout, nodes and API loading", () => {
  it("loads a relationship graph and navigates a rendered node", async () => {
    const navigate = vi.fn();
    render(<OntologyGraph {...props} onNavigateToClass={navigate} />);
    const focus = await screen.findByRole("button", { name: "Focus" });
    fireEvent.click(focus);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(iri("Focus"));
    expect(await screen.findByRole("button", { name: "Parent" })).toBeDefined();
    expect(screen.getByText("2 nodes, 1 edges (2 resolved)")).toBeDefined();
  });

  it("keeps a failed neighbor visible alongside the resolved focus", async () => {
    missing = true;
    render(<OntologyGraph {...props} />);
    await screen.findByRole("button", { name: "Parent (click to expand)" });
    expect(screen.getByRole("button", { name: "Focus" })).toBeDefined();
    expect(screen.getByText("2 nodes, 1 edges (1 resolved)")).toBeDefined();
  });

  it("renders the empty selection without requesting graph data", () => {
    render(<OntologyGraph {...props} focusIri={null} />);
    expect(screen.getByText("Select a class to view its relationship graph")).toBeDefined();
    expect(fetchBoundary).not.toHaveBeenCalled();
  });
});
