"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { htmlLang, isRtl, type BundleRow, type ConceptContext } from "@/lib/hydration-review/bundle";
import {
  CLASSIFICATIONS,
  emptyReview,
  isBlank,
  reviewProblems,
  type Classification,
  type Review,
} from "@/lib/hydration-review/reviews";
import { cn } from "@/lib/utils";
import { ScriptText } from "./ScriptText";
import { PartitionBadge, StatusBadge } from "./StatusBadge";

interface RowDetailProps {
  row: BundleRow;
  concept: ConceptContext | undefined;
  review: Review | undefined;
  onChange: (review: Review) => void;
  position?: { index: number; total: number; onPrev: () => void; onNext: () => void };
}

function triple(row: BundleRow, value: string): string {
  const literal = JSON.stringify(value);
  return `<${row.iri}> ${row.predicate} ${literal}${row.lang ? `@${row.lang}` : ""} .`;
}

/**
 * One proposed addition: the empty FOLIO slot it fills, the triple it would add,
 * the concept context needed to judge it, and the review controls. Mount with
 * `key={row.row_id}` so the correction draft resets per row.
 */
export function RowDetail({ row, concept, review, onChange, position }: RowDetailProps) {
  const current = review ?? emptyReview(row);
  const [draft, setDraft] = useState(current.corrected_value ?? row.value);
  const [note, setNote] = useState(current.note ?? "");
  const problems = current.disposition ? reviewProblems(current, row) : [];
  const gates = Object.entries(row.failed_gates ?? {});

  const save = (patch: Partial<Review>) =>
    onChange({ ...current, ...patch, note: note.trim() || null, reviewed_at: new Date().toISOString() });

  const classify = (c: Classification) => {
    const next = current.classification === c ? null : c;
    // A MINOR or MATERIAL row cannot stay "accepted as proposed".
    const voidsAccept = current.disposition === "accept" && next !== null && next !== "SAME";
    save({ classification: next, disposition: voidsAccept ? null : current.disposition });
  };

  return (
    <section aria-label="Row detail" className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{row.label}</h2>
          <p className="break-all font-mono text-xs text-slate-500">{row.iri}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {row.branch} · <span className="font-mono">{row.component}</span> · row <span className="font-mono">{row.row_id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PartitionBadge partition={row.partition} />
          <StatusBadge review={review} />
          {position && (
            <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
              <Button variant="ghost" size="sm" aria-label="Previous row" onClick={position.onPrev} disabled={position.index <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {position.index + 1} of {position.total.toLocaleString()}
              <Button variant="ghost" size="sm" aria-label="Next row" onClick={position.onNext} disabled={position.index >= position.total - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </span>
          )}
        </div>
      </div>

      {concept?.existing_definition && (
        <div className="mt-3 rounded bg-slate-50 p-3 text-sm dark:bg-slate-900">
          <div className="text-xs font-medium uppercase text-slate-500">Existing FOLIO definition (context)</div>
          <p className="mt-1 text-slate-700 dark:text-slate-200">{concept.existing_definition}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Diff">
        <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-xs font-medium uppercase text-slate-500">Current FOLIO</div>
          <p className="mt-1 text-sm italic text-slate-500">
            Empty slot — no <span className="font-mono not-italic">{row.predicate}</span>
            {row.lang ? <> tagged <span className="font-mono not-italic">@{row.lang}</span></> : null} on this class.
          </p>
        </div>
        <div className="rounded border border-emerald-300 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-300">Proposed addition (unreviewed generated text)</div>
          <p className="mt-1 text-base text-slate-900 dark:text-slate-100">
            <ScriptText value={row.value} lang={row.lang} />
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/70 p-2 font-mono text-xs text-emerald-900 dark:bg-slate-900 dark:text-emerald-200">
            + {triple(row, row.value)}
          </pre>
        </div>
      </div>

      {(gates.length > 0 || row.recognition_strip) && (
        <div className="mt-3 rounded border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950/30">
          {gates.length > 0 && (
            <ul className="list-inside list-disc text-orange-900 dark:text-orange-200">
              {gates.map(([id, reason]) => (
                <li key={id}><span className="font-mono">{id}</span>: {reason}</li>
              ))}
            </ul>
          )}
          {row.recognition_strip && (
            <p className="mt-1 text-orange-900 dark:text-orange-200">
              Recognition claim stripped ({row.recognition_strip.rules.join(", ")}). Before:{" "}
              <ScriptText value={row.recognition_strip.original_value} lang={row.lang} />
            </p>
          )}
        </div>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-900 dark:text-white">Correctness</legend>
        <div className="mt-1 flex gap-2" role="group" aria-label="Classification">
          {CLASSIFICATIONS.map((c) => (
            <Button key={c} size="sm" variant={current.classification === c ? "primary" : "outline"} aria-pressed={current.classification === c} onClick={() => classify(c)}>
              {c}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor={`correction-${row.row_id}`} className="text-sm font-medium text-slate-900 dark:text-white">
          Corrected value
        </label>
        <textarea
          id={`correction-${row.row_id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          dir={isRtl(row.lang) ? "rtl" : "ltr"}
          lang={htmlLang(row.lang)}
          rows={row.component === "definition" || row.component === "examples" ? 4 : 2}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        {draft !== row.value && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Preview: <ScriptText value={draft} lang={row.lang} />
          </p>
        )}
        <label htmlFor={`note-${row.row_id}`} className="mt-2 block text-sm font-medium text-slate-900 dark:text-white">
          Note (optional)
        </label>
        <input
          id={`note-${row.row_id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (review && (note.trim() || null) !== review.note) save({});
          }}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Disposition">
        <Button
          variant={current.disposition === "accept" ? "primary" : "outline"}
          disabled={current.classification !== null && current.classification !== "SAME"}
          onClick={() => save({ disposition: "accept", corrected_value: null })}
        >
          Accept as proposed
        </Button>
        <Button
          variant={current.disposition === "correct" ? "primary" : "outline"}
          disabled={isBlank(draft) || draft === row.value}
          onClick={() => save({ disposition: "correct", corrected_value: draft })}
        >
          Save correction
        </Button>
        <Button
          variant={current.disposition === "reject" ? "danger" : "outline"}
          onClick={() => save({ disposition: "reject", corrected_value: null })}
        >
          Reject
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        A disposition records your review in this browser and in the export. It does not write to FOLIO.
      </p>
      {problems.length > 0 && (
        <ul role="alert" className={cn("mt-2 list-inside list-disc text-sm text-red-700 dark:text-red-300")}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </section>
  );
}
