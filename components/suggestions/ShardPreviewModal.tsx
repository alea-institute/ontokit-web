"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DndContext } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { useShardPreviewStore } from "@/lib/stores/shardPreviewStore";
import { suggestionsApi } from "@/lib/api/suggestions";
import type { ClusterResponse, BatchSubmitPRResult } from "@/lib/api/suggestions";
import type { ProgressStep } from "@/components/suggestions/ShardSubmitProgressBar";
import { useShardDragDrop } from "@/lib/hooks/useShardDragDrop";
import { ShardPreviewSummaryBar } from "@/components/suggestions/ShardPreviewSummaryBar";
import { ShardPreviewPRGroup } from "@/components/suggestions/ShardPreviewPRGroup";
import { ShardPreviewShardRow } from "@/components/suggestions/ShardPreviewShardRow";
import { ShardPreviewEntityList } from "@/components/suggestions/ShardPreviewEntityList";
import { ShardSubmitProgressBar } from "@/components/suggestions/ShardSubmitProgressBar";
import { ShardSubmitComplete } from "@/components/suggestions/ShardSubmitComplete";

// Internal phases managed by this modal orchestrator
type ModalPhase = "preview" | "submitting" | "complete";

interface ShardPreviewModalProps {
  projectId: string;
  sessionId: string;
  accessToken: string;
  /** Pre-fetched cluster response from the caller */
  clusterResponse: ClusterResponse;
  onBatchSubmitted: (results: BatchSubmitPRResult[]) => void;
  onClose: () => void;
}

/**
 * ShardPreviewModal — full-screen modal orchestrator for the shard preview and
 * batch submit flow.
 *
 * Three internal phases:
 *  A. "preview" — user reviews and adjusts shards before submitting
 *  B. "submitting" — progress bar while batchSubmit API call is in-flight
 *  C. "complete" — success/partial-failure screen with retry and done actions
 *
 * Escape key closes the modal (preview phase only — during submit it is disabled
 * to prevent accidental dismissal while PRs are being created).
 *
 * DndContext is self-contained — not nested inside the tree's DndContext
 * (modal is a fixed overlay so there is no DOM nesting issue per RESEARCH.md
 * Pitfall 3).
 *
 * T-15-04: Request built only from store state hydrated by cluster response;
 * user drag-and-drop adjustments cannot introduce IRIs not in the original
 * cluster response.
 */
export function ShardPreviewModal({
  projectId,
  sessionId,
  accessToken,
  clusterResponse,
  onBatchSubmitted,
  onClose,
}: ShardPreviewModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("preview");
  const [notes, setNotes] = useState("");
  const [submitResponse, setSubmitResponse] = useState<{
    results: BatchSubmitPRResult[];
    succeeded: number;
    failed: number;
  } | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  // Store state
  const setFromClusterResponse = useShardPreviewStore((s) => s.setFromClusterResponse);
  const clear = useShardPreviewStore((s) => s.clear);
  const prGroups = useShardPreviewStore((s) => s.prGroups);
  const shards = useShardPreviewStore((s) => s.shards);
  const prGroupOrder = useShardPreviewStore((s) => s.prGroupOrder);

  // Hydrate store from the pre-fetched cluster response on mount
  useEffect(() => {
    setFromClusterResponse(clusterResponse);
  }, [clusterResponse, setFromClusterResponse]);

  // Escape key closes modal (only in preview phase)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && phase === "preview") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, phase]);

  // DnD hook
  const { sensors, handleDragEnd } = useShardDragDrop();

  // Derived values
  const allShardIds = useMemo(() => Object.keys(shards), [shards]);

  const shardLabelMap = useMemo(
    () => Object.fromEntries(Object.entries(shards).map(([id, s]) => [id, s.label])),
    [shards],
  );

  // prIndexMap: prGroupId -> 1-based index for display
  const prIndexMap = useMemo(
    () =>
      Object.fromEntries(prGroupOrder.map((id, idx) => [id, idx + 1])),
    [prGroupOrder],
  );

  // --- Submit handler ---

  const handleSubmit = useCallback(async () => {
    setPhase("submitting");

    // Build progress steps: one header step + one per PR group
    const totalPrs = prGroupOrder.length;
    const steps: ProgressStep[] = [
      { label: "Submitting suggestions...", status: "active" },
      ...prGroupOrder.map((_, idx) => ({
        label: `Creating PR ${idx + 1}/${totalPrs}...`,
        status: "idle" as const,
      })),
    ];
    setProgressSteps(steps);

    // Build BatchSubmitRequest from current store state (T-15-04: store-sourced only)
    const request = {
      pr_groups: prGroupOrder.map((prId) => {
        const prGroup = prGroups[prId];
        return {
          shards: prGroup.shardIds.map((shardId) => {
            const shard = shards[shardId];
            return {
              id: shard.id,
              label: shard.label,
              entity_iris: shard.entityIris,
            };
          }),
        };
      }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      const response = await suggestionsApi.batchSubmit(
        projectId,
        sessionId,
        request,
        accessToken,
      );
      setSubmitResponse(response);
      setPhase("complete");
    } catch {
      // On error show all steps as error
      setProgressSteps((prev) =>
        prev.map((step) => ({ ...step, status: "error" as const })),
      );
    }
  }, [prGroupOrder, prGroups, shards, notes, projectId, sessionId, accessToken]);

  // --- Retry failed handler ---

  const handleRetryFailed = useCallback(async () => {
    if (!submitResponse) return;

    const failedIndices = new Set(
      submitResponse.results
        .filter((r) => r.status === "failed")
        .map((r) => r.pr_group_index),
    );

    setPhase("submitting");

    const failedPrIds = prGroupOrder.filter((_, idx) => failedIndices.has(idx));
    const totalRetry = failedPrIds.length;

    const steps: ProgressStep[] = [
      { label: "Retrying failed PRs...", status: "active" },
      ...failedPrIds.map((_, idx) => ({
        label: `Retrying PR ${idx + 1}/${totalRetry}...`,
        status: "idle" as const,
      })),
    ];
    setProgressSteps(steps);

    const retryRequest = {
      pr_groups: failedPrIds.map((prId) => {
        const prGroup = prGroups[prId];
        return {
          shards: prGroup.shardIds.map((shardId) => {
            const shard = shards[shardId];
            return {
              id: shard.id,
              label: shard.label,
              entity_iris: shard.entityIris,
            };
          }),
        };
      }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      const response = await suggestionsApi.batchSubmit(
        projectId,
        sessionId,
        retryRequest,
        accessToken,
      );
      setSubmitResponse(response);
      setPhase("complete");
    } catch {
      setProgressSteps((prev) =>
        prev.map((step) => ({ ...step, status: "error" as const })),
      );
    }
  }, [submitResponse, prGroupOrder, prGroups, shards, notes, projectId, sessionId, accessToken]);

  // --- Done handler ---

  const handleDone = useCallback(() => {
    const results = submitResponse?.results ?? [];
    clear();
    onBatchSubmitted(results);
    onClose();
  }, [submitResponse, clear, onBatchSubmitted, onClose]);

  // --- Render ---

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div
        className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150 ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shard-preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <h2
            id="shard-preview-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Review suggestion batches
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shard preview"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Phase A: Preview & Adjust */}
        {phase === "preview" && (
          <>
            {/* Summary bar */}
            <ShardPreviewSummaryBar />

            {/* Body: scrollable nested tree inside DnD context */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex-1 overflow-y-auto">
                {prGroupOrder.map((prId, idx) => {
                  const prGroup = prGroups[prId];
                  if (!prGroup) return null;

                  return (
                    <ShardPreviewPRGroup
                      key={prId}
                      prGroup={prGroup}
                      prIndex={idx + 1}
                    >
                      {prGroup.shardIds.map((shardId) => {
                        const shard = shards[shardId];
                        if (!shard) return null;

                        // Other shards in the same PR group for merge submenu
                        const siblingShardIds = prGroup.shardIds.filter(
                          (id) => id !== shardId,
                        );

                        return (
                          <ShardPreviewShardRow
                            key={shardId}
                            shard={shard}
                            prId={prId}
                            allShardIds={siblingShardIds}
                            allPrIds={prGroupOrder}
                            prIndexMap={prIndexMap}
                            shardLabels={shardLabelMap}
                          >
                            <ShardPreviewEntityList
                              shard={shard}
                              allShardIds={allShardIds.filter((id) => id !== shardId)}
                              shardLabels={shardLabelMap}
                            />
                          </ShardPreviewShardRow>
                        );
                      })}
                    </ShardPreviewPRGroup>
                  );
                })}
              </div>
            </DndContext>

            {/* Footer */}
            <div className="flex items-end gap-4 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for reviewers — optional"
                className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={2}
              />
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit}>
                Submit suggestions
              </Button>
            </div>
          </>
        )}

        {/* Phase B: Submitting */}
        {phase === "submitting" && (
          <div className="flex flex-1 flex-col overflow-y-auto py-6">
            <ShardSubmitProgressBar steps={progressSteps} />
          </div>
        )}

        {/* Phase C: Complete */}
        {phase === "complete" && submitResponse && (
          <div className="flex-1 overflow-y-auto">
            <ShardSubmitComplete
              results={submitResponse.results}
              succeeded={submitResponse.succeeded}
              failed={submitResponse.failed}
              onRetryFailed={handleRetryFailed}
              onDone={handleDone}
            />
          </div>
        )}
      </div>
    </div>
  );
}
