"use client";

import { formatMaterialRate, type RateCell } from "@/lib/hydration-review/reviews";

interface RatesTableProps {
  caption: string;
  cells: RateCell[];
  keyHeader: string;
  sampleResult?: boolean;
}

/** Counts with explicit denominators; unreviewed rows are a remainder, never SAME. */
export function RatesTable({ caption, cells, keyHeader, sampleResult }: RatesTableProps) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <caption className="mb-1 text-left text-sm font-medium text-slate-900 dark:text-white">
        {caption}
        {sampleResult && <span className="ml-2 text-xs font-normal text-slate-500">sample result — not a population rate</span>}
      </caption>
      <thead className="text-xs uppercase text-slate-500">
        <tr>
          <th className="px-2 py-1">{keyHeader}</th>
          <th className="px-2 py-1 text-right">Population</th>
          <th className="px-2 py-1 text-right">Reviewed</th>
          <th className="px-2 py-1 text-right">Unreviewed</th>
          <th className="px-2 py-1 text-right">SAME</th>
          <th className="px-2 py-1 text-right">MINOR</th>
          <th className="px-2 py-1 text-right">MATERIAL</th>
          <th className="px-2 py-1 text-right">MATERIAL rate</th>
        </tr>
      </thead>
      <tbody>
        {cells.length === 0 && (
          <tr><td colSpan={8} className="px-2 py-2 text-slate-500">Nothing reviewed yet.</td></tr>
        )}
        {cells.map((c) => (
          <tr key={c.key} className="border-t border-slate-100 dark:border-slate-700">
            <td className="px-2 py-1 font-mono text-xs">{c.key}</td>
            <td className="px-2 py-1 text-right">{c.population?.toLocaleString() ?? "—"}</td>
            <td className="px-2 py-1 text-right">{c.reviewed.toLocaleString()}</td>
            <td className="px-2 py-1 text-right">{c.population === null ? "—" : (c.population - c.reviewed).toLocaleString()}</td>
            <td className="px-2 py-1 text-right">{c.SAME}</td>
            <td className="px-2 py-1 text-right">{c.MINOR}</td>
            <td className="px-2 py-1 text-right">{c.MATERIAL}</td>
            <td className="px-2 py-1 text-right">{formatMaterialRate(c)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
