import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { generationApi } from "@/lib/api/generation";
import { LLM_STATUS_INVALIDATION_EVENT } from "@/lib/api/llm";
import { generationErrorMessage } from "@/lib/hooks/useSuggestions";
import { storeKey, suggestionBatchBusyReason, useSuggestionStore, type SuggestionScope } from "@/lib/stores/suggestionStore";

export const MAX_BULK_EXPANSION_CLASSES = 10;
export type BulkExpansionBatchSize = 3 | 5 | 10;
export interface BulkExpansionTarget {
  iri: string;
  label: string;
}

type JobStatus = "waiting" | "generating" | "done" | "failed" | "skipped";
export interface BulkExpansionJob extends BulkExpansionTarget {
  status: JobStatus;
  error?: string;
  batchVersion?: number;
}

export type BulkExpansionTotals = Record<JobStatus, number>;

interface UseBulkExpansionOptions extends SuggestionScope {
  canUseLLM: boolean;
  accessToken?: string;
  byoKey?: string;
  announce: (message: string) => void;
}

interface Run {
  id: number;
  scope: SuggestionScope;
  batchSize: BulkExpansionBatchSize;
  controller: AbortController;
  jobs: BulkExpansionJob[];
  haltReason: string | null;
  running: boolean;
}

function totalsFor(jobs: BulkExpansionJob[]): BulkExpansionTotals {
  const totals = { waiting: 0, generating: 0, done: 0, failed: 0, skipped: 0 };
  for (const job of jobs) totals[job.status]++;
  return totals;
}

export function bulkExpansionProgress(totals: BulkExpansionTotals, count: number): string {
  return `${totals.done} of ${count} classes done, ${totals.failed} failed` +
    (totals.skipped ? `, ${totals.skipped} skipped` : "");
}

function skipWaiting(jobs: BulkExpansionJob[]): BulkExpansionJob[] {
  return jobs.map((job) => job.status === "waiting" ? { ...job, status: "skipped" } : job);
}

export function useBulkExpansion({ projectId, branch, canUseLLM, accessToken, byoKey, announce }: UseBulkExpansionOptions) {
  const scope = useMemo(() => ({ projectId, branch }), [projectId, branch]);
  const runRef = useRef<Run | null>(null);
  const nextRunId = useRef(0);
  const [snapshot, setSnapshot] = useState<Run | null>(null);

  useLayoutEffect(() => () => {
    runRef.current?.controller.abort();
    runRef.current = null;
  }, [scope]);

  const updateJob = (run: Run, index: number, update: Partial<BulkExpansionJob>) => {
    run.jobs = run.jobs.map((job, i) => i === index ? { ...job, ...update } : job);
    setSnapshot({ ...run });
  };

  const execute = async (run: Run, indices: number[], token: string) => {
    const { signal } = run.controller;
    run.running = true;
    for (const index of indices) {
      const job = run.jobs[index];
      if (signal.aborted || job.status !== "waiting") break;

      const key = storeKey(scope, job.iri, "children");
      const store = useSuggestionStore.getState();
      const release = store.beginBatchOperation(key, "generating");
      let reason: string | undefined;
      try {
        if (!release) throw new Error(suggestionBatchBusyReason(store.batchOperations[key]));
        signal.addEventListener("abort", release, { once: true });
        updateJob(run, index, { status: "generating", error: undefined });
        const response = await generationApi.generateSuggestions(
          projectId,
          { class_iri: job.iri, branch, suggestion_type: "children", batch_size: run.batchSize },
          token, byoKey, signal,
        );
        if (signal.aborted) return;
        const batchVersion = store.setSuggestions(scope, job.iri, "children", response.suggestions, response.batch_id);
        updateJob(run, index, { status: "done", batchVersion });
      } catch (error) {
        if (signal.aborted) return;
        const isRefusal = error instanceof ApiError && (error.status === 402 || error.status === 429);
        reason = generationErrorMessage(error);
        if (isRefusal) {
          run.haltReason = reason;
          run.jobs = skipWaiting(run.jobs);
          window.dispatchEvent(new CustomEvent(LLM_STATUS_INVALIDATION_EVENT, { detail: { projectId } }));
        }
        updateJob(run, index, { status: "failed", error: reason });
      } finally {
        if (release) {
          signal.removeEventListener("abort", release);
          release();
        }
      }

      const progress = bulkExpansionProgress(totalsFor(run.jobs), run.jobs.length);
      announce(reason ? `${job.label}. ${reason} ${progress}` : `${job.label}. ${progress}`);
      if (run.haltReason) break;
    }
    run.running = false;
    setSnapshot({ ...run });
  };

  const start = async (targets: BulkExpansionTarget[], batchSize: BulkExpansionBatchSize) => {
    if (!canUseLLM || !accessToken || runRef.current?.running || targets.length === 0) return;
    const unique = Array.from(new Map(targets.map((target) => [target.iri, target])).values());
    const run: Run = {
      id: ++nextRunId.current, scope, batchSize, controller: new AbortController(), haltReason: null, running: false,
      jobs: unique.slice(0, MAX_BULK_EXPANSION_CLASSES).map((target) => ({ ...target, status: "waiting" })),
    };
    runRef.current = run;
    await execute(run, run.jobs.map((_, index) => index), accessToken);
  };

  const stop = () => {
    const run = runRef.current;
    if (!run?.running) return;
    run.jobs = skipWaiting(run.jobs);
    setSnapshot({ ...run });
    announce(bulkExpansionProgress(totalsFor(run.jobs), run.jobs.length));
  };

  const dismiss = () => {
    if (runRef.current?.running) return;
    runRef.current = null;
    setSnapshot(null);
  };

  const retry = async (iri: string) => {
    const run = runRef.current;
    if (!canUseLLM || !accessToken || !run || run.scope !== scope || run.running || run.haltReason) return;
    const index = run.jobs.findIndex((job) => job.iri === iri && job.status === "failed");
    if (index === -1) return;
    updateJob(run, index, { status: "waiting", error: undefined });
    await execute(run, [index], accessToken);
  };

  const current = snapshot?.scope === scope ? snapshot : null;
  const jobs = current?.jobs ?? [];
  return { runId: current?.id, jobs, totals: totalsFor(jobs), haltReason: current?.haltReason ?? null, start, stop, retry, dismiss };
}
