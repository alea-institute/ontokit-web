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
  editedDefinition?: string;
}

export interface SuggestionScope {
  projectId: string;
  branch: string;
}

// Project and branch are part of the identity: forks intentionally share IRIs.
export function storeKey(scope: SuggestionScope, entityIri: string, suggestionType: string): string {
  return `${scope.projectId}::${scope.branch}::${entityIri}::${suggestionType}`;
}

type BatchOperation = "generating" | "accepting";

export function suggestionBatchBusyReason(operation: BatchOperation | undefined): string | undefined {
  if (operation === "accepting") return "Wait for suggestion acceptance to finish.";
  if (operation === "generating") return "Wait for suggestion generation to finish.";
}

let nextBatchVersion = 0;

interface SuggestionStoreState {
  suggestions: Record<string, StoredSuggestion[]>;
  batchIds: Record<string, string | undefined>;
  batchVersions: Partial<Record<string, number>>;
  batchOperations: Partial<Record<string, BatchOperation>>;
  beginBatchOperation: (key: string, operation: BatchOperation) => (() => void) | undefined;
  setSuggestions: (scope: SuggestionScope, entityIri: string, suggestionType: string, items: GeneratedSuggestion[], batchId?: string) => number;
  rejectPendingSuggestions: (scope: SuggestionScope, entityIri: string, suggestionType: string) => void;
  restoreRejectedSuggestions: (scope: SuggestionScope, entityIri: string, suggestionType: string) => void;
  acceptSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number) => void;
  rejectSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number) => void;
  editSuggestion: (scope: SuggestionScope, entityIri: string, suggestionType: string, index: number, value: string, definition?: string) => void;
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
  batchIds: {},
  batchVersions: {},
  batchOperations: {},
  beginBatchOperation: (key, operation) => {
    if (get().batchOperations[key]) return;
    set((state) => ({ batchOperations: { ...state.batchOperations, [key]: operation } }));
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      set((state) => {
        const batchOperations = { ...state.batchOperations };
        delete batchOperations[key];
        return { batchOperations };
      });
    };
  },
  setSuggestions: (scope, entityIri, suggestionType, items, batchId) => {
    const key = storeKey(scope, entityIri, suggestionType);
    const version = ++nextBatchVersion;
    set((state) => ({
      batchVersions: { ...state.batchVersions, [key]: version },
      batchIds: { ...state.batchIds, [key]: batchId },
      suggestions: {
        ...state.suggestions,
        [key]: items.map((s) => ({ suggestion: s, status: "pending" as const })),
      },
    }));
    return version;
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
  rejectPendingSuggestions: (scope, entityIri, suggestionType) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const items = state.suggestions[key];
      if (!items?.some((item) => item.status === "pending")) return state;
      return {
        suggestions: {
          ...state.suggestions,
          [key]: items.map((item) => item.status === "pending" ? { ...item, status: "rejected" } : item),
        },
      };
    });
  },
  restoreRejectedSuggestions: (scope, entityIri, suggestionType) => {
    const key = storeKey(scope, entityIri, suggestionType);
    set((state) => {
      const items = state.suggestions[key];
      if (!items?.some((item) => item.status === "rejected")) return state;
      return {
        suggestions: {
          ...state.suggestions,
          [key]: items.map((item) => item.status === "rejected" ? { ...item, status: "pending" } : item),
        },
      };
    });
  },
  editSuggestion: (scope, entityIri, suggestionType, index, value, definition) => {
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
        const editedValue = value === original ? undefined : value;
        const currentDefinition = definition ?? item.editedDefinition;
        const editedDefinition = currentDefinition === item.suggestion.definition ? undefined : currentDefinition;
        arr[index] = {
          ...item,
          editedValue,
          editedDefinition,
          suggestion: {
            ...item.suggestion,
            provenance: editedValue === undefined && editedDefinition === undefined ? "llm-proposed" : "user-edited-from-llm",
          },
        };
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
  clearAllSuggestions: () => set({ suggestions: {}, batchIds: {}, batchVersions: {} }),
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
