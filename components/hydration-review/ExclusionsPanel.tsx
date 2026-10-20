"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ParsedBundle } from "@/lib/hydration-review/bundle";
import { pageOf } from "@/lib/hydration-review/query";
import { ScriptText } from "./ScriptText";

const PAGE = 50;

/**
 * Excluded rows, read-only, each with its recorded reason. They take no
 * classification or disposition here, so none can be approved back in.
 */
export function ExclusionsPanel({ bundle }: { bundle: ParsedBundle }) {
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(0);
  const { header } = bundle;
  const items = reason ? bundle.exclusions.filter((e) => e.reason === reason) : bundle.exclusions;
  const view = pageOf(items, page, PAGE);
  const prescreen = header.digest_manifest?.prescreen_rejected_items;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {header.counts.exclusions.toLocaleString()} rows were held out of the {header.counts.rows.toLocaleString()}{" "}
        proposed rows by the digest acceptance filter. They are shown for context and cannot be reviewed or accepted here.
      </p>
      <ul className="text-sm">
        {Object.entries(header.counts.exclusions_by_reason).map(([r, n]) => (
          <li key={r}><span className="font-mono">{r}</span>: {n.toLocaleString()}</li>
        ))}
      </ul>
      {typeof prescreen === "number" && (
        <p className="text-xs text-slate-500">
          The locale cross-check did not accept {prescreen} items; the digest attributes them to the reasons above
          (counts recorded separately in the source manifest and not merged here).
        </p>
      )}
      <label className="block text-sm">
        <span className="mr-2">Reason</span>
        <select
          value={reason}
          onChange={(e) => { setReason(e.target.value); setPage(0); }}
          className="rounded border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All reasons</option>
          {Object.keys(header.counts.exclusions_by_reason).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <table className="w-full table-fixed text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr><th className="w-1/4 px-2 py-1">Concept</th><th className="w-32 px-2 py-1">Slot</th><th className="px-2 py-1">Excluded value</th><th className="w-48 px-2 py-1">Reason</th></tr>
        </thead>
        <tbody>
          {view.items.map((e) => (
            <tr key={e.row_id} className="border-t border-slate-100 align-top dark:border-slate-700">
              <td className="px-2 py-1.5">{e.label ?? <span className="font-mono text-xs">{e.iri}</span>}</td>
              <td className="px-2 py-1.5 font-mono text-xs">{e.component}</td>
              <td className="px-2 py-1.5">{e.value ? <ScriptText value={e.value} lang={e.lang} /> : "—"}</td>
              <td className="px-2 py-1.5 font-mono text-xs">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 text-sm">
        <Button size="sm" variant="outline" disabled={view.page === 0} onClick={() => setPage(view.page - 1)}>Previous</Button>
        <span>{items.length ? `${view.start + 1}–${view.end} of ${items.length}` : "0 of 0"}</span>
        <Button size="sm" variant="outline" disabled={view.page >= view.pages - 1} onClick={() => setPage(view.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
