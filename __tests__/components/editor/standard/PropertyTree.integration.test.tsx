import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyTree } from "@/components/editor/standard/PropertyTree";

const fetchBoundary = vi.fn<typeof fetch>();
const objectProperty = { iri: "https://example.test#related", label: "Related", property_kind: "object", deprecated: false };
const dataProperty = { iri: "https://example.test#age", label: "", property_kind: "data", deprecated: true };
const json = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });
function Harness({ branch = "main", onNodesLoaded }: { branch?: string; onNodesLoaded?: (nodes: { iri: string; label: string }[]) => void }) {
  const [selectedIri, onSelect] = useState<string | null>(null);
  return <PropertyTree projectId="ontology" accessToken="fixture-token" branch={branch} selectedIri={selectedIri} onSelect={onSelect} onNodesLoaded={onNodesLoaded} />;
}
beforeEach(() => { fetchBoundary.mockReset(); vi.stubGlobal("fetch", fetchBoundary); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("property grouping through the real API and entity tree", () => {
  it("keeps other groups open while collapsing one group and selects a fallback-labelled property", async () => {
    const onNodesLoaded = vi.fn();
    fetchBoundary.mockResolvedValue(json([objectProperty, dataProperty]));
    render(<Harness onNodesLoaded={onNodesLoaded} />);
    const objects = await screen.findByRole("treeitem", { name: /^Object Properties/ });
    fireEvent.click(objects);
    expect(screen.queryByRole("treeitem", { name: "Related" })).toBeNull();
    const age = screen.getByRole("treeitem", { name: "age" });
    fireEvent.click(age);
    expect(age.getAttribute("aria-selected")).toBe("true");
    expect(age.className).toContain("opacity-60");
    fireEvent.click(objects);
    expect(screen.getByRole("treeitem", { name: "Related" })).toBeDefined();
    expect(onNodesLoaded).toHaveBeenCalledExactlyOnceWith([
      { iri: objectProperty.iri, label: "Related" }, { iri: dataProperty.iri, label: "age" },
    ]);
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    const [input, init] = fetchBoundary.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/api/v1/projects/ontology/ontology/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "*", branch: "main", entity_types: "property" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-token");
  });

  it.each(["success", "error"])("ignores a late %s from an obsolete branch without notifying the navigator", async outcome => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    fetchBoundary.mockReturnValueOnce(pending).mockResolvedValueOnce(json([dataProperty]));
    const onNodesLoaded = vi.fn();
    const view = render(<Harness onNodesLoaded={onNodesLoaded} />);
    view.rerender(<Harness branch="review" onNodesLoaded={onNodesLoaded} />);
    await screen.findByRole("treeitem", { name: "age" });
    await act(async () => { release(outcome === "success" ? json([objectProperty]) : new Response("Old branch failed", { status: 403 })); });
    expect(screen.queryByText("Related")).toBeNull();
    expect(screen.queryByText("Old branch failed")).toBeNull();
    expect(screen.getByRole("treeitem", { name: "age" })).toBeDefined();
    expect(onNodesLoaded).toHaveBeenCalledExactlyOnceWith([{ iri: dataProperty.iri, label: "age" }]);
    expect(fetchBoundary.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("branch"))).toEqual(["main", "review"]);
  });

  it.each(["success", "error"])("retains the loading state when an obsolete %s arrives before the current request", async outcome => {
    let releaseOld!: (response: Response) => void;
    let releaseCurrent!: (response: Response) => void;
    fetchBoundary.mockReturnValueOnce(new Promise(resolve => { releaseOld = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { releaseCurrent = resolve; }));
    const onNodesLoaded = vi.fn();
    const view = render(<Harness onNodesLoaded={onNodesLoaded} />);
    view.rerender(<Harness branch="review" onNodesLoaded={onNodesLoaded} />);
    await act(async () => { releaseOld(outcome === "success" ? json([objectProperty]) : new Response("Obsolete failure", { status: 403 })); });
    expect(view.container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByRole("tree")).toBeNull();
    expect(screen.queryByText("Obsolete failure")).toBeNull();
    expect(onNodesLoaded).not.toHaveBeenCalled();
    await act(async () => { releaseCurrent(json([dataProperty])); });
    expect(screen.getByRole("treeitem", { name: "age" })).toBeDefined();
    expect(view.container.querySelector(".animate-spin")).toBeNull();
    expect(onNodesLoaded).toHaveBeenCalledExactlyOnceWith([{ iri: dataProperty.iri, label: "age" }]);
  });

  it("recovers from a failed search through an empty branch into a populated branch", async () => {
    fetchBoundary.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Search unavailable" }), { status: 403, headers: { "Content-Type": "application/json" } })).mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([objectProperty]));
    const view = render(<Harness />);
    await screen.findByText("Search unavailable");
    view.rerender(<Harness branch="empty" />);
    await screen.findByText("No properties found in this ontology");
    expect(screen.queryByText("Search unavailable")).toBeNull();
    view.rerender(<Harness branch="populated" />);
    await screen.findByRole("treeitem", { name: "Related" });
    expect(screen.queryByText("No properties found in this ontology")).toBeNull();
  });
});
