"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Check, Languages, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BranchProvider, useBranch } from "@/lib/context/BranchContext";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import { useProjectHomeHref } from "@/lib/hooks/useProjectHomeHref";
import {
  translationsApi,
  type ProvisionalTranslationRecord,
} from "@/lib/api/translations";

type PendingAction =
  | { kind: "confirm" | "reject"; record: ProvisionalTranslationRecord }
  | { kind: "bulk"; recordIds: string[] }
  | null;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function TranslationReviewContent({ projectId, token }: { projectId: string; token?: string }) {
  const { currentBranch } = useBranch();
  const projectHomeHref = useProjectHomeHref(projectId);
  const { project, isLoading: isProjectLoading } = useProject(projectId, token);
  const { canManage } = derivePermissions(project, token);
  const [reviewerLanguages, setReviewerLanguages] = useState<string[]>([]);
  const [records, setRecords] = useState<ProvisionalTranslationRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const loadQueue = useCallback(async () => {
    if (!token || !project?.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { languages } = await translationsApi.getMyReviewerLanguages(projectId, token);
      setReviewerLanguages(languages);
      const queryLanguages = canManage ? [""] : languages;
      const queues = await Promise.all(
        queryLanguages.map((language) =>
          translationsApi.listProvisional(projectId, language, currentBranch, token),
        ),
      );
      const unique = new Map(queues.flat().map((record) => [record.record_id, record]));
      setRecords([...unique.values()]);
    } catch (error) {
      setLoadError(errorMessage(error, "Translation review queue could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, [canManage, currentBranch, project?.id, projectId, token]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const visibleRecords = useMemo(() => records.filter((record) => {
    if (languageFilter !== "all" && record.language !== languageFilter) return false;
    if (statusFilter === "confirmable" && !reviewerLanguages.includes(record.language)) return false;
    return true;
  }), [languageFilter, records, reviewerLanguages, statusFilter]);

  const canActOn = (record: ProvisionalTranslationRecord) => reviewerLanguages.includes(record.language);
  const removeRecords = (recordIds: string[]) => {
    const removed = new Set(recordIds);
    setRecords((current) => current.filter((record) => !removed.has(record.record_id)));
    setSelectedIds((current) => new Set([...current].filter((id) => !removed.has(id))));
  };

  const runAction = async () => {
    if (!pendingAction || !token) return;
    if (pendingAction.kind === "bulk") {
      try {
        const response = await translationsApi.confirmBulk(projectId, pendingAction.recordIds, currentBranch, token);
        const succeeded = response.results.filter((result) => result.ok).map((result) => result.record_id);
        const failures = Object.fromEntries(
          response.results.filter((result) => !result.ok).map((result) => [result.record_id, result.error || "Confirmation failed."]),
        );
        removeRecords(succeeded);
        setErrors((current) => ({ ...current, ...failures }));
        setAnnouncement(`${succeeded.length} confirmed; ${Object.keys(failures).length} failed.`);
      } catch (error) {
        const message = errorMessage(error, "Bulk confirmation failed.");
        setErrors((current) => ({ ...current, ...Object.fromEntries(pendingAction.recordIds.map((id) => [id, message])) }));
        setAnnouncement(`0 confirmed; ${pendingAction.recordIds.length} failed.`);
        throw error;
      }
      return;
    }

    const { kind, record } = pendingAction;
    try {
      if (kind === "confirm") {
        await translationsApi.confirmRecord(projectId, record.record_id, currentBranch, token);
      } else {
        await translationsApi.rejectRecord(projectId, record.record_id, currentBranch, token);
      }
      removeRecords([record.record_id]);
      setAnnouncement(`${record.proposed_value} ${kind === "confirm" ? "confirmed" : "rejected"}.`);
    } catch (error) {
      setErrors((current) => ({ ...current, [record.record_id]: errorMessage(error, `${kind} failed.`) }));
      setAnnouncement(`${kind === "confirm" ? "Confirmation" : "Rejection"} failed for ${record.proposed_value}.`);
      throw error;
    }
  };

  const selectedConfirmable = [...selectedIds].filter((id) => {
    const record = records.find((item) => item.record_id === id);
    return record ? canActOn(record) : false;
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href={projectHomeHref} className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to project
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <Languages className="h-7 w-7 text-primary-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Translation Review</h1>
            <p className="text-sm text-slate-500">Branch: {currentBranch}</p>
          </div>
        </div>

        {canManage && reviewerLanguages.length === 0 && !isLoading && (
          <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            View-only admin access. A reviewer language tag is required to confirm or reject translations.
          </p>
        )}

        <section aria-label="Translation review filters" className="mb-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
          <label className="text-sm font-medium">Language
            <select aria-label="Language" value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="all">All languages</option>
              {[...new Set(records.map((record) => record.language))].sort().map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Status
            <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="all">All provisional</option>
              <option value="confirmable">Confirmable by me</option>
            </select>
          </label>
        </section>

        {selectedConfirmable.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-primary-50 p-3 dark:bg-primary-950/30">
            <span className="text-sm font-medium">{selectedConfirmable.length} selected</span>
            <Button onClick={() => setPendingAction({ kind: "bulk", recordIds: selectedConfirmable })}>Confirm selected</Button>
          </div>
        )}

        {isProjectLoading || isLoading ? (
          <p>Loading provisional translations…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-600">{loadError}</p>
        ) : !canManage && reviewerLanguages.length === 0 ? (
          <p role="alert" className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 dark:bg-slate-900">
            Translation Review is limited to project admins and native-speaker reviewers.
          </p>
        ) : visibleRecords.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600 dark:bg-slate-900">
            No provisional translations for your reviewer languages.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table aria-label="Provisional translations" className="w-full min-w-[900px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                <th scope="col" className="p-3">Select</th><th scope="col" className="p-3">Language</th><th scope="col" className="p-3">Source</th><th scope="col" className="p-3">Proposed</th><th scope="col" className="p-3">Provenance</th><th scope="col" className="p-3">Actions</th>
              </tr></thead>
              <tbody>{visibleRecords.map((record) => {
                const enabled = canActOn(record);
                return <tr key={record.record_id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="p-3"><input type="checkbox" aria-label={`Select ${record.proposed_value}`} checked={selectedIds.has(record.record_id)} disabled={!enabled} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(record.record_id)) next.delete(record.record_id); else next.add(record.record_id); return next; })} /></td>
                  <th scope="row" className="p-3 font-medium">{record.language}</th>
                  <td className="p-3"><div>{record.source_value}</div><div className="max-w-52 truncate text-xs text-slate-500" title={record.entity_iri}>{record.predicate}</div></td>
                  <td className="p-3 font-medium">{record.proposed_value}</td>
                  <td className="p-3 text-xs text-slate-600 dark:text-slate-300"><div>{record.model_name} · {record.method}</div><div>Score {record.score.toFixed(2)} · {new Date(record.created_at).toLocaleDateString()}</div>{errors[record.record_id] && <p className="mt-1 font-medium text-red-600">{errors[record.record_id]}</p>}</td>
                  <td className="p-3"><div className="flex gap-2"><Button size="sm" aria-label={`Confirm ${record.proposed_value}`} disabled={!enabled} onClick={() => setPendingAction({ kind: "confirm", record })}><Check className="mr-1 h-4 w-4" /> Confirm</Button><Button size="sm" variant="danger" aria-label={`Reject ${record.proposed_value}`} disabled={!enabled} onClick={() => setPendingAction({ kind: "reject", record })}><X className="mr-1 h-4 w-4" /> Reject</Button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
        <ConfirmDialog
          open={pendingAction !== null}
          onOpenChange={(open) => { if (!open) setPendingAction(null); }}
          onConfirm={runAction}
          title={pendingAction?.kind === "reject" ? "Reject translation?" : "Confirm translation?"}
          description={pendingAction?.kind === "bulk" ? `Confirm ${pendingAction.recordIds.length} translations? Successful items will leave the queue.` : "This item will leave the provisional review queue after the action succeeds."}
          confirmLabel={pendingAction?.kind === "reject" ? "Reject translation" : pendingAction?.kind === "bulk" ? "Confirm translations" : "Confirm translation"}
          variant={pendingAction?.kind === "reject" ? "danger" : "default"}
        />
      </main>
    </div>
  );
}

export default function TranslationReviewPage() {
  const { data: session } = useSession();
  const params = useParams();
  const projectId = params.id as string;
  return <BranchProvider projectId={projectId} accessToken={session?.accessToken}>
    <TranslationReviewContent projectId={projectId} token={session?.accessToken} />
  </BranchProvider>;
}
