import { describe, expect, it } from "vitest";
import { buildGraphLayout } from "@/lib/git-graph/graph-builder";
import type { RevisionCommit } from "@/lib/api/revisions";

/** Helper to create a minimal commit. */
function makeCommit(
  hash: string,
  parentHashes: string[] = [],
  message = ""
): RevisionCommit {
  return {
    hash,
    short_hash: hash.slice(0, 7),
    message: message || `commit ${hash}`,
    author_name: "Test",
    author_email: "test@test.com",
    timestamp: new Date().toISOString(),
    parent_hashes: parentHashes,
  };
}

describe("buildGraphLayout", () => {
  it("returns empty layout for empty commits array", () => {
    const layout = buildGraphLayout([]);
    expect(layout.vertices).toEqual([]);
    expect(layout.segments).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it("assigns all commits to lane 0 for linear history", () => {
    // c0 <- c1 <- c2 (newest to oldest)
    const commits = [
      makeCommit("c0", ["c1"]),
      makeCommit("c1", ["c2"]),
      makeCommit("c2"),
    ];
    const refs = { c0: ["main"] };
    const layout = buildGraphLayout(commits, refs, "main");

    expect(layout.vertices).toHaveLength(3);
    for (const v of layout.vertices) {
      expect(v.lane).toBe(0);
    }
  });

  it("assigns feature branch to a separate lane", () => {
    // History (newest to oldest):
    //   c0 (feat tip) <- c2 (branch point)
    //   c1 (main tip) <- c2
    const commits = [
      makeCommit("c0", ["c2"]),
      makeCommit("c1", ["c2"]),
      makeCommit("c2"),
    ];
    const refs = { c0: ["feature/a"], c1: ["main"] };
    const layout = buildGraphLayout(commits, refs, "main");

    // main-tip and its ancestor should be lane 0
    const mainTip = layout.vertices.find((v) => v.hash === "c1")!;
    expect(mainTip.lane).toBe(0);

    // feature tip should be on a different lane
    const featTip = layout.vertices.find((v) => v.hash === "c0")!;
    expect(featTip.lane).not.toBe(0);
  });

  it("does not overwrite lanes for stacked branches", () => {
    // History (newest to oldest):
    //   b_tip (feature/b) -> a1
    //   a_tip (feature/a) -> a1
    //   a1 -> base
    //   main_tip (main) -> base
    //   base
    const commits = [
      makeCommit("b_tip", ["a1"]),
      makeCommit("a_tip", ["a1"]),
      makeCommit("a1", ["base"]),
      makeCommit("main_tip", ["base"]),
      makeCommit("base"),
    ];
    const refs = {
      b_tip: ["feature/b"],
      a_tip: ["feature/a"],
      main_tip: ["main"],
    };
    const layout = buildGraphLayout(commits, refs, "main");

    const bTip = layout.vertices.find((v) => v.hash === "b_tip")!;
    const aTip = layout.vertices.find((v) => v.hash === "a_tip")!;
    const a1 = layout.vertices.find((v) => v.hash === "a1")!;

    // feature/a and feature/b should get distinct lanes
    expect(aTip.lane).not.toBe(bTip.lane);
    // a1 is walked first by feature/b (earlier in array), so it keeps b's lane.
    // The fix ensures feature/a's walk does NOT overwrite a1's lane.
    expect(a1.lane).toBe(bTip.lane);
  });

  it("assigns two independent feature branches to separate lanes", () => {
    // main: m0 <- m1
    // feat1: f1 <- m1
    // feat2: f2 <- m1
    const commits = [
      makeCommit("f1", ["m1"]),
      makeCommit("f2", ["m1"]),
      makeCommit("m0", ["m1"]),
      makeCommit("m1"),
    ];
    const refs = {
      f1: ["feature/one"],
      f2: ["feature/two"],
      m0: ["main"],
    };
    const layout = buildGraphLayout(commits, refs, "main");

    const feat1 = layout.vertices.find((v) => v.hash === "f1")!;
    const feat2 = layout.vertices.find((v) => v.hash === "f2")!;
    const mainTip = layout.vertices.find((v) => v.hash === "m0")!;

    // Main should be lane 0
    expect(mainTip.lane).toBe(0);
    // Both features should be on different non-zero lanes
    expect(feat1.lane).not.toBe(0);
    expect(feat2.lane).not.toBe(0);
    expect(feat1.lane).not.toBe(feat2.lane);
  });
});
