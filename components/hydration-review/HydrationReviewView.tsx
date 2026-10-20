"use client";

import { useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileUp, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BundleError, parseBundle, sha256Hex, type ParsedBundle } from "@/lib/hydration-review/bundle";
import { buildExport, ExportError, parseExport } from "@/lib/hydration-review/exportFormat";
import { buildSearchIndex, drawSample, EMPTY_FILTER, filterRows, pageOf, randomSeed, type RowFilter } from "@/lib/hydration-review/query";
import { tallyRates, type Review, type Sample } from "@/lib/hydration-review/reviews";
import { createDefaultStore, type ReviewStore } from "@/lib/hydration-review/storage";
import { cn } from "@/lib/utils";
import { ExclusionsPanel } from "./ExclusionsPanel";
import { RatesTable } from "./RatesTable";
import { RowDetail } from "./RowDetail";
import { RowTable } from "./RowTable";

const PAGE_SIZE = 50;
const TABS = ["Rows", "Samples", "Rates", "Exclusions"] as const;
type Tab = (typeof TABS)[number];

interface HydrationReviewViewProps {
  /** Injected in tests; the browser default is IndexedDB. */
  createStore?: () => ReviewStore;
  /** Triggers a file download; injected in tests. */
  download?: (filename: string, text: string) => void;
}

function browserDownload(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-ndjson" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const select = "rounded border border-slate-300 bg-white p-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white";

/**
 * Review surface for a generative-folio write-back digest (requirements:
 * generative-folio `docs/handoffs/2026-07-28-ontokit-diff-viewer-requirements.md`).
 * Reads a local review bundle; records classifications and corrections in the
 * browser and in an export file. It never writes to an ontology.
 */
export function HydrationReviewView({ createStore = createDefaultStore, download = browserDownload }: HydrationReviewViewProps) {
  const storeRef = useRef<ReviewStore | null>(null);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());
  const [samples, setSamples] = useState<Sample[]>([]);
  const [tab, setTab] = useState<Tab>("Rows");
  const [filter, setFilter] = useState<RowFilter>(EMPTY_FILTER);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState(50);
  const [seed, setSeed] = useState<number>(() => randomSeed());

  const deferredFilter = useDeferredValue(filter);
  const searchIndex = useMemo(() => (bundle ? buildSearchIndex(bundle.rows) : []), [bundle]);
  const filtered = useMemo(
    () => (bundle ? filterRows(bundle.rows, deferredFilter, reviews, searchIndex, selectedId) : []),
    [bundle, deferredFilter, reviews, searchIndex, selectedId],
  );

  const store = () => (storeRef.current ??= createStore());

  async function onBundleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    setLoading(`Reading ${file.name}…`);
    try {
      const bytes = await file.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const parsed = parseBundle(new TextDecoder("utf-8", { fatal: true }).decode(bytes), sha);
      const saved = await store().load(sha);
      setBundle(parsed);
      setReviews(new Map(saved.reviews.map((r) => [r.row_id, r])));
      setSamples(saved.samples);
      setFilter(EMPTY_FILTER);
      setPage(0);
      setSelectedId(null);
      setActiveSample(null);
      const notes = [
        saved.reviews.length ? `Restored ${saved.reviews.length.toLocaleString()} saved reviews for this bundle.` : "",
        store().durable ? "" : "This browser is not saving reviews; export before closing the tab.",
      ].filter(Boolean);
      setNotice(notes.length ? notes.join(" ") : null);
    } catch (err) {
      setError(err instanceof BundleError || err instanceof TypeError ? err.message : `Could not read the bundle: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  }

  function saveReview(review: Review) {
    if (!bundle) return;
    setReviews((prev) => new Map(prev).set(review.row_id, review));
    store().putReview(bundle.sha256, review).catch((err) => setError(`Review not saved: ${String(err)}`));
  }

  function saveSample(sample: Sample) {
    if (!bundle) return;
    setSamples((prev) => [...prev.filter((s) => s.sample_id !== sample.sample_id), sample]);
    store().putSample(bundle.sha256, sample).catch((err) => setError(`Sample not saved: ${String(err)}`));
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !bundle) return;
    try {
      const parsed = parseExport(await file.text(), bundle.sha256);
      // A newer local review wins over an older imported one.
      const incoming = parsed.reviews.filter((r) => {
        const local = reviews.get(r.row_id);
        return !local || local.reviewed_at <= r.reviewed_at;
      });
      const next = new Map(reviews);
      for (const r of incoming) next.set(r.row_id, r);
      setReviews(next);
      await store().putReviews(bundle.sha256, incoming);
      for (const s of parsed.samples) saveSample(s);
      const kept = parsed.reviews.length - incoming.length;
      setNotice(`Imported ${incoming.length} reviews and ${parsed.samples.length} samples${kept ? `; kept ${kept} newer local reviews` : ""}.`);
    } catch (err) {
      setError(err instanceof ExportError ? err.message : String(err));
    }
  }

  function onExport() {
    if (!bundle) return;
    const { text, included, skipped } = buildExport(bundle.sha256, bundle.header.digest_id, reviews.values(), samples, bundle.rowsById);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    download(`review-${bundle.header.digest_id}-${bundle.sha256.slice(0, 8)}-${stamp}.jsonl`, text);
    setNotice(`Exported ${included} reviews${skipped ? `; ${skipped} incomplete drafts were left out` : ""}.`);
  }

  function drawNewSample() {
    if (!bundle) return;
    const population = filterRows(bundle.rows, { ...filter, status: "", q: "" }, reviews);
    const members = drawSample(population, sampleSize, seed);
    const dims = Object.fromEntries(Object.entries({ branch: filter.branch, component: filter.component, partition: filter.partition }).filter(([, v]) => v));
    const sample: Sample = {
      sample_id: `s-${seed.toString(16)}-${members.length}-${Date.now().toString(36)}`,
      seed,
      size: members.length,
      population: population.length,
      filter: dims,
      members,
      created_at: new Date().toISOString(),
    };
    saveSample(sample);
    setActiveSample(sample.sample_id);
    setSelectedId(members[0] ?? null);
    setSeed(randomSeed());
  }

  if (!bundle) {
    return (
      <div className="space-y-4">
        <Safety />
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-10 text-center dark:border-slate-600">
          <FileUp className="h-8 w-8 text-slate-400" aria-hidden />
          <span className="font-medium text-slate-900 dark:text-white">Open a review bundle</span>
          <span className="text-sm text-slate-500">
            A <span className="font-mono">bundle.jsonl</span> built by generative-folio&apos;s{" "}
            <span className="font-mono">scripts/writeback_review_bundle.py</span>. It stays on this computer.
          </span>
          <input type="file" accept=".jsonl,application/x-ndjson,application/json" className="sr-only" aria-label="Review bundle file" onChange={onBundleFile} />
        </label>
        {loading && <p role="status" className="text-sm text-slate-600">{loading}</p>}
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      </div>
    );
  }

  const { header } = bundle;
  const sample = samples.find((s) => s.sample_id === activeSample) ?? null;
  const navList: string[] = tab === "Samples" && sample ? sample.members : filtered.map((r) => r.row_id);
  const navIndex = selectedId ? navList.indexOf(selectedId) : -1;
  const selectedRow = selectedId ? bundle.rowsById.get(selectedId) : undefined;
  const showDetail = !!selectedRow && (tab === "Rows" || tab === "Samples");
  const view = pageOf(filtered, page, PAGE_SIZE);
  const reviewedCount = [...reviews.values()].filter((r) => r.disposition !== null).length;
  const setF = (patch: Partial<RowFilter>) => { setFilter((f) => ({ ...f, ...patch })); setPage(0); };

  return (
    <div className="space-y-4">
      <Safety />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
        <div>
          <span className="font-semibold">{header.digest_id}</span> · {header.counts.rows.toLocaleString()} proposed rows ·{" "}
          {reviewedCount.toLocaleString()} reviewed · {(header.counts.rows - reviewedCount).toLocaleString()} unreviewed ·{" "}
          <span className="font-mono text-xs" title={bundle.sha256}>bundle {bundle.sha256.slice(0, 12)}</span>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">
            Import reviews
            <input type="file" accept=".jsonl" className="sr-only" aria-label="Review export file" onChange={onImport} />
          </label>
          <Button size="sm" onClick={onExport}><Download className="mr-1 h-4 w-4" aria-hidden />Export reviews</Button>
        </div>
      </div>
      {notice && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("px-3 py-2 text-sm font-medium", tab === t ? "border-b-2 border-primary-600 text-primary-700 dark:text-primary-300" : "text-slate-600 dark:text-slate-300")}
          >
            {t}
            {t === "Exclusions" && ` (${header.counts.exclusions})`}
          </button>
        ))}
      </div>

      {(tab === "Rows" || tab === "Samples") && (
        <div className="flex flex-wrap items-end gap-2" aria-label="Filters">
          <label className="text-sm">Branch<br />
            <select aria-label="Branch" value={filter.branch} onChange={(e) => setF({ branch: e.target.value })} className={select}>
              <option value="">All branches</option>
              {Object.entries(header.counts.by_branch).map(([b, n]) => <option key={b} value={b}>{b} ({n.toLocaleString()})</option>)}
            </select>
          </label>
          <label className="text-sm">Component<br />
            <select aria-label="Component" value={filter.component} onChange={(e) => setF({ component: e.target.value })} className={select}>
              <option value="">All components</option>
              {Object.entries(header.counts.by_component).map(([c, n]) => <option key={c} value={c}>{c} ({n.toLocaleString()})</option>)}
            </select>
          </label>
          <label className="text-sm">Partition<br />
            <select aria-label="Partition" value={filter.partition} onChange={(e) => setF({ partition: e.target.value })} className={select}>
              <option value="">Keep and regenerate</option>
              {Object.entries(header.counts.by_partition).map(([p, n]) => <option key={p} value={p}>{p} ({n.toLocaleString()})</option>)}
            </select>
          </label>
          {tab === "Rows" && (
            <>
              <label className="text-sm">Review state<br />
                <select aria-label="Review state" value={filter.status} onChange={(e) => setF({ status: e.target.value as RowFilter["status"] })} className={select}>
                  <option value="">Any</option>
                  <option value="unreviewed">Unreviewed</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="SAME">SAME</option>
                  <option value="MINOR">MINOR</option>
                  <option value="MATERIAL">MATERIAL</option>
                  <option value="corrected">Corrected</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="grow text-sm">Search label, IRI, value or row id<br />
                <input aria-label="Search" type="search" value={filter.q} onChange={(e) => setF({ q: e.target.value })} className={cn(select, "w-full")} />
              </label>
            </>
          )}
        </div>
      )}

      <div className={cn(showDetail && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-4")}>
      <div className="min-w-0 space-y-4">
      {tab === "Rows" && (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <span role="status">
              {filtered.length ? `${(view.start + 1).toLocaleString()}–${view.end.toLocaleString()} of ${filtered.length.toLocaleString()} matching rows` : "0 matching rows"}
              {" "}({header.counts.rows.toLocaleString()} in bundle)
            </span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={view.page === 0} onClick={() => setPage(view.page - 1)}>Previous</Button>
              page {view.page + 1} of {view.pages.toLocaleString()}
              <Button size="sm" variant="outline" disabled={view.page >= view.pages - 1} onClick={() => setPage(view.page + 1)}>Next</Button>
            </span>
          </div>
          <RowTable rows={view.items} reviews={reviews} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      )}

      {tab === "Samples" && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Draws from every row matching the branch, component and partition above — the whole population, not a page.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Size<br />
              <input aria-label="Sample size" type="number" min={1} value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value) || 1)} className={cn(select, "w-24")} />
            </label>
            <label className="text-sm">Seed<br />
              <input aria-label="Seed" type="number" min={0} value={seed} onChange={(e) => setSeed(Number(e.target.value) >>> 0)} className={cn(select, "w-36")} />
            </label>
            <Button size="sm" onClick={drawNewSample}><Shuffle className="mr-1 h-4 w-4" aria-hidden />Draw sample</Button>
          </div>
          {samples.length > 0 && (
            <ul className="space-y-1 text-sm">
              {samples.map((s) => {
                const done = s.members.filter((m) => reviews.get(m)?.disposition).length;
                return (
                  <li key={s.sample_id}>
                    <button type="button" onClick={() => { setActiveSample(s.sample_id); setSelectedId(s.members[0] ?? null); }} className={cn("text-left hover:underline", s.sample_id === activeSample && "font-semibold")}>
                      {s.size} of {s.population.toLocaleString()} · seed {s.seed} · {Object.entries(s.filter).map(([k, v]) => `${k}=${v}`).join(", ") || "whole bundle"} · {done}/{s.size} reviewed
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {sample && (
            <>
              <RatesTable
                caption={`Sample ${sample.sample_id}`}
                keyHeader="Component"
                sampleResult
                cells={tallyRates(sample.members.map((m) => reviews.get(m)).filter((r): r is Review => !!r), bundle.rowsById, (r) => r.component)}
              />
              <RowTable rows={sample.members.map((m) => bundle.rowsById.get(m)).filter((r) => !!r)} reviews={reviews} selectedId={selectedId} onSelect={setSelectedId} />
            </>
          )}
        </div>
      )}

      </div>
      {showDetail && selectedRow && (
        <div className="mt-4 lg:sticky lg:top-4 lg:mt-0 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <RowDetail
            key={selectedRow.row_id}
            row={selectedRow}
            concept={bundle.concepts.get(selectedRow.iri)}
            review={reviews.get(selectedRow.row_id)}
            onChange={saveReview}
            position={navIndex >= 0 ? {
              index: navIndex,
              total: navList.length,
              onPrev: () => setSelectedId(navList[navIndex - 1]),
              onNext: () => setSelectedId(navList[navIndex + 1]),
            } : undefined}
          />
        </div>
      )}
      </div>

      {tab === "Rates" && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Rates count reviewed rows only. Reviewed rows include any sample draws, so these are review-population figures,
            not corpus-wide estimates.
          </p>
          <RatesTable caption="By component and locale" keyHeader="Component" cells={tallyRates(reviews.values(), bundle.rowsById, (r) => r.component, header.counts.by_component)} />
          <RatesTable caption="By branch" keyHeader="Branch" cells={tallyRates(reviews.values(), bundle.rowsById, (r) => r.branch, header.counts.by_branch)} />
          <RatesTable caption="By partition" keyHeader="Partition" cells={tallyRates(reviews.values(), bundle.rowsById, (r) => r.partition, header.counts.by_partition)} />
          <RatesTable caption="Overall" keyHeader="Scope" cells={tallyRates(reviews.values(), bundle.rowsById, () => "all rows", { "all rows": header.counts.rows })} />
        </div>
      )}

      {tab === "Exclusions" && <ExclusionsPanel bundle={bundle} />}

    </div>
  );
}

function Safety() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      Generated content, untrusted until reviewed. Nothing on this page writes to FOLIO: a review records your judgment
      for the digest; inclusion stays a separate, human-merged pull request, sandbox first.
    </div>
  );
}
