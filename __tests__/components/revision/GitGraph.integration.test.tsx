import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { GitGraph } from "@/components/revision/GitGraph";
import type { RevisionCommit } from "@/lib/api/revisions";

function commit(hash: string, parent_hashes: string[] = []): RevisionCommit {
  return { hash, short_hash: hash, parent_hashes, message: hash, author_name: "Fixture author", author_email: "fixture@example.invalid", timestamp: "2026-09-19T00:00:00Z" };
}
const diamond = [commit("merge", ["main-tip", "feature-tip"]), commit("main-tip", ["root"]), commit("feature-tip", ["root"]), commit("root")];
const refs = { merge: ["main"], "feature-tip": ["feature/topic"] };
afterEach(cleanup);

describe("GitGraph with real commit layout", () => {
  it.each([true, false])("keeps a disconnected history separate when the default branch ref is present: %s", hasDefaultRef => {
    const commits = [commit("head", ["base"]), commit("archive-root"), commit("base")];
    const historyRefs = { head: [hasDefaultRef ? "main" : "feature"], "archive-root": ["archive"] };
    const { container } = render(<GitGraph commits={commits} refs={historyRefs} defaultBranch="main" />);
    const nodes = Array.from(container.querySelectorAll(".commit-node"));
    expect(nodes).toHaveLength(3);
    const centers = nodes.map(node => { const circle = node.querySelector("circle")!; return [circle.getAttribute("cx"), circle.getAttribute("cy")]; });
    expect(centers).toEqual([["10", "25"], ["30", "75"], ["10", "125"]]);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute("d")).toBe("M 10 25 L 10 125");
    expect(paths[0].getAttribute("stroke-dasharray")).toBeNull();
  });

  it("draws the merge and branch-back arcs between real commit coordinates", () => {
    const selected = vi.fn();
    const { container } = render(<GitGraph commits={diamond} refs={refs} defaultBranch="main" onSelectCommit={selected} config={{ cellWidth: 40, cellHeight: 60, colors: ["red", "blue"] }} />);
    const nodes = container.querySelectorAll(".commit-node");
    expect(nodes).toHaveLength(4);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("240");
    const centers = Array.from(nodes).map(node => { const circle = node.querySelector("circle")!; return [circle.getAttribute("cx"), circle.getAttribute("cy")]; });
    expect(centers).toEqual([["20", "30"], ["20", "90"], ["60", "150"], ["20", "210"]]);
    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths).toHaveLength(4);
    const mergePath = paths.find(path => path.getAttribute("stroke-dasharray") === "4,2")!;
    expect(mergePath.getAttribute("stroke")).toBe("blue");
    expect(mergePath.getAttribute("d")).toMatch(/^M 20 30 C .* L 60 150$/);
    const branchBack = paths.find(path => path.getAttribute("d")?.startsWith("M 60 150"))!;
    expect(branchBack.getAttribute("d")).toMatch(/^M 60 150 L .* C .* L .* C .*20 210$/);
    expect(branchBack.getAttribute("stroke-dasharray")).toBeNull();
    expect(nodes[0].querySelectorAll("circle")).toHaveLength(2);
    expect(nodes[0].querySelector("circle")?.getAttribute("fill")).toBe("white");
    fireEvent.click(nodes[2]); expect(selected).toHaveBeenCalledExactlyOnceWith("feature-tip");
  });
  it("recomputes topology and selection when the caller loads another history", () => {
    const { container, rerender } = render(<GitGraph commits={diamond} selectedHash="feature-tip" refs={refs} defaultBranch="main" />);
    expect(container.querySelectorAll(".commit-node")[2].querySelectorAll("circle")).toHaveLength(2);
    rerender(<GitGraph commits={[commit("new-head", ["root"]), commit("root")]} selectedHash="new-head" />);
    expect(container.querySelectorAll(".commit-node")).toHaveLength(2);
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.querySelector("path")?.getAttribute("d")).toBe("M 10 25 L 10 75");
    expect(container.querySelector(".commit-node")?.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("40");
    rerender(<GitGraph commits={[]} selectedHash="new-head" />);
    expect(container.innerHTML).toBe("");
  });
  it("renders a truncated merge history without lines to missing parents", () => {
    const { container } = render(<GitGraph commits={[commit("partial", ["missing-main", "missing-feature"])]} selectedHash="partial" />);
    expect(container.querySelectorAll("path")).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("50");
    expect(() => fireEvent.click(container.querySelector(".commit-node")!)).not.toThrow();
  });
  it("renders reversed cross-lane ancestry with a bounded cubic curve", () => {
    // An out-of-order response can place a parent before its child.
    const commits = [commit("parent"), commit("child", ["parent"])];
    const { container } = render(<GitGraph commits={commits} refs={{ child: ["main"], parent: ["feature"] }} defaultBranch="main" />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("d")).toMatch(/^M \d+ 75 C \d+ 50, \d+ 50, \d+ 25$/);
    expect(path.getAttribute("d")).not.toContain("NaN");
    expect(container.querySelectorAll(".commit-node")).toHaveLength(2);
  });
  it("cycles a short color palette across divergent branches while keeping all parents connected", () => {
    const commits = [commit("merge", ["a", "b", "c"]), commit("a", ["root"]), commit("b", ["root"]), commit("c", ["root"]), commit("root")];
    const { container } = render(<GitGraph commits={commits} refs={{ merge: ["main"], b: ["b"], c: ["c"] }} defaultBranch="main" config={{ colors: ["purple"], lineWidth: 4 }} />);
    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths).toHaveLength(6);
    expect(paths.filter(path => path.getAttribute("stroke-dasharray") === "4,2")).toHaveLength(2);
    expect(paths.every(path => path.getAttribute("stroke") === "purple" && path.getAttribute("stroke-width") === "4")).toBe(true);
    expect(container.querySelectorAll(".commit-node")).toHaveLength(5);
  });
});
