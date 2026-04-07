import { describe, it, expect } from "vitest";

describe("shardPreviewStore", () => {
  // CLUSTER-01: setFromClusterResponse populates shard plan
  it.skip("setFromClusterResponse populates prGroups and shards from cluster API response", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-02: max 50 entities per shard
  it.skip("no shard has more than 50 entityIris after setFromClusterResponse", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-03: min 3 entities per non-misc shard
  it.skip("no non-misc shard has fewer than 3 entityIris after setFromClusterResponse", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-04: cross-cutting shard
  it.skip("cross-cutting entities appear in a dedicated shard with isCrossCutting=true", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-05: moveEntity atomicity
  it.skip("moveEntity removes entity from source shard and adds to target shard atomically", () => {
    // Downstream: 15-01-PLAN task 1
  });

  it.skip("moveEntity ensures entity appears in exactly one shard post-move", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-05: mergeShards
  it.skip("mergeShards combines entityIris and removes source shard", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-05: splitShard
  it.skip("splitShard creates new shard with selected entities and removes them from original", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // CLUSTER-08: large session produces multiple PR groups
  it.skip("cluster response with >10 shards produces multiple PR groups", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // moveShard between PR groups
  it.skip("moveShard moves shard from one PR group to another", () => {
    // Downstream: 15-01-PLAN task 1
  });

  // clear resets all state
  it.skip("clear resets prGroups, shards, and prGroupOrder to empty", () => {
    // Downstream: 15-01-PLAN task 1
  });
});
