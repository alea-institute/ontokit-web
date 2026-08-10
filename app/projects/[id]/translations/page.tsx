"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Languages } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BranchProvider, useBranch } from "@/lib/context/BranchContext";
import { ApiError } from "@/lib/api/client";
import type {
  TranslationBackfillFilters,
  TranslationBackfillPreview,
} from "@/lib/api/translations";
import { getTranslationErrorMessage } from "@/lib/api/translations";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import { useProjectHomeHref } from "@/lib/hooks/useProjectHomeHref";
import { useTranslationCoverage } from "@/lib/hooks/useTranslationCoverage";

function TranslationCoverageContent({ projectId, token }: { projectId: string; token?: string }) {
  const { currentBranch } = useBranch();
  const projectHomeHref = useProjectHomeHref(projectId);
  const { project } = useProject(projectId, token);
  const { canManage } = derivePermissions(project, token);
  const coverageState = useTranslationCoverage(projectId, currentBranch, token);
  const [language, setLanguage] = useState("");
  const [eraBefore, setEraBefore] = useState("");
  const [neverConfirmed, setNeverConfirmed] = useState(false);
  const [preview, setPreview] = useState<TranslationBackfillPreview | null>(null);
  const previewError = coverageState.previewError
    ? getTranslationErrorMessage(coverageState.previewError, "Cost preview failed.")
    : null;
  const launchError = coverageState.launchError
    ? coverageState.launchError instanceof ApiError && coverageState.launchError.status === 409
      ? "A translation backfill is already active for this project."
      : getTranslationErrorMessage(coverageState.launchError, "Backfill could not be launched.")
    : null;

  const filters = (): TranslationBackfillFilters => ({
    branch: currentBranch,
    language: language || undefined,
    era_before: eraBefore || undefined,
    never_confirmed: neverConfirmed || undefined,
  });
  const resetPreview = () => {
    setPreview(null);
    coverageState.resetPreview?.();
    coverageState.resetLaunch?.();
  };
  const handlePreview = async () => {
    resetPreview();
    try {
      setPreview(await coverageState.previewBackfill(filters()));
    } catch {
      // The mutation exposes the error used by the rendered message.
    }
  };
  const handleLaunch = async () => {
    if (!preview) return;
    coverageState.resetLaunch?.();
    try {
      await coverageState.launchBackfill(filters());
    } catch {
      // The mutation exposes the error used by the rendered message.
    }
  };

  const job = coverageState.job;
  const progress = job && job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href={projectHomeHref} className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to project
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <Languages className="h-7 w-7 text-primary-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Translation Coverage</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Branch: {currentBranch}</p>
          </div>
        </div>

        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Coverage by language</h2>
            {coverageState.coverage && (
              <span className="text-sm text-slate-500">
                {coverageState.coverage.total_entities.toLocaleString()} entities
              </span>
            )}
          </div>
          {coverageState.isLoading ? (
            <p role="status">Loading translation coverage…</p>
          ) : coverageState.error ? (
            <p role="alert" className="text-sm text-red-600">{getTranslationErrorMessage(coverageState.error, "Translation coverage could not be loaded.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table aria-label="Translation coverage" tabIndex={0} className="w-full min-w-[640px] border-collapse text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Language', 'Verified', 'Provisional', 'Pending', 'Missing', 'Total'].map((heading) => (
                      <th key={heading} scope="col" className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverageState.coverage?.languages.map((item) => (
                    <tr key={item.language} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <th scope="row" className="px-3 py-3 font-medium text-slate-900 dark:text-white">{item.language}</th>
                      <td aria-label={`Verified: ${item.verified}`} className="px-3 py-3">Verified: {item.verified}</td>
                      <td aria-label={`Provisional: ${item.provisional}`} className="px-3 py-3">Provisional: {item.provisional}</td>
                      <td aria-label={`Pending: ${item.pending}`} className="px-3 py-3 text-amber-700 dark:text-amber-300">Pending: {item.pending}</td>
                      <td aria-label={`Missing: ${item.missing}`} className="px-3 py-3 text-red-700 dark:text-red-300">Missing: {item.missing}</td>
                      <td aria-label={`Total: ${item.total}`} className="px-3 py-3">Total: {item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Backfill translations</h2>
          {!canManage ? (
            <p className="mt-2 text-sm text-slate-500">A project administrator can launch translation backfills.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium">Language (optional)
                  <input aria-label="Language" value={language} onChange={(event) => { setLanguage(event.target.value); resetPreview(); }} placeholder="e.g. fr" className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
                </label>
                <label className="text-sm font-medium">Produced before (optional)
                  <input aria-label="Produced before" type="date" value={eraBefore} onChange={(event) => { setEraBefore(event.target.value); resetPreview(); }} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800" />
                </label>
                <label className="flex items-center gap-2 self-end py-2 text-sm font-medium">
                  <input aria-label="Never native-confirmed" type="checkbox" checked={neverConfirmed} onChange={(event) => { setNeverConfirmed(event.target.checked); resetPreview(); }} />
                  Never native-confirmed
                </label>
              </div>
              <Button variant="outline" onClick={handlePreview} disabled={coverageState.isPreviewing}>Preview cost</Button>
              {previewError && <p role="alert" className="text-sm text-red-600">{previewError}</p>}
              {preview && (
                <div className="rounded-md border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
                  <p className="font-medium">{preview.literal_count.toLocaleString()} literals · ${preview.expected_cost_usd.toFixed(2)} expected</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Up to ${preview.upper_bound_cost_usd.toFixed(2)}{preview.batch_discount_applied ? " · batch discount applied" : " · no batch discount"}</p>
                </div>
              )}
              <Button onClick={handleLaunch} disabled={!preview || coverageState.isLaunching}>Confirm backfill</Button>
              {launchError && <p role="alert" className="text-sm text-red-600">{launchError}</p>}
            </div>
          )}
          {job && (
            <div role="status" aria-live="polite" className="mt-5 rounded-md bg-slate-100 p-4 text-sm dark:bg-slate-800">
              Backfill {job.status}: {job.completed} of {job.total} literals ({progress}%).
              {job.error && <span className="block text-red-600">{job.error}</span>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function TranslationCoveragePage() {
  const { data: session } = useSession();
  const params = useParams();
  const projectId = params.id as string;
  return (
    <BranchProvider projectId={projectId} accessToken={session?.accessToken}>
      <TranslationCoverageContent projectId={projectId} token={session?.accessToken} />
    </BranchProvider>
  );
}
