"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SourceRevisionConflictState } from "@/lib/hooks/useSourceRevisionGuard";

interface SourceRevisionConflictBannerProps {
  conflict: SourceRevisionConflictState;
  isLoadingLatest: boolean;
  onLoadLatest: () => Promise<unknown>;
}

export function SourceRevisionConflictBanner({
  conflict,
  isLoadingLatest,
  onLoadLatest,
}: SourceRevisionConflictBannerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">A newer source revision is available.</p>
            <p>
              Your draft is preserved and was not retried or overwritten. Reconcile it manually,
              or load latest to discard this draft and start from revision {conflict.detail.current_revision.slice(0, 8)}.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoadingLatest}
          onClick={() => setConfirmOpen(true)}
        >
          {isLoadingLatest && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
          Load latest
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={async () => { await onLoadLatest(); }}
        title="Discard your draft and load the latest source?"
        description={`Your preserved local draft will be discarded and replaced by revision ${conflict.detail.current_revision.slice(0, 8)}. This cannot be undone.`}
        confirmLabel="Discard draft and load latest"
        variant="warning"
      />
    </>
  );
}
