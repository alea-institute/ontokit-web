import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
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
        onClick={() => { void onLoadLatest(); }}
      >
        {isLoadingLatest && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
        Load latest
      </Button>
    </div>
  );
}
