import { create } from "zustand";
import {
  duplicateVerdictForScore,
  type DuplicateCandidate,
  type GeneratedSuggestion,
} from "@/lib/api/generation";

export type SuggestionReviewStatus = "pending" | "accepted" | "rejected";

export interface StoredSuggestion {
  suggestion: GeneratedSuggestion;
  status: SuggestionReviewStatus;
  editedValue?: string;
}

export interface SuggestionScope {
  projectId: string;
  branch: string;
}

// Project and branch are part of the identity: forks intentionally share IRIs.
export function storeKey(scope: SuggestionScope, entityIri: string, suggestionType: string): string {
  return `${scope.projectId}::${scope.branch}::${entityIri}::${suggestionType}`;
}

interface SuggestionStoreState {
  suggestions: Record<string, StoredSuggestion[]>;
  setSuggestions: (scope: SuggestionScope, entityIri: string, suggestionType: string, items: GeneratedSuggestion[]) => void;
  acceptSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number) => void;
  rejectSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number) => void;
  editSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number, value: string) => void;
  removeDuplicateCandidate: (
    scope: SuggestionScope,
    entityIri: string,
    suggestionType: string,
    index: number,
    candidate: Pick<DuplicateCandidate, "iri" | "branch">,
  ) => void;
  clearAllSuggestions: () => void;
  getPendingCount: (scope: SuggestionScope) => number;
  getPendingSuggestions: (scope: SuggestionScope, entityIri: string, suggestionType: string) => StoredSuggestion[];
  getFirstPendingRef: () => string | null;
}

export const useSuggestionStore = create<SuggestionStoreState>()((set, get) => ({
  suggestions: {},
  setSuggestions: (scope, entityIri, suggestionType, items) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => ({
      suggestions: {
        ...state.suggestions,
        [key]: items.map((s) => ({ suggestion: s, status: "pending" as const })),
      },
    }));
  },
  acceptSuggestion: (scope, entityIri, suggestionType, index) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      if (arr[index]) arr[index] = { ...arr[index], status: "accepted" };
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  rejectSuggestion: (scope, entityIri, suggestionType, index) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      if (arr[index]) arr[index] = { ...arr[index], status: "rejected" };
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  editSuggestion: (scope, entityIri, suggestionType, index, value) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      const item = arr[index];
      if (item) {
        // Provenance must track reality: once the user rewrites the text the
        // suggestion is no longer purely "llm-proposed". If the edit restores
        // the original text exactly, drop the edit and the provenance flip.
        const original = item.suggestion.property_iri
          ? (item.suggestion.value ?? item.suggestion.label)
          : item.suggestion.label;
        if (value === original) {
          arr[index] = {
            ...item,
            editedValue: undefined,
            suggestion: { ...item.suggestion, provenance: "llm-proposed" },
          };
        } else {
          arr[index] = {
            ...item,
            editedValue: value,
            suggestion: { ...item.suggestion, provenance: "user-edited-from-llm" },
          };
        }
      }
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  removeDuplicateCandidate: (scope, entityIri, suggestionType, index, reviewedCandidate) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const current = state.suggestions[key];
      const item = current?.[index];
      if (!item) return state;

      const duplicateCandidates = item.suggestion.duplicate_candidates.filter(
        (candidate) => !(
          candidate.iri === reviewedCandidate.iri
          && (candidate.branch ?? null) === (reviewedCandidate.branch ?? null)
        ),
      );
      if (duplicateCandidates.length === item.suggestion.duplicate_candidates.length) {
        return state;
      }

      const highestScore = Math.max(0, ...duplicateCandidates.map((candidate) => candidate.score));
      const duplicateVerdict = duplicateVerdictForScore(highestScore);
      const items = [...current];
      items[index] = {
        ...item,
        suggestion: {
          ...item.suggestion,
          duplicate_candidates: duplicateCandidates,
          duplicate_verdict: duplicateVerdict,
        },
      };
      return { suggestions: { ...state.suggestions, [key]: items } };
    });
  },
  clearAllSuggestions: () => set({ suggestions: {} }),
  getPendingCount: (scope) => {
    const { suggestions } = get();
    const scopePrefix = `${scope.projectId}::${scope.branch}::`;
    let count = 0;
    for (const [key, items] of Object.entries(suggestions)) {
      if (!key.startsWith(scopePrefix)) continue;
      for (const item of items) {
        if (item.status === "pending") count += 1;
      }
    }
    return count;
  },
  getPendingSuggestions: (scope, entityIri, suggestionType) => {
    const key = storeKey(scope, entityIri, suggestionType);
    return (get().suggestions[key] || []).filter((s) => s.status === "pending");
  },
  getFirstPendingRef: () => {
    const { suggestions } = get();
    for (const [key, items] of Object.entries(suggestions)) {
      if (items.some((s) => s.status === "pending")) return key;
    }
    return null;
  },
}));
