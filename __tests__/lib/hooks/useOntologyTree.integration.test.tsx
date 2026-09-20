import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";

const root = "https://example.org/Root";
const child = "https://example.org/Child";
const leaf = "https://example.org/Leaf";
const sibling = "https://example.org/Sibling";
const node = (iri: string, child_count = 0) => ({ iri, label: iri.split("/").at(-1), child_count, deprecated: false });
const response = (nodes: ReturnType<typeof node>[], total_classes = 4) =>
  new Response(JSON.stringify({ nodes, total_classes }), { status: 200 });

// The hook, domain API, URL construction, response parsing and tree transforms
// are real. Only the HTTP boundary is replaced; no live server is required.
const transport = vi.fn<typeof fetch>();
function treeTransport(input: Parameters<typeof fetch>[0]): Response {
  const path = new URL(String(input)).pathname;
  if (path.endsWith("/ancestors")) return response([node(root, 1), node(child, 1)]);
  if (path.endsWith(`/${encodeURIComponent(root)}/children`)) return response([node(child, 1)]);
  if (path.endsWith(`/${encodeURIComponent(child)}/children`)) return response([node(leaf)]);
  if (path.endsWith("/children")) return response([]);
  return response([node(root, 1), node(sibling)]);
}
async function loadedTree() {
  const hook = renderHook(() => useOntologyTree({ projectId: "project", accessToken: "test-token", branchKey: "feature/tree" }));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}
async function expandedTree() {
  const hook = await loadedTree();
  await act(async () => { await hook.result.current.navigateToNode(leaf); });
  return hook;
}

beforeEach(() => {
  transport.mockReset();
  transport.mockImplementation(async (input) => treeTransport(input));
  vi.stubGlobal("fetch", transport);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ontology tree through the real API client", () => {
  it('preserves a newer selection when an older navigation completes', async () => {
    const { result } = await loadedTree();
    let finish!: (value: Response) => void;
    transport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.navigateToNode(leaf); });
    act(() => result.current.selectNode(sibling));
    await act(async () => { finish(response([node(root)])); await pending; });
    expect(result.current.selectedIri).toBe(sibling);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each([200, 403])('ignores obsolete root results with status %s after changing branch', async status => {
    let finish!: (value: Response) => void;
    transport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ branch }) => useOntologyTree({ projectId: 'project', branchKey: branch }), { initialProps: { branch: 'old' } });
    rerender({ branch: 'current' });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    await act(async () => finish(status === 200 ? response([node(leaf)], 1) : new Response('Old branch denied', { status })));
    expect(result.current.nodes.map(n => n.iri)).toEqual([root, sibling]);
    expect(result.current.totalClasses).toBe(4);
    expect(result.current.error).toBeNull();
  });

  it.each(['children', 'ancestors'])('ignores obsolete %s work after changing branch', async kind => {
    const { result, rerender } = renderHook(({ branch }) => useOntologyTree({ projectId: 'project', branchKey: branch }), { initialProps: { branch: 'old' } });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    let finish!: (value: Response) => void;
    transport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = kind === 'children' ? result.current.expandNode(root) : result.current.navigateToNode(leaf); });
    rerender({ branch: 'current' });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    await act(async () => { finish(response([node(child)])); await pending; });
    expect(result.current.nodes[0].children).toEqual([]);
    expect(result.current.selectedIri).toBeNull();
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it("navigates a multi-level path using encoded IRIs, branch and authentication", async () => {
    const { result } = await expandedTree();
    expect(result.current.nodes[0].children[0].children[0].iri).toBe(leaf);
    expect(result.current.selectedIri).toBe(leaf);
    expect(result.current.hasExpandableNodes).toBe(false);
    expect(transport.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/api/v1/projects/project/ontology/tree",
      `/api/v1/projects/project/ontology/tree/${encodeURIComponent(leaf)}/ancestors`,
      `/api/v1/projects/project/ontology/tree/${encodeURIComponent(root)}/children`,
      `/api/v1/projects/project/ontology/tree/${encodeURIComponent(child)}/children`,
    ]);
    for (const [input, init] of transport.mock.calls) {
      expect(new URL(String(input)).searchParams.get("branch")).toBe("feature/tree");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    }
  });

  it("navigates a public tree without attaching an authorization header", async () => {
    const { result } = renderHook(() => useOntologyTree({ projectId: "public-project", branchKey: "published" }));
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    await act(async () => { await result.current.navigateToNode(leaf); });
    expect(result.current.nodes[0].children[0].children[0].iri).toBe(leaf);
    expect(result.current.selectedIri).toBe(leaf);
    expect(result.current.error).toBeNull();
    expect(transport).toHaveBeenCalledTimes(4);
    for (const [input, init] of transport.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toContain("/projects/public-project/ontology/tree");
      expect(url.searchParams.get("branch")).toBe("published");
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      expect(init?.method).toBe("GET");
    }
  });

  it("expands only the visible frontier at each level and stops at leaves", async () => {
    const { result } = await loadedTree();
    await act(async () => { await result.current.expandOneLevel(); });
    expect(result.current.nodes[0].isExpanded).toBe(true);
    expect(result.current.nodes[0].children[0].isExpanded).toBe(false);
    expect(result.current.hasExpandableNodes).toBe(true);
    await act(async () => { await result.current.expandOneLevel(); });
    expect(result.current.nodes[0].children[0].children[0].iri).toBe(leaf);
    expect(result.current.hasExpandableNodes).toBe(false);
    const requests = transport.mock.calls.length;
    await act(async () => { await result.current.expandOneLevel(); });
    expect(transport).toHaveBeenCalledTimes(requests);
  });

  it("fully expands multiple levels and clears its busy state", async () => {
    const { result } = await loadedTree();
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandAllFully(); });
    await waitFor(() => expect(result.current.nodes[0].children[0]?.children[0]?.iri).toBe(leaf));
    await act(async () => { await expansion; });
    expect(result.current.isExpandingAll).toBe(false);
    expect(result.current.hasExpandableNodes).toBe(false);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it("does not request expansions once the 500 visible node limit is reached", async () => {
    transport.mockResolvedValueOnce(response(Array.from({ length: 500 }, (_, i) => node(`urn:root:${i}`, 1)), 1000));
    const { result } = await loadedTree();
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandAllFully(); });
    await waitFor(() => expect(result.current.isExpandingAll).toBe(false));
    await expansion;
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.current.isExpandingAll).toBe(false);
    expect(result.current.hasExpandableNodes).toBe(true);
  });

  it("caps recursive expansion at twenty rounds", async () => {
    transport.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      const encodedParent = path.split("/").at(-2);
      const depth = path.endsWith("/children") ? Number(decodeURIComponent(encodedParent!).split(":").at(-1)) + 1 : 0;
      return response([node(`urn:depth:${depth}`, 1)], 100);
    });
    const { result } = await loadedTree();
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandAllFully(); });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(21));
    await act(async () => { await expansion; });
    expect(result.current.isExpandingAll).toBe(false);
    expect(result.current.hasExpandableNodes).toBe(true);
  });

  it("handles empty trees through all expansion and collapse controls", async () => {
    transport.mockResolvedValueOnce(response([], 0));
    const { result } = await loadedTree();
    await act(async () => { await result.current.expandOneLevel(); });
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandAllFully(); });
    await waitFor(() => expect(result.current.isExpandingAll).toBe(false));
    await expansion;
    act(() => { result.current.collapseOneLevel(); result.current.collapseAll(); });
    expect(result.current.nodes).toEqual([]);
    expect(result.current.totalClasses).toBe(0);
    expect(result.current.hasExpandableNodes).toBe(false);
    expect(result.current.hasExpandedNodes).toBe(false);
    expect(result.current.isExpandingAll).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("retains cached descendants when collapsing and renaming a nested class", async () => {
    const { result } = await expandedTree();
    act(() => { result.current.collapseAll(); result.current.updateNodeLabel(leaf, "Renamed leaf"); });
    const nested = result.current.nodes[0].children[0];
    expect(result.current.nodes[0].isExpanded).toBe(false);
    expect(nested.isExpanded).toBe(false);
    expect(nested.children[0].label).toBe("Renamed leaf");
    expect(result.current.selectedIri).toBe(leaf);
    act(() => { result.current.collapseOneLevel(); });
    expect(result.current.nodes[0].children[0].children[0].label).toBe("Renamed leaf");
  });

  it("moves an expanded subtree to the root and restores the complete snapshot", async () => {
    const { result } = await expandedTree();
    const original = result.current.nodes;
    let snapshot!: ReturnType<typeof result.current.reparentOptimistic>;
    act(() => { snapshot = result.current.reparentOptimistic(child, root, null); });
    expect(result.current.nodes[0].hasChildren).toBe(false);
    expect(result.current.nodes[2].children[0].iri).toBe(leaf);
    expect(result.current.nodes[2].isExpanded).toBe(true);
    expect(result.current.totalClasses).toBe(4);
    act(() => { result.current.rollbackReparent(snapshot); });
    expect(result.current.nodes).toBe(original);
    expect(result.current.selectedIri).toBe(leaf);
  });

  it("ignores reparenting an IRI absent from a populated nested tree", async () => {
    const { result } = await expandedTree();
    const original = result.current.nodes;
    act(() => { result.current.reparentOptimistic("urn:missing", null, sibling); });
    expect(result.current.nodes).toBe(original);
    expect(result.current.totalClasses).toBe(4);
  });

  it("removes a deeply nested selection and preserves unrelated roots", async () => {
    const { result } = await expandedTree();
    act(() => { result.current.removeOptimisticNode(leaf); });
    expect(result.current.nodes[0].children[0].children).toEqual([]);
    expect(result.current.nodes[1].iri).toBe(sibling);
    expect(result.current.selectedIri).toBeNull();
    expect(result.current.totalClasses).toBe(3);
  });

  it("clears an HTTP error after a successful manual reload", async () => {
    transport.mockResolvedValueOnce(new Response("Forbidden", { status: 403, statusText: "Forbidden" }));
    const { result } = await loadedTree();
    expect(result.current.error).toContain("Forbidden");
    expect(result.current.nodes).toEqual([]);
    await act(async () => { await result.current.loadRootClasses(); });
    expect(result.current.error).toBeNull();
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.totalClasses).toBe(4);
  });

  it("clears selection and old nodes while a new branch request is pending", async () => {
    const { result, rerender } = renderHook(({ branchKey }) => useOntologyTree({ projectId: "project", branchKey }), { initialProps: { branchKey: "main" } });
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
    act(() => { result.current.selectNode(root); });
    let resolve!: (value: Response) => void;
    transport.mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    rerender({ branchKey: "empty" });
    expect(result.current.nodes).toEqual([]);
    expect(result.current.selectedIri).toBeNull();
    expect(result.current.totalClasses).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await act(async () => { resolve(response([], 0)); });
    expect(result.current.isLoading).toBe(false);
    expect(new URL(String(transport.mock.calls.at(-1)![0])).searchParams.get("branch")).toBe("empty");
  });
  it("clears nested loading after an HTTP failure and allows a subsequent retry", async () => {
    const { result } = await loadedTree();
    await act(async () => { await result.current.expandNode(root); });
    let resolve!: (value: Response) => void;
    transport.mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    let expansion!: Promise<void>;
    act(() => { expansion = result.current.expandNode(child); });
    expect(result.current.nodes[0].children[0].isLoading).toBe(true);
    await act(async () => {
      resolve(new Response("Access denied", { status: 403, statusText: "Forbidden" }));
      await expansion;
    });
    expect(result.current.nodes[0].children[0]).toMatchObject({ isLoading: false, isExpanded: false, children: [] });
    expect(result.current.error).toBeNull();
    await act(async () => { await result.current.expandNode(child); });
    expect(result.current.nodes[0].children[0]).toMatchObject({ isLoading: false, isExpanded: true });
    expect(result.current.nodes[0].children[0].children[0].iri).toBe(leaf);
  });

  it("keeps a selected target when the real ancestor endpoint rejects navigation", async () => {
    const { result } = await loadedTree();
    transport.mockResolvedValueOnce(new Response("Missing class", { status: 404, statusText: "Not Found" }));
    await act(async () => { await result.current.navigateToNode("urn:missing"); });
    expect(result.current.selectedIri).toBe("urn:missing");
    expect(result.current.nodes[0].isExpanded).toBe(false);
    expect(transport).toHaveBeenCalledTimes(2);
  });

});
