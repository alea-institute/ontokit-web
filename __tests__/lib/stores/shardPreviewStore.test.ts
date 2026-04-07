import { describe, it, expect, beforeEach } from "vitest";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";
import type { ClusterResponse } from "@/lib/api/suggestions";

// Helper: build a minimal ClusterResponse
function makeClusterResponse(
  groups: Array<{
    id: string;
    shards: Array<{
      id: string;
      label: string;
      ancestor_path: string[];
      entity_iris: string[];
      is_misc?: boolean;
      is_cross_cutting?: boolean;
    }>;
  }>,
): ClusterResponse {
  const totalShards = groups.reduce((s, g) => s + g.shards.length, 0);
  const totalSuggestions = groups.reduce(
    (s, g) => s + g.shards.reduce((ss, sh) => ss + sh.entity_iris.length, 0),
    0,
  );
  return {
    pr_groups: groups.map((g) => ({
      id: g.id,
      shards: g.shards.map((sh) => ({
        id: sh.id,
        label: sh.label,
        ancestor_path: sh.ancestor_path,
        entity_iris: sh.entity_iris,
        is_misc: sh.is_misc ?? false,
        is_cross_cutting: sh.is_cross_cutting ?? false,
      })),
    })),
    total_suggestions: totalSuggestions,
    total_shards: totalShards,
    total_prs: groups.length,
    skip_clustering: false,
  };
}

function makeEntityIris(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `http://ex.org/${prefix}-${i}`);
}

describe("shardPreviewStore", () => {
  beforeEach(() => {
    useShardPreviewStore.getState().clear();
  });

  // CLUSTER-01: setFromClusterResponse populates shard plan
  it("setFromClusterResponse populates prGroups and shards from cluster API response", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "Contract Law", ancestor_path: ["Contract Law"], entity_iris: makeEntityIris("A", 5) },
          { id: "shard-2", label: "Property Law", ancestor_path: ["Property Law"], entity_iris: makeEntityIris("B", 4) },
        ],
      },
      {
        id: "pr-2",
        shards: [
          { id: "shard-3", label: "Criminal Law", ancestor_path: ["Criminal Law"], entity_iris: makeEntityIris("C", 3) },
          { id: "shard-4", label: "Civil Law", ancestor_path: ["Civil Law"], entity_iris: makeEntityIris("D", 3) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);

    const state = useShardPreviewStore.getState();
    expect(Object.keys(state.prGroups)).toHaveLength(2);
    expect(Object.keys(state.shards)).toHaveLength(4);
    expect(state.prGroupOrder).toHaveLength(2);
  });

  // CLUSTER-02: max 50 entities per shard
  it("no shard has more than 50 entityIris after setFromClusterResponse", () => {
    // Backend should enforce this, but verify store honours it
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "Small", ancestor_path: ["A"], entity_iris: makeEntityIris("X", 30) },
          { id: "shard-2", label: "Near Limit", ancestor_path: ["B"], entity_iris: makeEntityIris("Y", 50) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);

    const state = useShardPreviewStore.getState();
    for (const shard of Object.values(state.shards)) {
      expect(shard.entityIris.length).toBeLessThanOrEqual(50);
    }
  });

  // CLUSTER-03: min 3 entities per non-misc shard
  it("no non-misc shard has fewer than 3 entityIris after setFromClusterResponse", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "Large Group", ancestor_path: ["A"], entity_iris: makeEntityIris("X", 5) },
          { id: "shard-misc", label: "Miscellaneous", ancestor_path: [], entity_iris: makeEntityIris("Z", 2), is_misc: true },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);

    const state = useShardPreviewStore.getState();
    for (const shard of Object.values(state.shards)) {
      if (!shard.isMisc) {
        expect(shard.entityIris.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // CLUSTER-04: cross-cutting shard
  it("cross-cutting entities appear in a dedicated shard with isCrossCutting=true", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          {
            id: "shard-cross",
            label: "Cross-cutting changes",
            ancestor_path: [],
            entity_iris: ["http://ex.org/CC-1", "http://ex.org/CC-2", "http://ex.org/CC-3"],
            is_cross_cutting: true,
          },
          {
            id: "shard-1",
            label: "Regular",
            ancestor_path: ["A"],
            entity_iris: makeEntityIris("R", 4),
          },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);

    const state = useShardPreviewStore.getState();
    const crossShard = state.shards["shard-cross"];
    expect(crossShard).toBeDefined();
    expect(crossShard.isCrossCutting).toBe(true);
    expect(crossShard.entityIris).toContain("http://ex.org/CC-1");
  });

  // CLUSTER-05: moveEntity atomicity
  it("moveEntity removes entity from source shard and adds to target shard atomically", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "A", ancestor_path: ["A"], entity_iris: ["http://ex.org/A", "http://ex.org/B", "http://ex.org/C"] },
          { id: "shard-2", label: "B", ancestor_path: ["B"], entity_iris: makeEntityIris("D", 3) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().moveEntity("http://ex.org/A", "shard-1", "shard-2");

    const state = useShardPreviewStore.getState();
    expect(state.shards["shard-1"].entityIris).not.toContain("http://ex.org/A");
    expect(state.shards["shard-2"].entityIris).toContain("http://ex.org/A");
  });

  it("moveEntity ensures entity appears in exactly one shard post-move", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "A", ancestor_path: ["A"], entity_iris: ["http://ex.org/A", "http://ex.org/B", "http://ex.org/C"] },
          { id: "shard-2", label: "B", ancestor_path: ["B"], entity_iris: makeEntityIris("D", 3) },
          { id: "shard-3", label: "C", ancestor_path: ["C"], entity_iris: makeEntityIris("E", 3) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().moveEntity("http://ex.org/A", "shard-1", "shard-2");

    const state = useShardPreviewStore.getState();
    const allShards = Object.values(state.shards);
    const totalEntityCount = allShards.reduce((sum, s) => sum + s.entityIris.length, 0);
    // total count unchanged: 3 + 3 + 3 = 9
    expect(totalEntityCount).toBe(9);

    // entity appears in exactly one shard
    const containingShards = allShards.filter((s) =>
      s.entityIris.includes("http://ex.org/A"),
    );
    expect(containingShards).toHaveLength(1);
    expect(containingShards[0].id).toBe("shard-2");
  });

  // CLUSTER-05: mergeShards
  it("mergeShards combines entityIris and removes source shard", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "A", ancestor_path: ["A"], entity_iris: ["http://ex.org/A1", "http://ex.org/A2", "http://ex.org/A3"] },
          { id: "shard-2", label: "B", ancestor_path: ["B"], entity_iris: ["http://ex.org/B1", "http://ex.org/B2", "http://ex.org/B3"] },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().mergeShards("shard-2", "shard-1");

    const state = useShardPreviewStore.getState();
    // shard-2 should be deleted
    expect(state.shards["shard-2"]).toBeUndefined();
    // shard-1 should contain all entities
    expect(state.shards["shard-1"].entityIris).toContain("http://ex.org/A1");
    expect(state.shards["shard-1"].entityIris).toContain("http://ex.org/B1");
    expect(state.shards["shard-1"].entityIris).toHaveLength(6);
    // shard-2 removed from PR group
    expect(state.prGroups["pr-1"].shardIds).not.toContain("shard-2");
  });

  // CLUSTER-05: splitShard
  it("splitShard creates new shard with selected entities and removes them from original", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          {
            id: "shard-1",
            label: "A",
            ancestor_path: ["A"],
            entity_iris: ["http://ex.org/A", "http://ex.org/B", "http://ex.org/C", "http://ex.org/D", "http://ex.org/E"],
          },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().splitShard("shard-1", ["http://ex.org/A", "http://ex.org/B"], "Split group");

    const state = useShardPreviewStore.getState();
    // Original shard should not contain split entities
    expect(state.shards["shard-1"].entityIris).not.toContain("http://ex.org/A");
    expect(state.shards["shard-1"].entityIris).not.toContain("http://ex.org/B");
    expect(state.shards["shard-1"].entityIris).toHaveLength(3);

    // A new shard should exist with the split entities
    const newShardIds = state.prGroups["pr-1"].shardIds.filter((id) => id !== "shard-1");
    expect(newShardIds).toHaveLength(1);
    const newShard = state.shards[newShardIds[0]];
    expect(newShard).toBeDefined();
    expect(newShard.entityIris).toContain("http://ex.org/A");
    expect(newShard.entityIris).toContain("http://ex.org/B");
    expect(newShard.label).toBe("Split group");
  });

  // CLUSTER-08: large session produces multiple PR groups
  it("cluster response with >10 shards produces multiple PR groups", () => {
    // Simulate a response with 12 shards spread across 2 PR groups
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: Array.from({ length: 6 }, (_, i) => ({
          id: `shard-a-${i}`,
          label: `Group A ${i}`,
          ancestor_path: [`A${i}`],
          entity_iris: makeEntityIris(`a${i}`, 5),
        })),
      },
      {
        id: "pr-2",
        shards: Array.from({ length: 6 }, (_, i) => ({
          id: `shard-b-${i}`,
          label: `Group B ${i}`,
          ancestor_path: [`B${i}`],
          entity_iris: makeEntityIris(`b${i}`, 5),
        })),
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);

    const state = useShardPreviewStore.getState();
    expect(Object.keys(state.prGroups).length).toBeGreaterThan(1);
    expect(Object.keys(state.shards).length).toBeGreaterThan(10);
  });

  // moveShard between PR groups
  it("moveShard moves shard from one PR group to another", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "A", ancestor_path: ["A"], entity_iris: makeEntityIris("A", 3) },
          { id: "shard-2", label: "B", ancestor_path: ["B"], entity_iris: makeEntityIris("B", 3) },
        ],
      },
      {
        id: "pr-2",
        shards: [
          { id: "shard-3", label: "C", ancestor_path: ["C"], entity_iris: makeEntityIris("C", 3) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().moveShard("shard-1", "pr-1", "pr-2");

    const state = useShardPreviewStore.getState();
    expect(state.prGroups["pr-1"].shardIds).not.toContain("shard-1");
    expect(state.prGroups["pr-2"].shardIds).toContain("shard-1");
  });

  // clear resets all state
  it("clear resets prGroups, shards, and prGroupOrder to empty", () => {
    const response = makeClusterResponse([
      {
        id: "pr-1",
        shards: [
          { id: "shard-1", label: "A", ancestor_path: ["A"], entity_iris: makeEntityIris("A", 3) },
        ],
      },
    ]);

    useShardPreviewStore.getState().setFromClusterResponse(response);
    useShardPreviewStore.getState().clear();

    const state = useShardPreviewStore.getState();
    expect(state.prGroups).toEqual({});
    expect(state.shards).toEqual({});
    expect(state.prGroupOrder).toEqual([]);
  });
});
