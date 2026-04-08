import { cn } from "@/lib/utils";

export interface ShardTabInfo {
  id: string;
  label: string;
  entityCount: number;
}

type ShardMarkStatus = "approved" | "rejected";

interface ShardTabNavigatorProps {
  shards: ShardTabInfo[];
  activeShardId: string | null; // null = "All"
  shardMarks?: Record<string, ShardMarkStatus>;
  onShardChange: (shardId: string | null) => void;
}

export function ShardTabNavigator({
  shards,
  activeShardId,
  shardMarks,
  onShardChange,
}: ShardTabNavigatorProps) {
  const activeTabBase =
    "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400";
  const inactiveTabBase =
    "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";

  return (
    <div
      role="tablist"
      aria-label="Filter by shard"
      className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700"
    >
      {/* All tab */}
      <button
        role="tab"
        aria-selected={activeShardId === null}
        onClick={() => onShardChange(null)}
        className={cn(
          "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
          activeShardId === null ? activeTabBase : inactiveTabBase,
        )}
      >
        All
      </button>

      {/* Per-shard tabs */}
      {shards.map((shard) => {
        const isActive = activeShardId === shard.id;
        const mark = shardMarks?.[shard.id];

        return (
          <button
            key={shard.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onShardChange(shard.id)}
            className={cn(
              "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-1",
              isActive ? activeTabBase : inactiveTabBase,
            )}
          >
            <span className="max-w-[160px] truncate">{shard.label}</span>
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
              {shard.entityCount}
            </span>
            {mark === "approved" && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
            {mark === "rejected" && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
