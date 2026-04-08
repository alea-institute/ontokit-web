"use client";

import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";

/**
 * ShardPreviewSummaryBar — compact horizontal bar showing totals.
 * Renders "{N} suggestions → {N} shards → {N} PRs" reactively from store.
 * D-09, UI-SPEC Copywriting Contract.
 */
export function ShardPreviewSummaryBar() {
  const shards = useShardPreviewStore((s) => s.shards);
  const prGroups = useShardPreviewStore((s) => s.prGroups);

  const totalSuggestions = Object.values(shards).reduce(
    (sum, shard) => sum + shard.entityIris.length,
    0,
  );
  const totalShards = Object.keys(shards).length;
  const totalPrs = Object.keys(prGroups).length;

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {totalSuggestions}
      </span>
      <span className="text-sm text-slate-900 dark:text-slate-100">
        {totalSuggestions === 1 ? "suggestion" : "suggestions"}
      </span>
      <span className="mx-2 text-slate-400 dark:text-slate-500">→</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {totalShards}
      </span>
      <span className="text-sm text-slate-900 dark:text-slate-100">
        {totalShards === 1 ? "shard" : "shards"}
      </span>
      <span className="mx-2 text-slate-400 dark:text-slate-500">→</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {totalPrs}
      </span>
      <span className="text-sm text-slate-900 dark:text-slate-100">
        {totalPrs === 1 ? "PR" : "PRs"}
      </span>
    </div>
  );
}
