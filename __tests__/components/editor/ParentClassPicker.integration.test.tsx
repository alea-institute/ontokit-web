import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentClassPicker } from "@/components/editor/ParentClassPicker";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";

const child = "https://example.test/Child";
const parent = "https://example.test/Parent";
const excluded = "https://example.test/Excluded";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let request: ReturnType<typeof vi.fn>;
let route: (url: URL) => Response | undefined;
beforeEach(() => {
  route = () => undefined;
  request = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    return route(url) ?? (url.pathname.endsWith("rank-suggestions") ? json([{ iri: parent, label: "Ranked parent", score: 0.91 }]) : json({ results: [parent, excluded].map(iri => ({ iri, label: "", entity_type: "class", deprecated: false })), total: 2 }));
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount() {
  let output = '@prefix ex: <https://example.test/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\nex:Child a owl:Class .';
  const select = vi.fn((iri: string, _label: string) => { output = updateClassInTurtle(output, child, { labels: [], comments: [], parent_iris: [iri] }); });
  const close = vi.fn();
  const view = render(<ParentClassPicker projectId="parent-project" accessToken="test-token" branch="review" contextIri={child} excludeIris={[excluded]} onSelect={select} onClose={close} />);
  return { ...view, select, close, triples: () => parseBlockTriples(output, child) };
}
function search(query: string) { fireEvent.change(screen.getByPlaceholderText("Search for a class..."), { target: { value: query } }); }

describe("parent selection through search, ranking and Turtle persistence", () => {
  it.each(["Ranked parent", ""])("persists a ranked parent with label %j and excludes selected candidates from ranking", async (label) => {
    route = url => url.pathname.endsWith("rank-suggestions") ? json([{ iri: parent, label, score: 0.91 }]) : undefined;
    const view = mount(); search(" parent ");
    fireEvent.click(await screen.findByRole("button", { name: /91%/ }));
    expect(view.select).toHaveBeenCalledExactlyOnceWith(parent, label || "Parent");
    expect(view.close).toHaveBeenCalledOnce();
    expect(view.triples()).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: parent } });
    const rank = request.mock.calls.find(([url]) => String(url).endsWith("rank-suggestions"))!;
    expect(JSON.parse(rank[1].body)).toEqual({ context_iri: child, candidates: [parent], relationship: "parent" });
    const query = new URL(request.mock.calls[0][0]);
    expect(query.searchParams.get("q")).toBe("parent");
    expect(query.searchParams.get("branch")).toBe("review");
  });

  it("recovers from a failed search on the next query", async () => {
    route = url => url.searchParams.get("q") === "denied" ? json({ detail: "Denied" }, 403) : undefined;
    const view = mount(); search("denied");
    await screen.findByText("No classes found");
    expect(view.select).not.toHaveBeenCalled();
    search("parent");
    expect(await screen.findByRole("button", { name: /91%/ })).toBeDefined();
  });

  it("keeps unranked results selectable when ranking fails", async () => {
    route = url => url.pathname.endsWith("rank-suggestions") ? json({ detail: "Denied" }, 403) : undefined;
    const view = mount(); search("parent");
    fireEvent.click(await screen.findByRole("button", { name: /https:\/\/example.test\/Parent/ }));
    expect(view.select).toHaveBeenCalledExactlyOnceWith(parent, "Parent");
    expect(view.triples()).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#subClassOf", object: { type: "iri", value: parent } });
    expect(screen.queryByText("Suggested")).toBeNull();
  });

  it("cancels a queued search when unmounted before the debounce expires", async () => {
    vi.useFakeTimers();
    try {
      const view = mount(); search("parent"); view.unmount();
      await vi.advanceTimersByTimeAsync(350);
      expect(request).not.toHaveBeenCalled();
      expect(view.select).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
