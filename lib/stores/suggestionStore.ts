import { create } from "zustand";
import type { GeneratedSuggestion } from "@/lib/api/generation";

export type SuggestionReviewStatus = "pending" | "accepted" | "rejected";

export interface StoredSuggestion {
  suggestion: GeneratedSuggestion;
  status: SuggestionReviewStatus;
  editedValue?: string;
}

// Key format: `${entityIri}::${suggestionType}`
function storeKey(entityIri: string, suggestionType: string): string {
  return `${entityIri}::${suggestionType}`;
}

interface SuggestionStoreState {
  suggestions: Record<string, StoredSuggestion[]>;
  setSuggestions: (entityIri: string, suggestionType: string, items: GeneratedSuggestion[]) => void;
  acceptSuggestion: (entityIri: string, suggestionType: string, index: number) => void;
  rejectSuggestion: (entityIri: string, suggestionType: string, index: number) => void;
  editSuggestion: (entityIri: string, suggestionType: string, index: number, value: string) => void;
  clearSuggestions: (entityIri: string) => void;
  clearAllSuggestions: () => void;
  getPendingCount: () => number;
  getPendingSuggestions: (entityIri: string, suggestionType: string) => StoredSuggestion[];
  getFirstPendingRef: () => string | null;
}

export const useSuggestionStore = create<SuggestionStoreState>()((set, get) => ({
  suggestions: {},
  setSuggestions: (entityIri, suggestionType, items) => {
    const key = storeKey(entityIri, suggestionType);
    set((state) => ({
      suggestions: {
        ...state.suggestions,
        [key]: items.map((s) => ({ suggestion: s, status: "pending" as const })),
      },
    }));
  },
  acceptSuggestion: (entityIri, suggestionType, index) => {
    const key = storeKey(entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      if (arr[index]) arr[index] = { ...arr[index], status: "accepted" };
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  rejectSuggestion: (entityIri, suggestionType, index) => {
    const key = storeKey(entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      if (arr[index]) arr[index] = { ...arr[index], status: "rejected" };
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  editSuggestion: (entityIri, suggestionType, index, value) => {
    const key = storeKey(entityIri, suggestionType);
    set((state) => {
      const arr = [...(state.suggestions[key] || [])];
      if (arr[index]) arr[index] = { ...arr[index], editedValue: value };
      return { suggestions: { ...state.suggestions, [key]: arr } };
    });
  },
  clearSuggestions: (entityIri) =>
    set((state) => {
      const next = { ...state.suggestions };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${entityIri}::`)) delete next[key];
      }
      return { suggestions: next };
    }),
  clearAllSuggestions: () => set({ suggestions: {} }),
  getPendingCount: () => {
    const { suggestions } = get();
    return Object.values(suggestions)
      .flat()
      .filter((s) => s.status === "pending").length;
  },
  getPendingSuggestions: (entityIri, suggestionType) => {
    const key = storeKey(entityIri, suggestionType);
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
