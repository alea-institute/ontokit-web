import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyAssertionSection } from "@/components/editor/standard/PropertyAssertionSection";
import type { PropertyAssertion } from "@/lib/ontology/entityDetailExtractors";

const fetchBoundary = vi.fn<typeof fetch>();
const propertyIri = "https://example.test/hasValue";
const targetIri = "https://example.test/Target";
function response(results: { iri: string; label?: string }[]) {
  return new Response(JSON.stringify({ results, total: results.length }));
}
function Editor({ type = "object" }: { type?: "object" | "data" }) {
  const [assertions, setAssertions] = useState<PropertyAssertion[]>([]);
  const [saves, setSaves] = useState(0);
  const [selected, setSelected] = useState("");
  return <>
    <PropertyAssertionSection assertions={assertions} assertionType={type} isEditing
      projectId="project" accessToken="fixture-token" branch="feature/assertions"
      onAdd={assertion => setAssertions(current => [...current, assertion])}
      onRemove={index => setAssertions(current => current.filter((_, i) => i !== index))}
      onNavigateToEntity={setSelected} onSaveNeeded={() => setSaves(count => count + 1)} />
    <output aria-label="Assertions">{JSON.stringify(assertions)}</output>
    <output>{saves} saves</output><output aria-label="Selected entity">{selected}</output>
  </>;
}
async function search(placeholder: string, query: string) {
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  return input;
}
async function selectProperty() {
  fetchBoundary.mockResolvedValueOnce(response([{ iri: propertyIri }]));
  await search("Select property...", " hasValue ");
  fireEvent.click(screen.getByRole("button", { name: "hasValue" }));
}
beforeEach(() => { vi.useFakeTimers(); fetchBoundary.mockReset(); vi.stubGlobal("fetch", fetchBoundary); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("property assertion editing through real search and parent state", () => {
  it("searches with branch and credentials, adds an object assertion, navigates and removes it", async () => {
    render(<Editor />);
    expect((screen.getByPlaceholderText("Select a property first") as HTMLInputElement).disabled).toBe(true);
    await selectProperty();
    const [url, options] = fetchBoundary.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/api/v1/projects/project/ontology/search");
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({ q: "hasValue", branch: "feature/assertions", entity_types: "property" });
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer fixture-token");
    fetchBoundary.mockResolvedValueOnce(response([{ iri: targetIri }]));
    const input = await search("Search entity...", "Target");
    fireEvent.mouseDown(input);
    expect(screen.getByRole("button", { name: /Target https/ })).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: /Target https/ })).toBeNull();
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: /Target https/ }));
    expect(new URL(String(fetchBoundary.mock.calls[1][0])).searchParams.has("entity_types")).toBe(false);
    expect(screen.getByLabelText("Assertions").textContent).toBe(JSON.stringify([{ propertyIri, targetIri }]));
    expect(screen.getByText("1 saves")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Target" }));
    expect(screen.getByLabelText("Selected entity").textContent).toBe(targetIri);
    fireEvent.click(screen.getByTitle("Remove"));
    expect(screen.getByLabelText("Assertions").textContent).toBe("[]");
    expect(screen.getByText("2 saves")).toBeDefined();
  });

  it.each(["Enter", "blur"])("adds a trimmed data assertion without a language via %s", async method => {
    render(<Editor type="data" />);
    await selectProperty();
    fireEvent.change(screen.getByTitle("Language tag"), { target: { value: " " } });
    const input = screen.getByPlaceholderText("Enter value...");
    fireEvent.change(input, { target: { value: "  literal value  " } });
    if (method === "Enter") fireEvent.keyDown(input, { key: "Enter" });
    else fireEvent.blur(input);
    expect(screen.getByLabelText("Assertions").textContent).toBe(JSON.stringify([{ propertyIri, value: "literal value" }]));
    expect(screen.getByText("1 saves")).toBeDefined();
    expect((screen.getByTitle("Language tag") as HTMLInputElement).value).toBe("en");
    expect((screen.getByPlaceholderText("Select a property first") as HTMLInputElement).value).toBe("");
  });

  it("recovers both search pickers after HTTP failures without mutating assertions", async () => {
    render(<Editor />);
    fetchBoundary.mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await search("Select property...", "blocked");
    expect(screen.getByText("No properties found")).toBeDefined();
    await selectProperty();
    fetchBoundary.mockResolvedValueOnce(new Response("unavailable", { status: 403 }));
    await search("Search entity...", "failed");
    expect(screen.getByText("No results")).toBeDefined();
    expect(screen.getByText("0 saves")).toBeDefined();
    fetchBoundary.mockResolvedValueOnce(response([{ iri: targetIri, label: "Recovered target" }]));
    await search("Search entity...", "recovered");
    fireEvent.click(screen.getByRole("button", { name: /Recovered target/ }));
    expect(screen.getByLabelText("Assertions").textContent).toBe(JSON.stringify([{ propertyIri, targetIri }]));
    expect(screen.getByText("1 saves")).toBeDefined();
  });
});
