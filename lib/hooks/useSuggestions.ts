import { useState, useCallback, useRef, useEffect } from "react";
import { generationApi, type GeneratedSuggestion, type SuggestionType } from "@/lib/api/generation";
import { useSuggestionStore, type StoredSuggestion } from "@/lib/stores/suggestionStore";

/** Stable empty array used as selector fallback to prevent Zustand re-render loops.
 *  Never use an inline `[]` literal in a Zustand selector — Object.is([], []) is false,
 *  which causes the selector to report a change on every render and triggers infinite loops.
 */
const EMPTY_SUGGESTIONS: StoredSuggestion[] = [];

export interface UseSuggestionsOptions {
  projectId: string;
  entityIri: string | null;
  branch: string;
  suggestionType: SuggestionType;
  batchSize?: number;
  canUseLLM: boolean;
  accessToken?: string;
  byoKey?: string;
  onAccepted?: (suggestion: GeneratedSuggestion, editedValue?: string) => void;
}

export interface UseSuggestionsReturn {
  items: StoredSuggestion[];
  isLoading: boolean;
  error: string | null;
  request: () => Promise<void>;
  accept: (index: number) => void;
  reject: (index: number) => void;
  edit: (index: number, value: string) => void;
}

export function useSuggestions(opts: UseSuggestionsOptions): UseSuggestionsReturn {
  const {
    projectId, entityIri, branch, suggestionType,
    batchSize = 5, canUseLLM, accessToken, byoKey, onAccepted,
  } = opts;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const store = useSuggestionStore;
  const items = useSuggestionStore((s) =>
    entityIri ? (s.suggestions[`${entityIri}::${suggestionType}`] ?? EMPTY_SUGGESTIONS) : EMPTY_SUGGESTIONS
  );

  // Abort in-flight request when entityIri changes (Pitfall 6 defense)
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [entityIri]);

  const request = useCallback(async () => {
    if (!entityIri || !canUseLLM || !accessToken) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const response = await generationApi.generateSuggestions(
        projectId,
        { class_iri: entityIri, branch, suggestion_type: suggestionType, batch_size: batchSize },
        accessToken,
        byoKey,
      );
      if (!controller.signal.aborted) {
        store.getState().setSuggestions(entityIri, suggestionType, response.suggestions);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : "Could not generate suggestions";
        setError(msg);
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [projectId, entityIri, branch, suggestionType, batchSize, canUseLLM, accessToken, byoKey, store]);

  const accept = useCallback((index: number) => {
    if (!entityIri) return;
    const stored = store.getState().suggestions[`${entityIri}::${suggestionType}`]?.[index];
    if (!stored) return;
    store.getState().acceptSuggestion(entityIri, suggestionType, index);
    onAccepted?.(stored.suggestion, stored.editedValue);
  }, [entityIri, suggestionType, store, onAccepted]);

  const reject = useCallback((index: number) => {
    if (!entityIri) return;
    store.getState().rejectSuggestion(entityIri, suggestionType, index);
  }, [entityIri, suggestionType, store]);

  const edit = useCallback((index: number, value: string) => {
    if (!entityIri) return;
    store.getState().editSuggestion(entityIri, suggestionType, index, value);
  }, [entityIri, suggestionType, store]);

  return { items, isLoading, error, request, accept, reject, edit };
}
