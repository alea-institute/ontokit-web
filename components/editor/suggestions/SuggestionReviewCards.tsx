"use client";

import type { DuplicateCandidate, GeneratedSuggestion } from "@/lib/api/generation";
import type { UseSuggestionsReturn } from "@/lib/hooks/useSuggestions";
import { SuggestionCard } from "./SuggestionCard";

export type MarkSuggestionDistinct = (
  suggestion: GeneratedSuggestion,
  candidate: DuplicateCandidate,
  reason: string,
) => Promise<void>;

export function SuggestionReviewCards({ review, onMarkDistinct, showDefinition, acceptanceLockedReason }: {
  review: UseSuggestionsReturn;
  onMarkDistinct?: MarkSuggestionDistinct;
  showDefinition?: boolean;
  acceptanceLockedReason?: string;
}) {
  if (!review.items.some((item) => item.status !== "rejected")) return null;
  const busy = !!review.busyReason || review.isAcceptingAll || review.isLoading;

  return (
    <>
      {(acceptanceLockedReason || review.busyReason) && review.items.some((item) => item.status === "pending") && (
        <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{acceptanceLockedReason || review.busyReason}</p>
      )}
      <div role="list" className="mt-2 space-y-2">
        {review.items.map((item, index) => item.status !== "rejected" && (
          <SuggestionCard
            key={item.suggestion.iri ?? index}
            item={item}
            onAccept={() => { void review.accept(index); }}
            onReject={() => review.reject(index)}
            onEdit={(value, definition) => { review.edit(index, value, definition); void review.accept(index); }}
            showDefinition={showDefinition}
            busy={busy || review.acceptingIndices.has(index)}
            acceptanceLocked={!!acceptanceLockedReason}
            onMarkDistinct={onMarkDistinct && !busy ? async (candidate, reason) => {
              await onMarkDistinct(item.suggestion, candidate, reason);
              review.markDistinct(index, candidate);
            } : undefined}
            disabled={item.suggestion.duplicate_verdict === "block"}
          />
        ))}
      </div>
    </>
  );
}
