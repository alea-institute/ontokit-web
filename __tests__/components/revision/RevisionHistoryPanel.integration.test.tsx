import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RevisionHistoryPanel, HistoryButton } from "@/components/revision/RevisionHistoryPanel";
import { BranchProvider } from "@/lib/context/BranchContext";
import type { RevisionCommit } from "@/lib/api/revisions";

const fetchMock = vi.fn<typeof fetch>();
const clients: QueryClient[] = [];
const root: RevisionCommit = { hash: "abc123000", short_hash: "abc1230", message: "Create ontology", author_name: "Test Author", author_email: "author@example.test", parent_hashes: [], timestamp: "2025-02-01T12:00:00Z" };
const head: RevisionCommit = { ...root, hash: "def456000", short_hash: "def4560", message: "Clarify terminology\n\nUpdate the label", parent_hashes: [root.hash], timestamp: "2026-02-01T12:00:00Z" };
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
function history(commits = [head, root]) { return json({ project_id: "history-project", commits, total: commits.length, refs: { [head.hash]: ["main"] } }); }
function configure(historyResponse: () => Response = () => history(), diffResponse: () => Response = () => json({
  project_id: "history-project", from_version: root.hash, to_version: head.hash, files_changed: 1,
  changes: [{ path: "ontology.ttl", change_type: "M", additions: 1, deletions: 1, patch: "@@ -1 +1 @@\n-Old label\n+New label" }],
})) {
  fetchMock.mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/branches")) return json({ items: [], current_branch: "main", default_branch: "main" });
    if (url.pathname.endsWith("/revisions/diff")) return diffResponse();
    if (url.pathname.endsWith("/revisions")) return historyResponse();
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}
function mount(onSelectRevision?: (commit: RevisionCommit) => void, accessToken: string | undefined = "history-token") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  function Harness() {
    const [open, setOpen] = useState(true);
    return <QueryClientProvider client={client}><BranchProvider projectId="history-project" accessToken={accessToken}>
      <HistoryButton isOpen={open} onClick={() => setOpen(!open)} />
      <RevisionHistoryPanel projectId="history-project" accessToken={accessToken} isOpen={open} onClose={() => setOpen(false)} onSelectRevision={onSelectRevision} />
    </BranchProvider></QueryClientProvider>;
  }
  return render(<Harness />);
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Revision history through real graph, detail and API", () => {
  it("copies the selected commit hash and resets its success indicator for another copy", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      configure(); mount();
      fireEvent.click(await screen.findByText("Create ontology"));
      const button = screen.getByTitle("Copy full hash");
      vi.useFakeTimers();
      await act(async () => { fireEvent.click(button); });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(root.hash);
      expect(button.querySelector(".lucide-check")).not.toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
      expect(button.querySelector(".lucide-check")).not.toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(button.querySelector(".lucide-check")).toBeNull();
      expect(button.querySelector(".lucide-copy")).not.toBeNull();
      await act(async () => { fireEvent.click(button); });
      expect(writeText.mock.calls).toEqual([[root.hash], [root.hash]]);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    } finally {
      if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("selects a graph node, loads its diff and returns to the selected list row", async () => {
    configure();
    const select = vi.fn();
    const { container } = mount(select);
    await screen.findByText(/Clarify terminology/);
    const nodes = container.querySelectorAll(".commit-node");
    expect(nodes).toHaveLength(2);
    fireEvent.click(nodes[0]);
    expect(select).toHaveBeenCalledWith(head);
    expect(await screen.findByText("+New label")).toBeDefined();
    expect(screen.getByText("Update the label")).toBeDefined();
    expect(screen.getByText("1 file changed")).toBeDefined();
    const [diffUrl, options] = fetchMock.mock.calls.find(([url]) => String(url).includes("/revisions/diff"))!;
    expect(new URL(String(diffUrl)).searchParams.get("from_version")).toBe(root.hash);
    expect(new URL(String(diffUrl)).searchParams.get("to_version")).toBe(head.hash);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer history-token");
    fireEvent.click(screen.getByRole("button", { name: /ontology.ttl/ }));
    expect(screen.queryByText("+New label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ontology.ttl/ }));
    expect(screen.getByText("+New label")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(/Clarify terminology/).closest("button")?.className).toContain("bg-primary-50");
    expect(container.querySelector(".commit-node circle[opacity='0.4']")).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/revisions/diff"))).toHaveLength(1);
  });

  it("keeps an unfamiliar file-change status visible when a revision has no text patch", async () => {
    configure(undefined, () => json({ project_id: "history-project", from_version: root.hash, to_version: head.hash, files_changed: 1,
      changes: [{ path: "ontology.ttl", change_type: "T", additions: 0, deletions: 0, patch: null }],
    }));
    mount();
    fireEvent.click(await screen.findByText(/Clarify terminology/));
    const file = await screen.findByRole("button", { name: /ontology.ttl/ });
    expect(file.textContent).toContain("T");
    expect(screen.getByText("1 file changed")).toBeDefined();
    fireEvent.click(file);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Create ontology")).toBeDefined();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/revisions/diff"))).toHaveLength(1);
  });

  it("opens the initial commit without a selection callback or a diff request", async () => {
    configure(); mount();
    fireEvent.click(await screen.findByText("Create ontology"));
    expect(screen.getByText("Initial commit - no parent to compare")).toBeDefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/revisions/diff"))).toBe(false);
  });

  it("surfaces history errors and retries when the user reopens the panel", async () => {
    let attempts = 0;
    configure(() => ++attempts === 1 ? new Response("History unavailable", { status: 403 }) : history());
    mount();
    expect(await screen.findByText("History unavailable")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.queryByText("Revision History")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Create ontology")).toBeDefined();
    expect(screen.queryByText("History unavailable")).toBeNull();
    expect(attempts).toBe(2);
  });

  it("keeps history navigation usable after the selected diff request fails", async () => {
    configure(undefined, () => new Response("Revision no longer available", { status: 404 }));
    mount();
    fireEvent.click(await screen.findByText(/Clarify terminology/));
    expect(await screen.findByText("Revision no longer available")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByText("Create ontology"));
    expect(screen.getByText("Initial commit - no parent to compare")).toBeDefined();
    expect(screen.queryByText("Revision no longer available")).toBeNull();
  });

  it("shows empty history from the server without rendering graph nodes", async () => {
    configure(() => history([]));
    const { container } = mount();
    expect(await screen.findByText("No revision history yet")).toBeDefined();
    expect(container.querySelector(".commit-node")).toBeNull();
    const [url] = fetchMock.mock.calls.find(([input]) => String(input).includes("/revisions"))!;
    expect(new URL(String(url)).searchParams.get("limit")).toBe("50");
  });

  it("formats older dates with a year only when it differs from the current year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
    const currentYear = new Date().getFullYear();
    const thisYear = new Date(currentYear, 0, 1, 12);
    const lastYear = new Date(currentYear - 1, 0, 1, 12);
    configure(() => history([{ ...head, timestamp: thisYear.toISOString() }, { ...root, timestamp: lastYear.toISOString() }]));
    mount();
    await screen.findByText("Create ontology");
    expect(screen.getByText(thisYear.toLocaleDateString(undefined, { month: "short", day: "numeric" }))).toBeDefined();
    expect(screen.getByText(lastYear.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }))).toBeDefined();
  });

  it("closes through the panel callback and reopens through the real history trigger", async () => {
    configure(); mount();
    await screen.findByText("Create ontology");
    const header = screen.getByText("Revision History").parentElement?.parentElement;
    fireEvent.click(header!.querySelector("button")!);
    expect(screen.queryByText("Revision History")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await waitFor(() => expect(screen.getByText("Create ontology")).toBeDefined());
    expect(fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/revisions"))).toHaveLength(2);
  });
});
