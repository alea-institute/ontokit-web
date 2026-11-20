"use client";

import type { DuplicateCandidate, GeneratedSuggestion } from "@/lib/api/generation";
import type { UseSuggestionsReturn } from "@/lib/hooks/useSuggestions";
import { SuggestionCard } from "./SuggestionCard";

export type MarkSuggestionDistinct = (
  suggestion: GeneratedSuggestion,
  candidate: DuplicateCandidate,
  reason: string,
) => Promise<void>;

export function SuggestionReviewCards({ review, onMarkDistinct, showDefinition }: {
  review: UseSuggestionsReturn;
  onMarkDistinct?: MarkSuggestionDistinct;
  showDefinition?: boolean;
}) {
  if (!review.items.some((item) => item.status !== "rejected")) return null;

  return (
    <div role="list" className="mt-2 space-y-2">
      {review.items.map((item, index) => item.status !== "rejected" && (
        <SuggestionCard
          key={item.suggestion.iri ?? index}
          item={item}
          onAccept={() => { void review.accept(index); }}
          onReject={() => review.reject(index)}
          onEdit={(value, definition) => { review.edit(index, value, definition); void review.accept(index); }}
          showDefinition={showDefinition}
          busy={review.isAcceptingAll || review.isLoading || review.acceptingIndices.has(index)}
          onMarkDistinct={onMarkDistinct && !review.isAcceptingAll && !review.isLoading ? async (candidate, reason) => {
            await onMarkDistinct(item.suggestion, candidate, reason);
            review.markDistinct(index, candidate);
          } : undefined}
          disabled={item.suggestion.duplicate_verdict === "block"}
        />
      ))}
    </div>
  );
}
