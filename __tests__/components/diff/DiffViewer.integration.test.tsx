import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { SemanticDiff } from "@/components/diff/TripleChange";
import type { RevisionDiffResponse, TripleChange } from "@/lib/api/revisions";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const diff = (types: string[]): RevisionDiffResponse => ({
  project_id: "project", from_version: "feature/source", to_version: "release/target",
  files_changed: types.length,
  changes: types.map((change_type, i) => ({ path: `ontology-${i}.ttl`, change_type, additions: 1, deletions: 0 })),
});
afterEach(() => vi.unstubAllGlobals());

describe("DiffViewer real revision transport", () => {
  it("encodes revisions, sends credentials and expands files independently including an unknown change type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(diff(["added", "deleted", "modified", "renamed", "T"])));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DiffViewer projectId="project" fromVersion="feature/source" toVersion="release/target" accessToken="test-token" />);
    await screen.findByText("5 files changed");
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("from_version")).toBe("feature/source");
    expect(new URL(url).searchParams.get("to_version")).toBe("release/target");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    expect(new URL(url).pathname).toBe("/api/v1/projects/project/revisions/diff");
    expect(screen.getByText("feature/ ... release/")).toBeDefined();
    for (const name of ["Added", "Deleted", "Modified", "Renamed"]) expect(screen.getByText(name)).toBeDefined();
    const unknown = screen.getByRole("button", { name: "ontology-4.ttl" });
    await user.click(unknown);
    await user.click(screen.getByRole("button", { name: /ontology-0/ }));
    expect(screen.getAllByText("Detailed diff view coming soon")).toHaveLength(2);
    await user.click(unknown);
    expect(screen.getAllByText("Detailed diff view coming soon")).toHaveLength(1);
  });

  it("shows a transport failure and retries when the compared revision changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("connection unavailable"))
      .mockResolvedValueOnce(response(diff(["M"]))));
    const { rerender } = render(<DiffViewer projectId="project" fromVersion="old" />);
    await screen.findByText("connection unavailable");
    rerender(<DiffViewer projectId="project" fromVersion="new" />);
    await screen.findByText("1 file changed");
    expect(screen.queryByText("connection unavailable")).toBeNull();
  });

  it("loads a singular comparison and then clears its files for an empty revision", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(diff(["M"])))
      .mockResolvedValueOnce(response(diff([])));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<DiffViewer projectId="project" fromVersion="available" />);
    await screen.findByText("1 file changed");
    expect(screen.getByText("availabl ... HEAD")).toBeDefined();
    rerender(<DiffViewer projectId="project" fromVersion="same" />);
    await screen.findByText("No changes between these versions");
    expect(screen.queryByRole("button")).toBeNull();
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has("Authorization")).toBe(false);
  });
});

describe("SemanticDiff real triple rendering", () => {
  it.each([
    ["http://www.w3.org/2001/XMLSchema#string", "xsd:string"],
    ["http://purl.org/dc/terms/description", "dcterms:description"],
    ["http://purl.org/dc/elements/1.1/title", "dc:title"],
    [`https://example.org/${"long-namespace/".repeat(5)}label`, "...label"],
    ["urn:local-predicate", "urn:local-predicate"],
  ])("preserves full annotation IRI %s while abbreviating its visible label", (predicate, label) => {
    const triple: TripleChange = { subject: "urn:entity", predicate, object: "<b>literal & text</b>", change_type: "added" };
    const { container } = render(<SemanticDiff added={[triple]} removed={[]} />);
    expect(screen.getByTitle(predicate).textContent).toBe(label);
    expect(screen.getByTitle(triple.object).textContent).toBe(`“${triple.object}”`);
    expect(container.querySelector("b")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Removed" })).toBeNull();
  });

  it("keeps removed and added values in separate sections across a replacement and empty comparison", () => {
    const common = { subject: "https://example.org/Thing", predicate: "http://purl.org/dc/terms/title" };
    const { rerender } = render(<SemanticDiff
      added={[{ ...common, object: "https://example.org/New", change_type: "added" }]}
      removed={[{ ...common, object: "Old title", change_type: "removed" }]} />);
    const removed = screen.getByRole("heading", { name: "Removed" }).parentElement!;
    const added = screen.getByRole("heading", { name: "Added" }).parentElement!;
    expect(within(removed).getByTitle("Old title").textContent).toBe("“Old title”");
    expect(within(added).getByTitle("https://example.org/New").textContent).toBe("https://example.org/New");
    expect(within(removed).queryByTitle("https://example.org/New")).toBeNull();
    rerender(<SemanticDiff added={[]} removed={[]} />);
    expect(screen.getByText("No semantic changes detected")).toBeDefined();
    expect(screen.queryByTitle("Old title")).toBeNull();
  });
});
