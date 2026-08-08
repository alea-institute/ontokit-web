import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { generationApi, type GeneratedSuggestion, type SuggestionType } from "@/lib/api/generation";
import { ApiError } from "@/lib/api/client";
import { LLM_STATUS_INVALIDATION_EVENT } from "@/lib/api/llm";
import { storeKey, useSuggestionStore, type StoredSuggestion } from "@/lib/stores/suggestionStore";

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

// Stable fallback so the store selector returns a referentially-equal
// snapshot when an entity has no suggestions — a fresh [] per call makes
// useSyncExternalStore's getSnapshot unstable and React 19 aborts the
// render ("The result of getSnapshot should be cached").
const NO_SUGGESTIONS: StoredSuggestion[] = [];

export function generationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Could not generate suggestions.";
  }
  switch (error.status) {
    case 400:
      return "No generation model is configured. Choose a model in project AI settings.";
    case 402:
      return "This project's AI budget has been exhausted. Ask a project admin to review the budget.";
    case 403:
      return "Your project role does not allow AI suggestions.";
    case 429:
      return "The AI request limit has been reached. Wait before trying again.";
    case 502:
      return "The configured AI provider is unavailable. Check the provider connection and try again.";
    default:
      return "Could not generate suggestions.";
  }
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
  const scope = useMemo(() => ({ projectId, branch }), [projectId, branch]);
  const items = useSuggestionStore((s) =>
    entityIri
      ? (s.suggestions[storeKey(scope, entityIri, suggestionType)] ?? NO_SUGGESTIONS)
      : NO_SUGGESTIONS
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
        controller.signal,
      );
      if (!controller.signal.aborted) {
        store.getState().setSuggestions(scope, entityIri, suggestionType, response.suggestions);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(generationErrorMessage(err));
        if (err instanceof ApiError && (err.status === 402 || err.status === 429)) {
          window.dispatchEvent(
            new CustomEvent(LLM_STATUS_INVALIDATION_EVENT, { detail: { projectId } }),
          );
        }
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [projectId, entityIri, branch, suggestionType, batchSize, canUseLLM, accessToken, byoKey, store, scope]);

  const accept = useCallback((index: number) => {
    if (!entityIri) return;
    const stored = store.getState().suggestions[storeKey(scope, entityIri, suggestionType)]?.[index];
    if (!stored) return;
    store.getState().acceptSuggestion(scope, entityIri, suggestionType, index);
    onAccepted?.(stored.suggestion, stored.editedValue);
  }, [entityIri, suggestionType, store, onAccepted, scope]);

  const reject = useCallback((index: number) => {
    if (!entityIri) return;
    store.getState().rejectSuggestion(scope, entityIri, suggestionType, index);
  }, [entityIri, suggestionType, store, scope]);

  const edit = useCallback((index: number, value: string) => {
    if (!entityIri) return;
    store.getState().editSuggestion(scope, entityIri, suggestionType, index, value);
  }, [entityIri, suggestionType, store, scope]);

  return { items, isLoading, error, request, accept, reject, edit };
}
