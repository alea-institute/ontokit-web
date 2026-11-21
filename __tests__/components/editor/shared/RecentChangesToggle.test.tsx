import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentChangesTree } from "@/components/editor/shared/RecentChangesToggle";
import { EntityTreeNodeRow } from "@/components/editor/shared/EntityTreeNode";
import { EntityHistoryTab } from "@/components/editor/EntityHistoryTab";
import { ClassTree } from "@/components/editor/ClassTree";
import { useInvalidateChangedEntitiesAfterSave } from "@/lib/hooks/useChangedEntities";
import { branchQueryKeys } from "@/lib/context/BranchContext";
import type { ClassTreeNode } from "@/lib/ontology/types";

const { renderRow } = vi.hoisted(() => ({ renderRow: vi.fn() }));
vi.mock("@dnd-kit/core", () => ({
  useDraggable: ({ id }: { id: string }) => {
    renderRow(id);
    return { attributes: {}, listeners: {} };
  },
  useDroppable: () => ({}),
}));

const iri = (name: string) => `https://example.org/onto#${name}`;
const nodes: ClassTreeNode[] = [
  "Added", "Modified", "Generated", "Edited", "Untouched", "New kind", "New origin", "Transient", "Removed",
].map((label) => ({
  iri: iri(label),
  label,
  children: [],
  hasChildren: label === "Untouched",
  isExpanded: false,
  isLoading: false,
}));
const select = vi.fn();
const expand = vi.fn();
const collapse = vi.fn();
const project = "project-one";
const branch = "feature/review";
const change = (label: string, net_change: string, origins = ["human"]) => ({
  entity_iri: iri(label),
  net_change,
  origins,
  last_changed_at: "2026-11-19T10:00:00Z",
});
const fetchChanges = vi.fn();

function Editor({ showTree, projectId, activeBranch }: { showTree: boolean; projectId: string; activeBranch: string }) {
  useInvalidateChangedEntitiesAfterSave(projectId);
  return showTree && (
    <RecentChangesTree projectId={projectId} branch={activeBranch} visible>
      <ClassTree nodes={nodes} onSelect={select} onExpand={expand} onCollapse={collapse} />
    </RecentChangesTree>
  );
}

function mount(client = new QueryClient(), projectId = project, activeBranch = branch) {
  const editor = (showTree: boolean) => (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <Editor showTree={showTree} projectId={projectId} activeBranch={activeBranch} />
      </TooltipProvider>
    </QueryClientProvider>
  );
  const view = render(editor(true));
  return { ...view, showTree: (visible: boolean) => view.rerender(editor(visible)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fetchChanges.mockReset().mockImplementation(async () => Response.json({ items: [], truncated: false }));
  vi.stubGlobal("fetch", fetchChanges);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Recent changes in the class tree", () => {
  it("keeps standalone tree rows and history free of change markers, badges, and requests", async () => {
    const node = nodes[0];
    fetchChanges.mockResolvedValueOnce(Response.json({
      total: 1,
      events: [{
        id: "event-one",
        event_type: "create",
        user_name: "Example author",
        changed_fields: [],
        created_at: "2026-11-19T10:00:00Z",
        origin: "ai",
        origin_model: "example-model",
      }],
    }));
    const client = new QueryClient();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <EntityTreeNodeRow node={node} depth={0} onSelect={select} onExpand={expand} onCollapse={collapse} />
        <EntityHistoryTab projectId={project} entityIri={node.iri} branch={branch} />
      </QueryClientProvider>,
    );

    const row = screen.getByRole("treeitem", { name: node.label });
    expect(within(row).queryByRole("img")).toBeNull();
    await user.click(row);
    expect(select).toHaveBeenCalledWith(node.iri);

    await user.click(await screen.findByRole("button", { name: "History (1)" }));
    expect(screen.getByText("Example author")).toBeDefined();
    expect(screen.queryByText("AI", { exact: true })).toBeNull();
    expect(screen.queryByText("example-model")).toBeNull();
    expect(fetchChanges.mock.calls.map(([request]) => new URL(String(request)).pathname)).toEqual([
      `/api/v1/projects/${project}/analytics/entity/${encodeURIComponent(node.iri)}/history`,
    ]);
  });

  it("fetches once on enable, marks only loaded rows, and preserves unchanged row renders", async () => {
    fetchChanges.mockResolvedValueOnce(Response.json({
      items: [
        change("Added", "added"),
        change("Modified", "modified"),
        change("Generated", "added", ["ai"]),
        change("Edited", "added", ["ai_edited"]),
        change("New kind", "changed", ["ai"]),
        change("New origin", "added", ["future_origin", "ai"]),
        change("Transient", "transient"),
        change("Removed", "removed"),
        change("Unloaded", "added"),
      ],
      truncated: true,
    }));
    const user = userEvent.setup();
    const client = new QueryClient();
    const view = mount(client);

    const toggle = screen.getByRole("switch", { name: "Show recent changes" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(fetchChanges).not.toHaveBeenCalled();
    const untouched = screen.getByRole("treeitem", { name: "Untouched" });
    const untouchedRenders = () => renderRow.mock.calls.filter(([id]) => id === iri("Untouched")).length;
    const initialRenders = untouchedRenders();

    await user.tab();
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(" ");
    const link = screen.getByRole("link", { name: "View all changes" });
    await user.tab();
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute("href")).toBe("/projects/project-one/changes?branch=feature%2Freview");

    const tree = within(screen.getByRole("tree"));
    for (const [name, suffix, mark, provenance] of [
      ["Added", ", added", "Added"],
      ["Modified", ", modified", "Modified"],
      ["Generated", ", added from an AI suggestion", "Added", "added from an AI suggestion"],
      ["Edited", ", added from an AI suggestion and edited before accepting", "Added", "added from an AI suggestion and edited before accepting"],
      ["New kind", "", "Changed"],
      ["New origin", "", "Changed"],
      ["Transient", ", added, then removed", "Added, then removed"],
      ["Removed", ", removed", "Removed"],
    ]) {
      const row = await tree.findByRole("treeitem", { name: `${name}, changed in the last 7 days${suffix}` });
      expect(within(row).getByRole("img", { name: mark })).toBeDefined();
      expect(within(row).getAllByRole("img").map((icon) => icon.getAttribute("aria-label")))
        .toEqual(provenance ? [mark, provenance] : [mark]);
    }
    expect(screen.getByText("Showing the 5,000 most recent changes. View all changes for the full list.")).toBeDefined();
    expect(screen.getByText("Marks appear on loaded classes. View all changes for the complete list.")).toBeDefined();
    expect(tree.queryByRole("treeitem", { name: /Unloaded/ })).toBeNull();
    expect(tree.getByRole("treeitem", { name: "Untouched" })).toBe(untouched);
    expect(untouchedRenders()).toBe(initialRenders);
    expect(expand).not.toHaveBeenCalled();
    expect(fetchChanges).toHaveBeenCalledTimes(1);
    const request = new URL(String(fetchChanges.mock.calls[0][0]));
    expect(request.pathname).toBe("/api/v1/projects/project-one/analytics/changed-entities");
    expect(Object.fromEntries(request.searchParams)).toEqual({ branch, days: "7" });

    view.unmount();
    const remount = mount(client);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(fetchChanges).toHaveBeenCalledTimes(1);
    remount.unmount();
    mount(client, "project-two");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(fetchChanges).toHaveBeenCalledTimes(1);
  });

  it("attributes a modified class's AI provenance to its creation in the marker and tooltip", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    fetchChanges.mockResolvedValueOnce(Response.json({
      items: [change("Modified", "modified", ["ai", "human"])],
      truncated: false,
    }));
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("switch"));
    const detail = "changed in the last 7 days, modified, created from an AI suggestion";
    const row = await screen.findByRole("treeitem", { name: `Modified, ${detail}` });
    expect(within(row).getByRole("img", { name: "Modified" })).toBeDefined();
    await user.hover(within(row).getByRole("img", { name: "created from an AI suggestion" }));
    expect((await screen.findByRole("tooltip")).textContent).toBe(detail);
  });

  it("remains operable when localStorage reads and writes throw", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    const user = userEvent.setup();
    mount();

    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByText("No changes in the last 7 days.");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("No changes in the last 7 days.")).toBeNull();
    expect(fetchChanges).toHaveBeenCalledTimes(1);
  });

  it("shows loading, supports Retry after an error, and keeps the tree usable", async () => {
    let finish: (response: Response) => void = () => {};
    fetchChanges.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading recent changes…")).toBeDefined();
    finish(Response.json({ detail: "Unavailable" }, { status: 403 }));

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByText("Could not load recent changes.")).toBeDefined();
    await user.click(screen.getByRole("treeitem", { name: "Untouched" }));
    expect(select).toHaveBeenCalledWith(iri("Untouched"));
    await user.click(retry);
    await screen.findByText("No changes in the last 7 days.");
    expect(fetchChanges).toHaveBeenCalledTimes(2);
  });

  it("refreshes the marked branch after its commit changes and skips requests while off", async () => {
    const client = new QueryClient();
    const key = branchQueryKeys.list(project);
    let branchTip = "feature-before";
    let mainTip = "main-before";
    const loadBranches = () => Promise.resolve({
      items: [{ name: branch, commit_hash: branchTip }, { name: "main", commit_hash: mainTip }],
    });
    const refreshBranches = async () => {
      await client.invalidateQueries({ queryKey: key });
      await client.fetchQuery({ queryKey: key, queryFn: loadBranches });
    };
    await refreshBranches();
    let finishInitial: (response: Response) => void = () => {};
    fetchChanges.mockReturnValueOnce(new Promise<Response>((resolve) => { finishInitial = resolve; }));
    const user = userEvent.setup();
    const view = mount(client);
    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch").getAttribute("aria-busy")).toBe("true");

    mainTip = "main-after";
    await act(refreshBranches);
    expect(fetchChanges).toHaveBeenCalledTimes(1);
    branchTip = "feature-after";
    await act(refreshBranches);
    await waitFor(() => expect(fetchChanges).toHaveBeenCalledTimes(2));
    await screen.findByText("No changes in the last 7 days.");
    await act(async () => finishInitial(Response.json({ items: [change("Added", "added")], truncated: false })));
    expect(screen.getByRole("treeitem", { name: "Added" })).toBeDefined();

    await user.click(screen.getByRole("switch"));
    branchTip = "feature-latest";
    await act(refreshBranches);
    expect(fetchChanges).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("switch"));
    await waitFor(() => expect(fetchChanges).toHaveBeenCalledTimes(3));
    await screen.findByText("No changes in the last 7 days.");

    view.showTree(false);
    branchTip = "source-saved";
    await act(refreshBranches);
    expect(fetchChanges).toHaveBeenCalledTimes(3);
    view.showTree(true);
    await waitFor(() => expect(fetchChanges).toHaveBeenCalledTimes(4));
  });
});
