import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useFilteredTree } from "@/lib/hooks/useFilteredTree";
import type { EntitySearchResult } from "@/lib/api/client";

const match = (name: string): EntitySearchResult => ({ iri: `https://example.test/${name}`, label: name, entity_type: "class", deprecated: false });
const options = { projectId: "project", accessToken: "fixture-token", branch: "feature/search" };
const fetchBoundary = vi.fn<typeof fetch>();
beforeEach(() => { fetchBoundary.mockReset(); vi.stubGlobal("fetch", fetchBoundary); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("filtered ontology trees through the real ancestor API", () => {
  it("merges shared ancestors while preserving a match whose request is denied", async () => {
    const searchResults = [match("Dog"), match("Cat"), match("Unavailable")];
    fetchBoundary.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("branch")).toBe("feature/search");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-token");
      expect(url.pathname).toContain("/api/v1/projects/project/ontology/tree/https%3A%2F%2Fexample.test%2F");
      if (url.pathname.includes("Unavailable")) return new Response("Forbidden", { status: 403 });
      return Response.json({ nodes: [{ iri: "https://example.test/Animal", label: "Animal", child_count: 2 }] });
    });
    const { result } = renderHook(() => useFilteredTree({ ...options, searchResults }));
    await waitFor(() => expect(result.current.isBuilding).toBe(false));
    expect(result.current.firstMatchIri).toBe(searchResults[0].iri);
    expect(result.current.filteredNodes?.map(node => node.label)).toEqual(["Animal", "Unavailable"]);
    expect(result.current.filteredNodes?.[0].children.map(node => [node.label, node.isSearchMatch])).toEqual([["Dog", true], ["Cat", true]]);
    expect(result.current.filteredNodes?.[1].isSearchMatch).toBe(true);
    expect(fetchBoundary).toHaveBeenCalledTimes(3);
  });

  it("handles malformed ancestor payloads without leaving a loading state and recovers on the next search", async () => {
    fetchBoundary.mockResolvedValueOnce(Response.json({ nodes: null }))
      .mockResolvedValueOnce(Response.json({ nodes: [] }));
    const { result, rerender } = renderHook(({ searchResults }) => useFilteredTree({ ...options, searchResults }), {
      initialProps: { searchResults: [match("Malformed")] },
    });
    await waitFor(() => expect(result.current.isBuilding).toBe(false));
    expect(result.current.filteredNodes).toBeNull();
    rerender({ searchResults: [match("Recovered")] });
    await waitFor(() => expect(result.current.firstMatchIri).toBe(match("Recovered").iri));
    expect(result.current.filteredNodes?.[0].label).toBe("Recovered");
    expect(result.current.isBuilding).toBe(false);
  });

  it("does not restore a pending HTTP result after search is cleared", async () => {
    let resolve!: (response: Response) => void;
    fetchBoundary.mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ searchResults }: { searchResults: EntitySearchResult[] | null }) =>
      useFilteredTree({ ...options, searchResults }), { initialProps: { searchResults: [match("Old")] as EntitySearchResult[] | null } });
    expect(result.current.isBuilding).toBe(true);
    rerender({ searchResults: null });
    await act(async () => resolve(Response.json({ nodes: [{ iri: "https://example.test/Root", label: "Root", child_count: 1 }] })));
    expect(result.current).toMatchObject({ filteredNodes: null, firstMatchIri: null, isBuilding: false, truncated: false });
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
  });
  it.each(["success", "denied", "malformed"])("ignores an old branch's %s response while the current branch is loading", async outcome => {
    const pending: ((response: Response) => void)[] = [];
    fetchBoundary.mockImplementation(() => new Promise<Response>(resolve => pending.push(resolve)));
    const searchResults = [match("Shared")];
    const { result, rerender } = renderHook(({ branch }) => useFilteredTree({ ...options, branch, searchResults }), {
      initialProps: { branch: "old-branch" },
    });
    rerender({ branch: "new-branch" });
    expect(fetchBoundary).toHaveBeenCalledTimes(2);
    expect(fetchBoundary.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("branch"))).toEqual(["old-branch", "new-branch"]);
    await act(async () => pending[0](outcome === "denied" ? new Response("Denied", { status: 403 }) : Response.json({ nodes: outcome === "malformed" ? null : [{ iri: "urn:stale", label: "Stale root", child_count: 1 }] })));
    expect(result.current.isBuilding).toBe(true);
    expect(result.current.filteredNodes).toBeNull();
    await act(async () => pending[1](Response.json({ nodes: [{ iri: "urn:current", label: "Current root", child_count: 1 }] })));
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.filteredNodes?.map(node => node.iri)).toEqual(["urn:current"]);
    expect(result.current.filteredNodes?.[0].children.map(node => node.iri)).toEqual([match("Shared").iri]);
    expect(result.current.firstMatchIri).toBe(match("Shared").iri);
    expect(fetchBoundary).toHaveBeenCalledTimes(2);
  });

});
