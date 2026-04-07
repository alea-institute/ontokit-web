import { describe, it, expect } from "vitest";

describe("useShardDragDrop", () => {
  // CLUSTER-06: drag entity between shards
  it.skip("handleDragEnd with entity type calls moveEntity on store", () => {
    // Downstream: 15-03-PLAN task 2
  });

  // CLUSTER-06: drag shard between PR groups
  it.skip("handleDragEnd with shard type calls moveShard on store", () => {
    // Downstream: 15-03-PLAN task 2
  });

  // Invalid drop target
  it.skip("handleDragEnd with no over target does nothing", () => {
    // Downstream: 15-03-PLAN task 2
  });
});
