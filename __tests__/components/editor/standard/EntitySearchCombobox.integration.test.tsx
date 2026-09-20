import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EntitySearchCombobox } from "@/components/editor/standard/EntitySearchCombobox";

const person = { iri: "https://example.test/Person", label: "Person", entity_type: "class", deprecated: false };
const excluded = { ...person, iri: "https://example.test/Excluded", label: "Excluded" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function mount() {
  const onSelect = vi.fn(), onClose = vi.fn();
  render(<EntitySearchCombobox projectId="search-project" accessToken="test-token" branch="feature/search" entityTypes="class" excludeIris={[excluded.iri]} onSelect={onSelect} onClose={onClose} />);
  return { onSelect, onClose };
}
async function search(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search entities..."), { target: { value } });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

describe("entity search through real text and semantic clients", () => {
  it("falls back to text when semantic search is unavailable and selects only eligible results", async () => {
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input)); paths.push(url.pathname);
      expect(url.searchParams.get("q")).toBe("Person");
      expect(url.searchParams.get("branch")).toBe("feature/search");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
      if (url.pathname.endsWith("/search/semantic")) return json({ detail: "Index unavailable" }, 422);
      expect(url.pathname).toBe("/api/v1/projects/search-project/ontology/search");
      expect(url.searchParams.get("entity_types")).toBe("class");
      return json({ results: [excluded, person], total: 2 });
    }));
    const { onSelect, onClose } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Toggle semantic search" }));
    await search("  Person  ");
    expect(screen.queryByText("Excluded")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Person/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(person);
    expect(onClose).toHaveBeenCalledOnce();
    expect(paths).toEqual(["/api/v1/projects/search-project/search/semantic", "/api/v1/projects/search-project/ontology/search"]);
  });

  it("clears old results after an HTTP error and recovers on the next query", async () => {
    const queries: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const query = new URL(String(input)).searchParams.get("q")!; queries.push(query);
      return query === "broken" ? json({ detail: "Search refused" }, 403) : json({ results: [person], total: 1 });
    }));
    const { onSelect } = mount();
    await search("Person");
    expect(screen.getByText("Person")).toBeDefined();
    await search("broken");
    expect(screen.getByText("No results found")).toBeDefined();
    expect(screen.queryByText("Person")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    await search("Person again");
    expect(screen.getByText("Person")).toBeDefined();
    await search(" ");
    expect(screen.getByText("Type to search")).toBeDefined();
    expect(queries).toEqual(["Person", "broken", "Person again"]);
  });
});
