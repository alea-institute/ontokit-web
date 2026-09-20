import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndividualList } from "@/components/editor/standard/IndividualList";

const fetchBoundary = vi.fn<typeof fetch>();
const alice = { iri: "https://example.test#Alice", label: "Alice", deprecated: false };
const bob = { iri: "https://example.test#Bob", label: "", deprecated: true };
const json = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });
function Harness({ branch = "main" }: { branch?: string }) {
  const [selectedIri, onSelect] = useState<string | null>(null);
  return <IndividualList projectId="people" accessToken="fixture-token" branch={branch} selectedIri={selectedIri} onSelect={onSelect} />;
}
beforeEach(() => { fetchBoundary.mockReset(); vi.stubGlobal("fetch", fetchBoundary); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("individual list through the real API and entity tree", () => {
  it("selects returned individuals, including a deprecated individual with a fallback label", async () => {
    fetchBoundary.mockResolvedValue(json([alice, bob]));
    render(<Harness />);
    const aliceRow = await screen.findByRole("treeitem", { name: "Alice" });
    const bobRow = screen.getByRole("treeitem", { name: "Bob" });
    fireEvent.click(aliceRow);
    expect(aliceRow.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(bobRow);
    expect(aliceRow.getAttribute("aria-selected")).toBe("false");
    expect(bobRow.getAttribute("aria-selected")).toBe("true");
    expect(bobRow.className).toContain("opacity-60");
    fireEvent.doubleClick(bobRow);
    expect(bobRow.hasAttribute("aria-expanded")).toBe(false);
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    const [input, init] = fetchBoundary.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/api/v1/projects/people/ontology/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "*", branch: "main", entity_types: "individual" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-token");
  });

  it.each(["success", "error"])("discards a late %s from the previous branch", async outcome => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    fetchBoundary.mockReturnValueOnce(pending).mockResolvedValueOnce(json([bob]));
    const view = render(<Harness />);
    view.rerender(<Harness branch="review" />);
    await screen.findByRole("treeitem", { name: "Bob" });
    await act(async () => {
      release(outcome === "success" ? json([alice]) : new Response("Old branch failed", { status: 403 }));
    });
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.queryByText("Old branch failed")).toBeNull();
    expect(screen.getByRole("treeitem", { name: "Bob" })).toBeDefined();
    expect(fetchBoundary.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("branch"))).toEqual(["main", "review"]);
  });

  it("recovers from a rejected search to an empty branch and then a populated branch", async () => {
    fetchBoundary
      .mockResolvedValueOnce(new Response("Search unavailable", { status: 403 }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([alice]));
    const view = render(<Harness />);
    await screen.findByText("Search unavailable");
    view.rerender(<Harness branch="empty" />);
    await screen.findByText("No individuals found in this ontology");
    expect(screen.queryByText("Search unavailable")).toBeNull();
    view.rerender(<Harness branch="populated" />);
    await screen.findByRole("treeitem", { name: "Alice" });
    expect(screen.queryByText("No individuals found in this ontology")).toBeNull();
  });
});
