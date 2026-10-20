"use client";

import type { BundleRow } from "@/lib/hydration-review/bundle";
import type { Review } from "@/lib/hydration-review/reviews";
import { cn } from "@/lib/utils";
import { ScriptText } from "./ScriptText";
import { PartitionBadge, StatusBadge } from "./StatusBadge";

interface RowTableProps {
  rows: readonly BundleRow[];
  reviews: ReadonlyMap<string, Review>;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
}

export function RowTable({ rows, reviews, selectedId, onSelect }: RowTableProps) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No rows match.</p>;
  }
  return (
    <table className="w-full table-fixed text-left text-sm">
      <thead className="text-xs uppercase text-slate-500">
        <tr>
          <th className="w-1/4 px-2 py-1">Concept</th>
          <th className="w-32 px-2 py-1">Slot</th>
          <th className="px-2 py-1">Proposed value</th>
          <th className="w-40 px-2 py-1">Review</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.row_id}
            aria-selected={row.row_id === selectedId}
            className={cn(
              "cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50",
              row.row_id === selectedId && "bg-primary-50 dark:bg-primary-900/30",
            )}
            onClick={() => onSelect(row.row_id)}
          >
            <td className="truncate px-2 py-1.5">
              <button type="button" className="text-left font-medium text-slate-900 hover:underline dark:text-white" onClick={() => onSelect(row.row_id)}>
                {row.label}
              </button>
              <div className="truncate text-xs text-slate-500">{row.branch}</div>
            </td>
            <td className="px-2 py-1.5 font-mono text-xs">
              {row.component}
              <div className="mt-0.5"><PartitionBadge partition={row.partition} /></div>
            </td>
            <td className="px-2 py-1.5">
              <div className="line-clamp-2"><ScriptText value={row.value} lang={row.lang} /></div>
            </td>
            <td className="px-2 py-1.5"><StatusBadge review={reviews.get(row.row_id)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
