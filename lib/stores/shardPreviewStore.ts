/**
 * ShardPreviewStore — ephemeral Zustand store for the mutable shard plan.
 *
 * Holds the in-progress shard plan that the user reviews and adjusts before
 * batch-submitting. Not persisted (no localStorage) because the plan is
 * session-ephemeral: it is computed from the backend clustering response and
 * discarded on submit/discard.
 *
 * Enforces CLUSTER-05 atomically: every mutation is a single set() call so
 * entities can never appear in two shards simultaneously.
 */

import { create } from "zustand";
import type { ClusterResponse } from "@/lib/api/suggestions";

// --- Exported types ---

export interface ShardDefinition {
  id: string;
  /** Human-readable label, e.g. "Contract Law > Commercial Contracts" */
  label: string;
  /** Ancestor chain used to derive the label, e.g. ["Contract Law", "Commercial Contracts"] */
  ancestorPath: string[];
  /** IRIs of suggestions assigned to this shard */
  entityIris: string[];
  /** true for the "Miscellaneous improvements" catch-all shard */
  isMisc: boolean;
  /** true for the cross-cutting changes shard (CLUSTER-04 / D-02) */
  isCrossCutting: boolean;
}

export interface PRGroupDefinition {
  id: string;
  /** Ordered list of shard IDs in this PR */
  shardIds: string[];
  /** Cached sum of entityIris lengths across all shards in this PR group */
  suggestionCount: number;
}

// --- Internal helpers ---

function computeSuggestionCount(
  shardIds: string[],
  shards: Record<string, ShardDefinition>,
): number {
  return shardIds.reduce((sum, id) => sum + (shards[id]?.entityIris.length ?? 0), 0);
}

// --- Store state interface ---

interface ShardPreviewState {
  prGroups: Record<string, PRGroupDefinition>;
  shards: Record<string, ShardDefinition>;
  /** Ordered PR group IDs for stable rendering */
  prGroupOrder: string[];
  /** Which PR groups are expanded in the UI */
  expandedPrIds: Set<string>;
  /** Which individual shards are expanded in the UI */
  expandedShardIds: Set<string>;

  // --- Hydration ---

  /** Populate the store from a server-computed ClusterResponse. */
  setFromClusterResponse: (response: ClusterResponse) => void;

  // --- Mutations (all atomic — single set() call) ---

  /** Move an entity IRI from one shard to another. CLUSTER-05. */
  moveEntity: (entityIri: string, fromShardId: string, toShardId: string) => void;

  /** Merge sourceId into targetId: combine entityIris, delete source. */
  mergeShards: (sourceId: string, targetId: string) => void;

  /** Split selected entityIris out of shardId into a new shard. */
  splitShard: (shardId: string, entityIris: string[], newLabel: string) => void;

  /** Move a shard between PR groups. */
  moveShard: (shardId: string, fromPrId: string, toPrId: string) => void;

  // --- Expand/collapse ---

  togglePrExpanded: (prId: string) => void;
  toggleShardExpanded: (shardId: string) => void;

  // --- Reset ---

  clear: () => void;

  // --- Derived ---

  getSummary: () => { totalSuggestions: number; totalShards: number; totalPrs: number };
}

// --- Store implementation ---

export const useShardPreviewStore = create<ShardPreviewState>()((set, get) => ({
  prGroups: {},
  shards: {},
  prGroupOrder: [],
  expandedPrIds: new Set<string>(),
  expandedShardIds: new Set<string>(),

  // ---------------------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------------------

  setFromClusterResponse: (response) => {
    const newShards: Record<string, ShardDefinition> = {};
    const newPrGroups: Record<string, PRGroupDefinition> = {};
    const newPrGroupOrder: string[] = [];

    for (const group of response.pr_groups) {
      const shardIds: string[] = [];

      for (const shard of group.shards) {
        newShards[shard.id] = {
          id: shard.id,
          label: shard.label,
          ancestorPath: shard.ancestor_path,
          entityIris: shard.entity_iris,
          isMisc: shard.is_misc,
          isCrossCutting: shard.is_cross_cutting,
        };
        shardIds.push(shard.id);
      }

      newPrGroups[group.id] = {
        id: group.id,
        shardIds,
        suggestionCount: shardIds.reduce(
          (sum, id) => sum + (newShards[id]?.entityIris.length ?? 0),
          0,
        ),
      };
      newPrGroupOrder.push(group.id);
    }

    // Expand/collapse defaults: if total shards > 3, start all PR groups collapsed
    const totalShards = Object.keys(newShards).length;
    const expandedPrIds =
      totalShards > 3
        ? new Set<string>()
        : new Set<string>(newPrGroupOrder);

    set({
      shards: newShards,
      prGroups: newPrGroups,
      prGroupOrder: newPrGroupOrder,
      expandedPrIds,
      expandedShardIds: new Set<string>(), // always start collapsed
    });
  },

  // ---------------------------------------------------------------------------
  // Mutations — all single set() calls (CLUSTER-05 atomicity)
  // ---------------------------------------------------------------------------

  moveEntity: (entityIri, fromShardId, toShardId) => {
    set((state) => {
      const fromShard = state.shards[fromShardId];
      const toShard = state.shards[toShardId];
      if (!fromShard || !toShard || fromShardId === toShardId) return state;

      const newFromShard: ShardDefinition = {
        ...fromShard,
        entityIris: fromShard.entityIris.filter((iri) => iri !== entityIri),
      };
      const newToShard: ShardDefinition = {
        ...toShard,
        entityIris: toShard.entityIris.includes(entityIri)
          ? toShard.entityIris
          : [...toShard.entityIris, entityIri],
      };

      const newShards = {
        ...state.shards,
        [fromShardId]: newFromShard,
        [toShardId]: newToShard,
      };

      // Recompute suggestionCount for affected PR groups
      const newPrGroups = { ...state.prGroups };
      for (const [prId, group] of Object.entries(newPrGroups)) {
        if (
          group.shardIds.includes(fromShardId) ||
          group.shardIds.includes(toShardId)
        ) {
          newPrGroups[prId] = {
            ...group,
            suggestionCount: computeSuggestionCount(group.shardIds, newShards),
          };
        }
      }

      return { shards: newShards, prGroups: newPrGroups };
    });
  },

  mergeShards: (sourceId, targetId) => {
    set((state) => {
      const sourceShard = state.shards[sourceId];
      const targetShard = state.shards[targetId];
      if (!sourceShard || !targetShard || sourceId === targetId) return state;

      const mergedTarget: ShardDefinition = {
        ...targetShard,
        entityIris: [...targetShard.entityIris, ...sourceShard.entityIris],
      };

      const newShards = { ...state.shards, [targetId]: mergedTarget };
      delete newShards[sourceId];

      // Remove source from its PR group's shardIds and recompute counts
      const newPrGroups = { ...state.prGroups };
      for (const [prId, group] of Object.entries(newPrGroups)) {
        if (group.shardIds.includes(sourceId) || group.shardIds.includes(targetId)) {
          const updatedShardIds = group.shardIds.filter((id) => id !== sourceId);
          newPrGroups[prId] = {
            ...group,
            shardIds: updatedShardIds,
            suggestionCount: computeSuggestionCount(updatedShardIds, newShards),
          };
        }
      }

      return { shards: newShards, prGroups: newPrGroups };
    });
  },

  splitShard: (shardId, entityIris, newLabel) => {
    set((state) => {
      const originalShard = state.shards[shardId];
      if (!originalShard) return state;

      const newId = crypto.randomUUID();
      const newShard: ShardDefinition = {
        id: newId,
        label: newLabel,
        ancestorPath: originalShard.ancestorPath,
        entityIris: [...entityIris],
        isMisc: false,
        isCrossCutting: false,
      };

      const updatedOriginal: ShardDefinition = {
        ...originalShard,
        entityIris: originalShard.entityIris.filter(
          (iri) => !entityIris.includes(iri),
        ),
      };

      const newShards = {
        ...state.shards,
        [shardId]: updatedOriginal,
        [newId]: newShard,
      };

      // Find which PR group contains the original shard, add new shard to it
      const newPrGroups = { ...state.prGroups };
      for (const [prId, group] of Object.entries(newPrGroups)) {
        if (group.shardIds.includes(shardId)) {
          const updatedShardIds = [...group.shardIds, newId];
          newPrGroups[prId] = {
            ...group,
            shardIds: updatedShardIds,
            suggestionCount: computeSuggestionCount(updatedShardIds, newShards),
          };
        }
      }

      return { shards: newShards, prGroups: newPrGroups };
    });
  },

  moveShard: (shardId, fromPrId, toPrId) => {
    set((state) => {
      const fromGroup = state.prGroups[fromPrId];
      const toGroup = state.prGroups[toPrId];
      if (!fromGroup || !toGroup || fromPrId === toPrId) return state;

      const newShards = state.shards; // shards themselves don't change

      const updatedFrom: PRGroupDefinition = {
        ...fromGroup,
        shardIds: fromGroup.shardIds.filter((id) => id !== shardId),
        suggestionCount: computeSuggestionCount(
          fromGroup.shardIds.filter((id) => id !== shardId),
          newShards,
        ),
      };
      const updatedTo: PRGroupDefinition = {
        ...toGroup,
        shardIds: [...toGroup.shardIds, shardId],
        suggestionCount: computeSuggestionCount(
          [...toGroup.shardIds, shardId],
          newShards,
        ),
      };

      return {
        prGroups: {
          ...state.prGroups,
          [fromPrId]: updatedFrom,
          [toPrId]: updatedTo,
        },
      };
    });
  },

  // ---------------------------------------------------------------------------
  // Expand/collapse
  // ---------------------------------------------------------------------------

  togglePrExpanded: (prId) => {
    set((state) => {
      const next = new Set(state.expandedPrIds);
      if (next.has(prId)) {
        next.delete(prId);
      } else {
        next.add(prId);
      }
      return { expandedPrIds: next };
    });
  },

  toggleShardExpanded: (shardId) => {
    set((state) => {
      const next = new Set(state.expandedShardIds);
      if (next.has(shardId)) {
        next.delete(shardId);
      } else {
        next.add(shardId);
      }
      return { expandedShardIds: next };
    });
  },

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  clear: () => {
    set({
      prGroups: {},
      shards: {},
      prGroupOrder: [],
      expandedPrIds: new Set<string>(),
      expandedShardIds: new Set<string>(),
    });
  },

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  getSummary: () => {
    const state = get();
    const totalSuggestions = Object.values(state.shards).reduce(
      (sum, shard) => sum + shard.entityIris.length,
      0,
    );
    return {
      totalSuggestions,
      totalShards: Object.keys(state.shards).length,
      totalPrs: Object.keys(state.prGroups).length,
    };
  },
}));
