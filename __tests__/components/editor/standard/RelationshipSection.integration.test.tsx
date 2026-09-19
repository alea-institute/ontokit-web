import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelationshipSection, type RelationshipGroup } from "@/components/editor/standard/RelationshipSection";
import { SEE_ALSO_IRI } from "@/lib/ontology/annotationProperties";

const group: RelationshipGroup = { property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [{ iri: "https://example.test/Existing", label: "Existing" }] };
const fetchBoundary = vi.fn<typeof fetch>();
function response(results: { iri: string; label: string; entity_type: string }[]) {
  return new Response(JSON.stringify({ results, total: results.length }));
}
async function debounce() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }
function edit() { return render(<RelationshipSection groups={[group]} isEditing projectId="project" accessToken="fixture-token" branch="feature/search" />); }
function propertySearch(query: string) {
  fireEvent.click(screen.getByRole("button", { name: "See Also" }));
  fireEvent.change(screen.getByPlaceholderText("Search properties..."), { target: { value: query } });
}
function entitySearch(query: string) {
  const input = screen.getByPlaceholderText("Search entities to add...");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  return input;
}
beforeEach(() => { vi.useFakeTimers(); fetchBoundary.mockReset(); vi.stubGlobal("fetch", fetchBoundary); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("RelationshipSection with real children and API client", () => {
  it("changes the property, adds a filtered search result, removes it and reads the updated parent state", async () => {
    function Editor() {
      const [groups, setGroups] = useState([group]);
      const [editing, setEditing] = useState(true);
      const [saves, setSaves] = useState(0);
      return <><RelationshipSection groups={groups} isEditing={editing} projectId="project" accessToken="fixture-token" branch="feature/search"
        onChangeProperty={(index, iri, label) => setGroups(old => old.map((g, i) => i === index ? { ...g, property_iri: iri, property_label: label } : g))}
        onAddTarget={(index, target) => setGroups(old => old.map((g, i) => i === index ? { ...g, targets: [...g.targets, target] } : g))}
        onRemoveTarget={(index, target) => setGroups(old => old.map((g, i) => i === index ? { ...g, targets: g.targets.filter((_, n) => n !== target) } : g))}
        onSaveNeeded={() => setSaves(n => n + 1)} />
        <button onClick={() => setEditing(false)}>Read</button><output>{saves} saves</output></>;
    }
    fetchBoundary.mockResolvedValueOnce(response([{ iri: "https://example.test/related", label: "", entity_type: "property" }]))
      .mockResolvedValueOnce(response([{ iri: group.targets[0].iri, label: "Existing", entity_type: "class" }, { iri: "https://example.test/New", label: "", entity_type: "individual" }]));
    render(<Editor />);
    propertySearch(" related ");
    await debounce();
    const [url, options] = fetchBoundary.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/api/v1/projects/project/ontology/search");
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({ q: "related", branch: "feature/search", entity_types: "property" });
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer fixture-token");
    fireEvent.click(screen.getByRole("button", { name: "related" }));
    expect(screen.queryByPlaceholderText("Search properties...")).toBeNull();
    const input = entitySearch("New");
    await debounce();
    expect(screen.getAllByText("Existing")).toHaveLength(1);
    expect(new URL(String(fetchBoundary.mock.calls[1][0])).searchParams.has("entity_types")).toBe(false);
    fireEvent.click(screen.getByText("New"));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText("1 saves")).toBeDefined();
    fireEvent.click(screen.getAllByTitle("Remove")[0]);
    expect(screen.queryByText("Existing")).toBeNull();
    expect(screen.getByText("2 saves")).toBeDefined();
    fireEvent.click(screen.getByText("Read"));
    expect(screen.getByText("related")).toBeDefined();
    expect((screen.getByRole("button", { name: "New" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["properties", "entities"])("renders an empty state after %s search fails and recovers on a new query", async kind => {
    fetchBoundary.mockResolvedValueOnce(new Response("forbidden", { status: 403 })).mockResolvedValueOnce(response([{ iri: "https://example.test/Recovered", label: "Recovered", entity_type: "property" }]));
    edit();
    if (kind === "properties") propertySearch("missing"); else entitySearch("missing");
    await debounce();
    expect(screen.getByText(kind === "properties" ? "No matching properties" : "No results found")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText(kind === "properties" ? "Search properties..." : "Search entities to add..."), { target: { value: "Recovered" } });
    await debounce();
    expect(screen.getByText("Recovered")).toBeDefined();
  });

  it.each(["properties", "entities"])("ignores an obsolete %s response after the query is cleared", async kind => {
    let complete!: (response: Response) => void;
    fetchBoundary.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    edit();
    if (kind === "properties") propertySearch("stale"); else entitySearch("stale");
    await debounce();
    fireEvent.change(screen.getByPlaceholderText(kind === "properties" ? "Search properties..." : "Search entities to add..."), { target: { value: "  " } });
    await act(async () => complete(response([{ iri: "https://example.test/Stale", label: "Stale", entity_type: "class" }])));
    expect(screen.queryByText("Stale")).toBeNull();
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
  });

  it("closes each picker on Escape and outside clicks, while inside clicks retain the property picker", async () => {
    fetchBoundary.mockResolvedValue(response([]));
    edit();
    propertySearch("none");
    await debounce();
    fireEvent.mouseDown(screen.getByPlaceholderText("Search properties..."));
    expect(screen.getByText("No matching properties")).toBeDefined();
    fireEvent.keyDown(screen.getByPlaceholderText("Search properties..."), { key: "Escape" });
    expect(screen.queryByPlaceholderText("Search properties...")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See Also" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText("Search properties...")).toBeNull();
    const input = entitySearch("none");
    await debounce();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText("No results found")).toBeNull();
    fireEvent.focus(input);
    expect(screen.getByText("No results found")).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("No results found")).toBeNull();
  });

  it("filters built-in properties by CURIE and debounces replaced queries before transport", async () => {
    fetchBoundary.mockResolvedValue(response([]));
    edit();
    propertySearch("ignored");
    fireEvent.change(screen.getByPlaceholderText("Search properties..."), { target: { value: "RDFS:ISDEFINEDBY" } });
    expect(screen.getByText("Defined By")).toBeDefined();
    expect(screen.queryByText("rdfs:seeAlso")).toBeNull();
    await debounce();
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchBoundary.mock.calls[0][0])).searchParams.get("q")).toBe("RDFS:ISDEFINEDBY");
  });
  it.each(["properties", "entities"])("ignores a rejected obsolete %s request while showing newer results", async kind => {
    let rejectOld!: (error: Error) => void;
    fetchBoundary.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce(response([{ iri: "https://example.test/Current", label: "Current", entity_type: "class" }]));
    edit();
    if (kind === "properties") propertySearch("old"); else entitySearch("old");
    await debounce();
    fireEvent.change(screen.getByPlaceholderText(kind === "properties" ? "Search properties..." : "Search entities to add..."), { target: { value: "current" } });
    await debounce();
    await act(async () => rejectOld(new Error("Obsolete transport failed")));
    expect(screen.getByText("Current")).toBeDefined();
    expect(screen.queryByText(kind === "properties" ? "No matching properties" : "No results found")).toBeNull();
  });

  it("renders labelled property results and supports search selections without optional mutation callbacks", async () => {
    fetchBoundary.mockResolvedValueOnce(response([{ iri: "https://example.test/p", label: "Custom property", entity_type: "property" }]))
      .mockResolvedValueOnce(response([{ iri: "https://example.test/Other", label: "Other entity", entity_type: "future-type" }]));
    edit();
    propertySearch("custom");
    await debounce();
    fireEvent.click(screen.getByRole("button", { name: "Custom property" }));
    expect(screen.queryByPlaceholderText("Search properties...")).toBeNull();
    const input = entitySearch("Other");
    await debounce();
    const result = screen.getByRole("button", { name: /Other entity/ });
    expect(result.textContent).toContain("C");
    fireEvent.click(result);
    expect((input as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Existing" }));
    fireEvent.click(screen.getByTitle("Remove"));
    expect(screen.getByText("Existing")).toBeDefined();
  });

});
